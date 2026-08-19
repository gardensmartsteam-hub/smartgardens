import { createFileRoute } from "@tanstack/react-router";
import { ingestReading, jsonResponse } from "@/lib/device-ingest.server";

// Endpoint oficial da ESP32.
// POST { "deviceId": "SG-ESP32-001", "humidity": 63 }
export const Route = createFileRoute("/api/public/device/reading")({
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
