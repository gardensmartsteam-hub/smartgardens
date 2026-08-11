import { supabase } from "@/integrations/supabase/client";

export type Species = {
  id: string;
  common_name: string;
  scientific_name: string;
  humidity_min: number;
  humidity_max: number;
  light_min: number;
  light_max: number;
  temp_min: number;
  temp_max: number;
  nutrients_min: number;
  nutrients_max: number;
  care_tip: string;
};

export type Reading = {
  id: string;
  plant_id: string;
  humidity: number;
  light: number;
  temperature: number;
  nutrients: number;
  recorded_at: string;
};

export type Plant = {
  id: string;
  name: string;
  location: string;
  created_at: string;
  species: Species;
};

export type Alert = {
  id: string;
  plant_id: string;
  metric: string;
  severity: string;
  message: string;
  resolved: boolean;
  created_at: string;
};

export const METRICS = [
  { key: "humidity", label: "Umidade do solo", unit: "%", min: "humidity_min", max: "humidity_max" },
  { key: "light", label: "Luminosidade", unit: "%", min: "light_min", max: "light_max" },
  { key: "temperature", label: "Temperatura", unit: "°C", min: "temp_min", max: "temp_max" },
  { key: "nutrients", label: "Nutrientes", unit: "%", min: "nutrients_min", max: "nutrients_max" },
] as const;

export type MetricKey = (typeof METRICS)[number]["key"];

export function range(species: Species, metric: MetricKey): [number, number] {
  switch (metric) {
    case "humidity":
      return [species.humidity_min, species.humidity_max];
    case "light":
      return [species.light_min, species.light_max];
    case "temperature":
      return [species.temp_min, species.temp_max];
    case "nutrients":
      return [species.nutrients_min, species.nutrients_max];
  }
}

export function statusOf(value: number, [min, max]: [number, number]) {
  if (value < min) return "baixo" as const;
  if (value > max) return "alto" as const;
  return "ideal" as const;
}

function jitter(min: number, max: number, drift: number) {
  const mid = (min + max) / 2;
  const span = (max - min) / 2;
  const raw = mid + (Math.random() * 2 - 1) * span * 1.35 + drift;
  return Math.round(raw * 10) / 10;
}

export function simulate(species: Species, hoursAgo = 0): Omit<Reading, "id" | "plant_id"> {
  const wave = Math.sin(hoursAgo / 4) * 3;
  return {
    humidity: Math.max(
      0,
      Math.min(100, jitter(species.humidity_min, species.humidity_max, -hoursAgo * 0.35)),
    ),
    light: Math.max(0, Math.min(100, jitter(species.light_min, species.light_max, wave))),
    temperature: jitter(species.temp_min, species.temp_max, wave * 0.4),
    nutrients: Math.max(
      0,
      Math.min(100, jitter(species.nutrients_min, species.nutrients_max, -hoursAgo * 0.1)),
    ),
    recorded_at: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
  };
}

const METRIC_LABEL: Record<MetricKey, string> = {
  humidity: "Umidade do solo",
  light: "Luminosidade",
  temperature: "Temperatura",
  nutrients: "Nutrientes",
};

const ADVICE: Record<MetricKey, { baixo: string; alto: string }> = {
  humidity: { baixo: "Hora de regar.", alto: "Solo encharcado — segure a rega." },
  light: { baixo: "Leve para um lugar mais claro.", alto: "Muito sol direto, procure meia-sombra." },
  temperature: { baixo: "Ambiente frio demais.", alto: "Ambiente quente demais, arejar ajuda." },
  nutrients: { baixo: "Faltando adubo no substrato.", alto: "Excesso de adubo, pause a adubação." },
};

