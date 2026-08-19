import { createFileRoute } from "@tanstack/react-router";
import { ingestReading, jsonResponse } from "@/lib/device-ingest.server";

// Compatibilidade com o firmware V1 antigo: aceita `soilMoisture` e `airHumidity`
// e converte para o contrato atual (`humidity`).
export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        let mapped = raw;
        try {
          const body = JSON.parse(raw) as Record<string, unknown>;
          if (body["humidity"] === undefined && body["soilMoisture"] !== undefined) {
            body["humidity"] = body["soilMoisture"];
          }
          delete body["soilMoisture"];
          delete body["airHumidity"];
          mapped = JSON.stringify(body);
        } catch {
          // deixa a validação central responder com "Invalid JSON"
        }
        const key =
          request.headers.get("x-device-key") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        return jsonResponse(await ingestReading(mapped, key));
      },
    },
  },
});
