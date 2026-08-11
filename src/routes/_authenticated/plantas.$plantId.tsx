import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, FileDown, Send, Sprout } from "lucide-react";
import { toast } from "sonner";
import {
  fetchAlerts,
  fetchPlants,
  fetchReadings,
  range,
  statusOf,
  type MetricKey,
  type Plant,
  type Reading,
} from "@/lib/garden";
import { buildPlantReport, slugify } from "@/lib/plant-report";
import { askGardener } from "@/lib/gardener.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/plantas/$plantId")({
  head: () => ({
    meta: [
      { title: "Detalhes da planta | Smart Garden" },
      {
        name: "description",
        content:
          "Histórico de umidade, luminosidade e nutrientes com as faixas ideais da espécie e o jardineiro virtual.",
      },
      { property: "og:title", content: "Detalhes da planta | Smart Garden" },
      {
        property: "og:description",
        content: "Gráficos com limites ideais e conversa com o jardineiro virtual.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlantPage,
});

const CHART_METRICS: { key: MetricKey; label: string; unit: string; color: string }[] = [
  { key: "humidity", label: "Umidade do solo", unit: "%", color: "var(--chart-1)" },
  { key: "light", label: "Luminosidade", unit: "%", color: "var(--chart-3)" },
  { key: "nutrients", label: "Nutrientes no solo", unit: "%", color: "var(--chart-2)" },
  { key: "temperature", label: "Temperatura", unit: "°C", color: "var(--chart-4)" },
];

function PlantPage() {
  const { plantId } = Route.useParams();
  const plants = useQuery({ queryKey: ["plants"], queryFn: fetchPlants });
  const readings = useQuery({
    queryKey: ["readings", plantId],
    queryFn: () => fetchReadings(plantId),
  });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: fetchAlerts });

  const plant = plants.data?.find((p) => p.id === plantId);
  const data = useMemo(
    () =>
      (readings.data ?? []).map((r) => ({
        hora: new Date(r.recorded_at).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        humidity: r.humidity,
        light: r.light,
        nutrients: r.nutrients,
        temperature: r.temperature,
      })),
    [readings.data],
  );

  if (!plant) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-muted-foreground text-sm">
          {plants.isLoading ? "Carregando…" : "Planta não encontrada."}
        </p>
      </main>
    );
  }

  const last = readings.data?.[readings.data.length - 1];
  const context: PlantContext | null = last
    ? {
        name: plant.name,
        species: plant.species.common_name,
        humidity: last.humidity,
        light: last.light,
        temperature: last.temperature,
        nutrients: last.nutrients,
        idealHumidity: `${plant.species.humidity_min}–${plant.species.humidity_max}%`,
        idealLight: `${plant.species.light_min}–${plant.species.light_max}%`,
        idealTemperature: `${plant.species.temp_min}–${plant.species.temp_max}°C`,
        idealNutrients: `${plant.species.nutrients_min}–${plant.species.nutrients_max}%`,
      }
    : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link
        to="/painel"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">{plant.name}</h1>
          <p className="text-muted-foreground text-sm italic">
            {plant.species.common_name} · {plant.species.scientific_name} · {plant.location}
          </p>
        </div>
        <ReportButton
          plant={plant}
          readings={readings.data ?? []}
          alerts={(alerts.data ?? []).filter((a) => a.plant_id === plant.id)}
          context={context}
        />
      </header>
      <div>
        <p className="bg-secondary text-secondary-foreground mt-4 rounded-lg p-4 text-sm">
          <Sprout className="mr-2 inline h-4 w-4 text-primary" />
          {plant.species.care_tip}
        </p>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        {CHART_METRICS.map((m) => {
          const [min, max] = range(plant.species, m.key);
          const value = last?.[m.key];
          const status = value === undefined ? "ideal" : statusOf(value, [min, max]);
          const values = data.map((d) => d[m.key]);
          const lower = Math.min(min, ...values, Infinity);
          const upper = Math.max(max, ...values, -Infinity);
          return (
            <div key={m.key} className="bg-card rounded-xl border p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base">{m.label}</h2>
                <span className="text-sm font-semibold">
                  {value === undefined ? "—" : `${value}${m.unit}`}{" "}
                  <span className="text-muted-foreground text-xs font-normal">({status})</span>
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                Faixa ideal da espécie: {min}–{max}
                {m.unit}
              </p>
              <div className="mt-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="hora" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      domain={[Math.floor(lower - 5), Math.ceil(upper + 5)]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v}${m.unit}`, m.label]}
                    />
                    <ReferenceArea
                      y1={min}
                      y2={max}
                      fill="var(--primary)"
                      fillOpacity={0.1}
                      stroke="var(--primary)"
                      strokeOpacity={0.35}
                      strokeDasharray="4 4"
                      label={{ value: "ideal", position: "insideTopLeft", fontSize: 10 }}
                    />
                    <Area
                      type="monotone"
                      dataKey={m.key}
                      stroke={m.color}
                      fill={m.color}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </section>

      <Jardineiro context={context} />
    </main>
  );
}

type Msg = { role: "user" | "assistant"; content: string };

type PlantContext = {
  name: string;
  species: string;
  humidity: number;
  light: number;
  temperature: number;
  nutrients: number;
  idealHumidity: string;
  idealLight: string;
  idealTemperature: string;
  idealNutrients: string;
};

function ReportButton({
  plant,
  readings,
  alerts,
  context,
}: {
  plant: Plant;
  readings: Reading[];
  alerts: { id: string; plant_id: string; metric: string; severity: string; message: string; created_at: string; resolved: boolean }[];
  context: PlantContext | null;
}) {
  const ask = useServerFn(askGardener);
  const [loading, setLoading] = useState(false);

  async function download() {
    if (loading || readings.length === 0) return;
    setLoading(true);
    const toastId = toast.loading("Montando o relatório em PDF…");
    let recommendation =
      "O jardineiro virtual não respondeu a tempo. Compare as leituras com as faixas ideais da tabela acima.";
    try {
      const res = await ask({
        data: {
          messages: [
            {
              role: "user",
              content:
                "Escreva um resumo de recomendações de cuidado para esta planta, com base nas leituras atuais e nas faixas ideais. Use no máximo 3 parágrafos curtos, em texto corrido, sem markdown.",
            },
          ],
          plantContext: context,
        },
      });
      recommendation = res.reply;
    } catch {
      // mantém o texto de fallback no PDF
    }

    try {
      const doc = buildPlantReport({ plant, readings, alerts, recommendation });
      doc.save(`smart-garden-${slugify(plant.name)}.pdf`);
      toast.success("Relatório baixado.", { id: toastId });
    } catch {
      toast.error("Não consegui gerar o PDF agora.", { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={download} disabled={loading || readings.length === 0} variant="outline">
      <FileDown className="mr-2 h-4 w-4" />
      {loading ? "Gerando PDF…" : "Baixar relatório PDF"}
    </Button>
  );
}

function Jardineiro({ context }: { context: PlantContext | null }) {
  const ask = useServerFn(askGardener);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await ask({ data: { messages: next, plantContext: context } });
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não consegui responder agora.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: 99999 }));
    }
  }

  return (
    <section className="bg-card mt-10 rounded-xl border p-5">
      <h2 className="text-lg">Jardineiro virtual</h2>
      <p className="text-muted-foreground text-sm">
        Ele já sabe as leituras atuais desta planta. Pergunte sobre rega, luz, adubo ou pragas.
      </p>

      <div ref={listRef} className="mt-4 max-h-80 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Ex.: “Ela está com as pontas amareladas, o que faço?”
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "bg-primary text-primary-foreground ml-auto max-w-[85%] rounded-lg px-3 py-2 text-sm"
                : "bg-secondary text-secondary-foreground mr-auto max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
            }
          >
            {m.content}
          </div>
        ))}
        {loading && <p className="text-muted-foreground text-sm">Pensando…</p>}
      </div>

      <form onSubmit={send} className="mt-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escreva sua pergunta"
        />
        <Button type="submit" size="icon" disabled={loading} aria-label="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
}
