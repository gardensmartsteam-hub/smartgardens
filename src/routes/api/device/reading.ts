import { createFileRoute } from "@tanstack/react-router";
import { ingestReading, jsonResponse } from "@/lib/device-ingest.server";

// Alias de conveniência para /api/public/device/reading (mesmo contrato).
export const Route = createFileRoute("/api/device/reading")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const key =
          request.headers.get("x-device-key") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        return jsonResponse(await ingestReading(raw, key));
      },
    },
  },
});
