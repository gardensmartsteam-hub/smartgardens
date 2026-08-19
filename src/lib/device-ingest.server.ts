import { z } from "zod";

// Payload mínimo que a ESP32 envia. Só `deviceId` e `humidity` são obrigatórios;
// os demais sensores são opcionais e ficam NULL quando o hardware não os mede.
export const ReadingPayload = z.object({
  deviceId: z.string().min(1).max(64),
  humidity: z.number().finite().min(0).max(100),
  temperature: z.number().finite().min(-40).max(90).optional(),
  light: z.number().finite().min(0).max(200000).optional(),
  nutrients: z.number().finite().min(0).max(100).optional(),
  battery: z.number().finite().min(0).max(100).optional(),
});

export type IngestResult = { status: number; body: Record<string, unknown> };

const MAX_BODY_BYTES = 2048;

const METRIC_LABEL = {
  humidity: "Umidade do solo",
  light: "Luminosidade",
  temperature: "Temperatura",
  nutrients: "Nutrientes",
} as const;

const ADVICE = {
  humidity: { baixo: "Sua planta pode precisar de água.", alto: "Solo encharcado — segure a rega." },
  light: { baixo: "Leve para um lugar mais claro.", alto: "Muito sol direto, procure meia-sombra." },
  temperature: { baixo: "Ambiente frio demais.", alto: "Ambiente quente demais, arejar ajuda." },
  nutrients: { baixo: "Faltando adubo no substrato.", alto: "Excesso de adubo, pause a adubação." },
} as const;

type MetricKey = keyof typeof METRIC_LABEL;

/**
 * Recebe o corpo bruto da requisição da ESP32, valida tudo no servidor e grava a
 * leitura. Toda a lógica privilegiada (service role) fica aqui, no servidor —
 * o dispositivo nunca recebe credencial administrativa.
 */
export async function ingestReading(raw: string, deviceKeyHeader: string): Promise<IngestResult> {
  if (raw.length > MAX_BODY_BYTES) {
    return { status: 413, body: { success: false, error: "Payload too large" } };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { status: 400, body: { success: false, error: "Invalid JSON" } };
  }

  const parsed = ReadingPayload.safeParse(parsedJson);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".") || "payload";
    return { status: 400, body: { success: false, error: `Invalid field: ${field}` } };
  }
  const data = parsed.data;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: device } = await supabaseAdmin
    .from("devices")
    .select("id, user_id, plant_id, device_key, require_key")
    .eq("device_id", data.deviceId)
    .maybeSingle();

  if (!device) {
    return { status: 404, body: { success: false, error: "Device not found" } };
  }

  // Autenticação por chave do dispositivo: já preparada por device. Enquanto
  // `require_key` estiver desligado, a chave é opcional — mas se vier, precisa bater.
  if (device.require_key || deviceKeyHeader) {
    if (!deviceKeyHeader || deviceKeyHeader !== device.device_key) {
      return { status: 401, body: { success: false, error: "Invalid device key" } };
    }
  }

  if (!device.plant_id) {
    return { status: 409, body: { success: false, error: "Device is not linked to a plant" } };
  }

  const recordedAt = new Date().toISOString();
  const round = (n: number) => Math.round(n * 10) / 10;
  const lightPct =
    data.light === undefined
      ? null
      : Math.min(100, round(data.light > 100 ? data.light / 10 : data.light));

  const reading = {
    plant_id: device.plant_id,
    device_id: device.id,
    user_id: device.user_id,
    humidity: round(data.humidity),
    temperature: data.temperature === undefined ? null : round(data.temperature),
    light: lightPct,
    nutrients: data.nutrients === undefined ? null : round(data.nutrients),
    battery: data.battery === undefined ? null : Math.round(data.battery),
    recorded_at: recordedAt,
  };

  const { error: insertError } = await supabaseAdmin.from("readings").insert(reading);
  if (insertError) {
    console.error("ingest insert failed", insertError);
    return { status: 500, body: { success: false, error: "Could not store reading" } };
  }

  await supabaseAdmin
    .from("devices")
    .update({
      last_seen_at: recordedAt,
      status: "ativo",
      ...(reading.battery === null ? {} : { battery: reading.battery }),
    })
    .eq("id", device.id);

  // Alertas usam as faixas ideais reais da espécie da planta associada.
  const { data: plant } = await supabaseAdmin
    .from("plants")
    .select("id, name, species:species_id(*)")
    .eq("id", device.plant_id)
    .maybeSingle();

  let alertsCreated = 0;
  if (plant) {
    const species = plant.species as unknown as Record<string, number>;
    const bounds: Record<MetricKey, [number, number]> = {
      humidity: [species["humidity_min"]!, species["humidity_max"]!],
      light: [species["light_min"]!, species["light_max"]!],
      temperature: [species["temp_min"]!, species["temp_max"]!],
      nutrients: [species["nutrients_min"]!, species["nutrients_max"]!],
    };

    const alerts = [];
    for (const metric of ["humidity", "light", "temperature", "nutrients"] as MetricKey[]) {
      const value = reading[metric];
      if (value === null || value === undefined) continue; // sensor ausente não gera alerta
      const [min, max] = bounds[metric];
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
    if (alerts.length > 0) {
      await supabaseAdmin.from("alerts").insert(alerts);
      alertsCreated = alerts.length;
    }
  }

  return {
    status: 201,
    body: {
      success: true,
      deviceId: data.deviceId,
      humidity: reading.humidity,
      recordedAt,
      alerts: alertsCreated,
    },
  };
}

export function jsonResponse(result: IngestResult) {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
