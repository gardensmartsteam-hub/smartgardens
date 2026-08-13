import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Payload = z.object({
  deviceId: z.string().min(1),
  soilMoisture: z.number().min(0).max(100),
  temperature: z.number().min(-20).max(70).optional(),
  airHumidity: z.number().min(0).max(100).optional(),
  light: z.number().min(0).max(200000).optional(),
  battery: z.number().min(0).max(100).optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const METRIC_LABEL = {
  humidity: "Umidade do solo",
  light: "Luminosidade",
  temperature: "Temperatura",
  nutrients: "Nutrientes",
} as const;

const ADVICE = {
  humidity: { baixo: "Hora de regar.", alto: "Solo encharcado — segure a rega." },
  light: { baixo: "Leve para um lugar mais claro.", alto: "Muito sol direto, procure meia-sombra." },
  temperature: { baixo: "Ambiente frio demais.", alto: "Ambiente quente demais, arejar ajuda." },
  nutrients: { baixo: "Faltando adubo no substrato.", alto: "Excesso de adubo, pause a adubação." },
} as const;

export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "JSON inválido." }, 400);
        }

        const parsed = Payload.safeParse(body);
        if (!parsed.success) {
          return json({ error: "Payload inválido.", details: parsed.error.flatten() }, 400);
        }
        const data = parsed.data;

        const deviceKey =
          request.headers.get("x-device-key") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!deviceKey) return json({ error: "Chave do dispositivo ausente." }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: device } = await supabaseAdmin
          .from("devices")
          .select("id, user_id, plant_id, device_key")
          .eq("device_id", data.deviceId)
          .maybeSingle();

        if (!device || device.device_key !== deviceKey) {
          return json({ error: "Dispositivo não reconhecido." }, 401);
        }
        if (!device.plant_id) {
          return json({ error: "Dispositivo ainda não está associado a uma planta." }, 409);
        }

        const { data: plant } = await supabaseAdmin
          .from("plants")
          .select("id, name, species:species_id(*)")
          .eq("id", device.plant_id)
          .maybeSingle();

        if (!plant) return json({ error: "Planta associada não encontrada." }, 404);
        const species = plant.species as unknown as Record<string, number>;

        const { data: previous } = await supabaseAdmin
          .from("readings")
          .select("light, temperature, nutrients")
          .eq("plant_id", device.plant_id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const mid = (min: number, max: number) => Math.round(((min + max) / 2) * 10) / 10;

        // Só o que o sensor realmente mediu vira dado novo; o resto mantém o último valor
        // conhecido (ou a média da faixa ideal) para não envenenar o diagnóstico com zeros.
        const humidity = Math.round(data.soilMoisture * 10) / 10;
        const temperature =
          data.temperature ??
          (previous ? Number(previous.temperature) : mid(species["temp_min"]!, species["temp_max"]!));
        const lightPct =
          data.light === undefined
            ? previous
              ? Number(previous.light)
              : mid(species["light_min"]!, species["light_max"]!)
            : Math.min(100, Math.round((data.light > 100 ? data.light / 10 : data.light) * 10) / 10);
        const nutrients = previous
          ? Number(previous.nutrients)
          : mid(species["nutrients_min"]!, species["nutrients_max"]!);

        const reading = {
          plant_id: device.plant_id,
          user_id: device.user_id,
          humidity,
          light: lightPct,
          temperature: Math.round(temperature * 10) / 10,
          nutrients,
          recorded_at: new Date().toISOString(),
        };

        const { error: insertError } = await supabaseAdmin.from("readings").insert(reading);
        if (insertError) return json({ error: "Falha ao salvar a leitura." }, 500);

        await supabaseAdmin
          .from("devices")
          .update({ last_seen_at: reading.recorded_at, battery: data.battery ?? null })
          .eq("id", device.id);

        const bounds: Record<keyof typeof METRIC_LABEL, [number, number]> = {
          humidity: [species["humidity_min"]!, species["humidity_max"]!],
          light: [species["light_min"]!, species["light_max"]!],
          temperature: [species["temp_min"]!, species["temp_max"]!],
          nutrients: [species["nutrients_min"]!, species["nutrients_max"]!],
        };

        const alerts: {
          plant_id: string;
          user_id: string;
          metric: string;
          severity: string;
          message: string;
        }[] = [];

        for (const metric of ["humidity", "light", "temperature", "nutrients"] as const) {
          const [min, max] = bounds[metric];
          const value = reading[metric];
          const status = value < min ? "baixo" : value > max ? "alto" : "ideal";
          if (status === "ideal") continue;
          const unit = metric === "temperature" ? "°C" : "%";
          const distance = status === "baixo" ? (min - value) / (min || 1) : (value - max) / max;
          alerts.push({
            plant_id: device.plant_id,
            user_id: device.user_id,
            metric,
            severity: distance > 0.25 ? "critico" : "aviso",
            message: `${plant.name}: ${METRIC_LABEL[metric]} em ${value}${unit} (ideal ${min}–${max}${unit}). ${ADVICE[metric][status]}`,
          });
        }

        if (alerts.length > 0) await supabaseAdmin.from("alerts").insert(alerts);

        return json({ ok: true, recordedAt: reading.recorded_at, alerts: alerts.length });
      },
    },
  },
});
