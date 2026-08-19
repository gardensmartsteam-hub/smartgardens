import { supabase } from "@/integrations/supabase/client";

export type Device = {
  id: string;
  device_id: string;
  device_key: string;
  name: string;
  status: string;
  require_key: boolean;
  plant_id: string | null;
  dry_raw: number;
  wet_raw: number;
  battery: number | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Um dispositivo é considerado online se enviou algo na última meia hora. */
export function deviceOnline(device: Pick<Device, "last_seen_at">) {
  if (!device.last_seen_at) return false;
  return Date.now() - new Date(device.last_seen_at).getTime() < 30 * 60_000;
}

export function deviceStatusLabel(device: Pick<Device, "last_seen_at">) {
  if (!device.last_seen_at) return "Aguardando primeira leitura";
  return deviceOnline(device) ? "Online" : "Sem sinal recente";
}

export async function fetchDevices(): Promise<Device[]> {
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Device[];
}

export async function createDevice(input: {
  deviceId: string;
  name: string;
  plantId: string | null;
  dryRaw: number;
  wetRaw: number;
}) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Sessão expirada. Entre novamente.");
  const { error } = await supabase.from("devices").insert({
    user_id: userData.user.id,
    device_id: input.deviceId.trim(),
    name: input.name.trim() || "Sensor do Jardim",
    plant_id: input.plantId,
    dry_raw: input.dryRaw,
    wet_raw: input.wetRaw,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Já existe um dispositivo com esse identificador.");
    throw new Error("Não consegui cadastrar o dispositivo agora.");
  }
}

export async function updateDevice(id: string, patch: Partial<Device>) {
  const { error } = await supabase.from("devices").update(patch).eq("id", id);
  if (error) throw new Error("Não consegui atualizar o dispositivo.");
}

export async function removeDevice(id: string) {
  const { error } = await supabase.from("devices").delete().eq("id", id);
  if (error) throw new Error("Não consegui remover o dispositivo.");
}

export function firmwareCode(
  device: {
    device_id: string;
    device_key: string;
    require_key: boolean;
    dry_raw: number;
    wet_raw: number;
  },
  apiBaseUrl: string,
) {
  const keyLines = device.require_key
    ? `\n// Chave exclusiva deste dispositivo (não é credencial administrativa)\nconst char* DEVICE_KEY = "${device.device_key}";\n`
    : "";
  const keyHeader = device.require_key
    ? `  http.addHeader("x-device-key", DEVICE_KEY);\n`
    : "";

  return `#include <WiFi.h>
#include <HTTPClient.h>

// ---------- Rede Wi-Fi que o ESP32 vai usar ----------
const char* WIFI_SSID     = "Malaphaia";
const char* WIFI_PASSWORD = "Malaphaia123";

// ---------- Backend (HTTPS público, nunca localhost ou 127.0.0.1) ----------
const char* API_URL = "${apiBaseUrl}/api/public/device/reading";

// ---------- Identificação do dispositivo ----------
const char* DEVICE_ID = "${device.device_id}";
${keyLines}
// ---------- Sensor de umidade do solo ----------
const int SOIL_SENSOR_PIN = 34;   // GPIO analógico
const int SENSOR_SECO     = ${device.dry_raw};  // leitura no ar/terra seca -> 0%
const int SENSOR_MOLHADO  = ${device.wet_raw};  // leitura em terra molhada -> 100%

const unsigned long INTERVALO_MS = 60UL * 1000UL;

int lerUmidadeSolo() {
  long soma = 0;
  for (int i = 0; i < 10; i++) { soma += analogRead(SOIL_SENSOR_PIN); delay(20); }
  int raw = soma / 10;
  int pct = map(raw, SENSOR_SECO, SENSOR_MOLHADO, 0, 100);
  return constrain(pct, 0, 100);
}

void conectarWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando ao Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println(" conectado! IP: " + WiFi.localIP().toString());
}

void enviarLeitura(int humidity) {
  if (WiFi.status() != WL_CONNECTED) conectarWiFi();

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
${keyHeader}
  String payload = String("{\\"deviceId\\":\\"") + DEVICE_ID +
                   "\\",\\"humidity\\":" + String(humidity) + "}";

  int status = http.POST(payload);
  Serial.printf("POST -> %d\\n", status);
  Serial.println(http.getString());
  http.end();
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);          // 0..4095
  analogSetPinAttenuation(SOIL_SENSOR_PIN, ADC_11db);
  conectarWiFi();
}

void loop() {
  int umidade = lerUmidadeSolo();
  Serial.printf("Umidade do solo: %d%%\\n", umidade);
  enviarLeitura(umidade);
  delay(INTERVALO_MS);
}
`;
}