export function evaluate(plant: Plant, reading: Omit<Reading, "id" | "plant_id">) {
  const out: { metric: MetricKey; severity: string; message: string }[] = [];
  for (const metric of ["humidity", "light", "temperature", "nutrients"] as MetricKey[]) {
    const bounds = range(plant.species, metric);
    const value = reading[metric];
    const status = statusOf(value, bounds);
    if (status === "ideal") continue;
    const unit = metric === "temperature" ? "°C" : "%";
    const distance =
      status === "baixo" ? (bounds[0] - value) / (bounds[0] || 1) : (value - bounds[1]) / bounds[1];
    out.push({
      metric,
      severity: distance > 0.25 ? "critico" : "aviso",
      message: `${plant.name}: ${METRIC_LABEL[metric]} em ${value}${unit} (ideal ${bounds[0]}–${bounds[1]}${unit}). ${ADVICE[metric][status]}`,
    });
  }
  return out;
}

export async function fetchSpecies(): Promise<Species[]> {
  const { data, error } = await supabase.from("species").select("*").order("common_name");
  if (error) throw error;
  return (data ?? []) as Species[];
}

export async function fetchPlants(): Promise<Plant[]> {
  const { data, error } = await supabase
    .from("plants")
    .select("id, name, location, created_at, species:species_id(*)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Plant[];
}

export async function fetchReadings(plantId: string): Promise<Reading[]> {
  const { data, error } = await supabase
    .from("readings")
    .select("*")
    .eq("plant_id", plantId)
    .order("recorded_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    humidity: Number(r.humidity),
    light: Number(r.light),
    temperature: Number(r.temperature),
    nutrients: Number(r.nutrients),
  })) as Reading[];
}

export async function fetchLatestReadings(): Promise<Record<string, Reading>> {
  const { data, error } = await supabase
    .from("readings")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const map: Record<string, Reading> = {};
  for (const row of data ?? []) {
    if (!map[row.plant_id]) {
      map[row.plant_id] = {
        ...row,
        humidity: Number(row.humidity),
        light: Number(row.light),
        temperature: Number(row.temperature),
        nutrients: Number(row.nutrients),
      } as Reading;
    }
  }
  return map;
}

export async function fetchAlerts(): Promise<Alert[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Alert[];
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sessão expirada. Entre novamente.");
  return data.user.id;
}

async function pushAlerts(plant: Plant, reading: Omit<Reading, "id" | "plant_id">) {
  const userId = await currentUserId();
  const found = evaluate(plant, reading);
  if (found.length === 0) return;
  await supabase
    .from("alerts")
    .insert(found.map((a) => ({ ...a, plant_id: plant.id, user_id: userId })));
}

export async function createPlant(input: { name: string; speciesId: string; location: string }) {
  const userId = await currentUserId();
  const { data: plantRow, error } = await supabase
    .from("plants")
    .insert({
      user_id: userId,
      species_id: input.speciesId,
      name: input.name,
      location: input.location,
    })
    .select("id, name, location, created_at, species:species_id(*)")
    .single();
  if (error) throw error;

  const plant = plantRow as unknown as Plant;
  const history = Array.from({ length: 24 }, (_, i) => simulate(plant.species, 23 - i));
  const { error: rErr } = await supabase
    .from("readings")
    .insert(history.map((r) => ({ ...r, plant_id: plant.id, user_id: userId })));
  if (rErr) throw rErr;

  const last = history[history.length - 1];
  if (last) await pushAlerts(plant, last);
  return plant;
}

export async function addReading(plant: Plant) {
  const userId = await currentUserId();
  const reading = simulate(plant.species, 0);
  const { error } = await supabase
    .from("readings")
    .insert({ ...reading, plant_id: plant.id, user_id: userId });
  if (error) throw error;
  await pushAlerts(plant, reading);
  return reading;
}

export async function resolveAlert(id: string) {
  const { error } = await supabase.from("alerts").update({ resolved: true }).eq("id", id);
  if (error) throw error;
}

export async function removePlant(id: string) {
  const { error } = await supabase.from("plants").delete().eq("id", id);
  if (error) throw error;
}
