import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Cpu, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchPlants } from "@/lib/garden";
import {
  createDevice,
  fetchDevices,
  firmwareCode,
  removeDevice,
  updateDevice,
  type Device,
} from "@/lib/devices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dispositivos")({
  head: () => ({
    meta: [
      { title: "Dispositivos ESP32 | Smart Garden" },
      {
        name: "description",
        content:
          "Cadastre seu ESP32, associe a uma planta, calibre o sensor de umidade do solo e copie o firmware pronto.",
      },
      { property: "og:title", content: "Dispositivos ESP32 | Smart Garden" },
      {
        property: "og:description",
        content: "Associe o ESP32 a uma planta e envie leituras reais de umidade do solo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dispositivos,
});

function Dispositivos() {
  const qc = useQueryClient();
  const devices = useQuery({ queryKey: ["devices"], queryFn: fetchDevices });
  const plants = useQuery({ queryKey: ["plants"], queryFn: fetchPlants });
  const [baseUrl, setBaseUrl] = useState("https://smartgardens.lovable.app");

  useEffect(() => {
    if (typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const [deviceId, setDeviceId] = useState("SG-ESP32-001");
  const [plantId, setPlantId] = useState("");
  const [dryRaw, setDryRaw] = useState("3290");
  const [wetRaw, setWetRaw] = useState("1450");

  const refresh = () => void qc.invalidateQueries({ queryKey: ["devices"] });

  const create = useMutation({
    mutationFn: () =>
      createDevice({
        deviceId,
        plantId: plantId || null,
        dryRaw: Number(dryRaw),
        wetRaw: Number(wetRaw),
      }),
    onSuccess: () => {
      toast.success("Dispositivo cadastrado.");
      setPlantId("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Device> }) => updateDevice(id, data),
    onSuccess: () => {
      toast.success("Dispositivo atualizado.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeDevice(id),
    onSuccess: () => {
      toast.success("Dispositivo removido.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copiado.`);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link to="/painel" className="text-muted-foreground inline-flex items-center gap-2 text-sm">
        <ArrowLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      <h1 className="mt-6 flex items-center gap-2 text-3xl">
        <Cpu className="text-primary h-6 w-6" /> Dispositivos ESP32
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Cadastre o ESP32, associe a uma planta e o painel passa a mostrar as leituras reais do
        sensor de umidade do solo — no lugar das simuladas.
      </p>

      <section className="bg-card mt-8 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Novo dispositivo</h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="device-id">ID do dispositivo</Label>
            <Input
              id="device-id"
              required
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="SG-ESP32-001"
            />
          </div>
          <div className="space-y-2">
            <Label>Planta associada</Label>
            <Select value={plantId} onValueChange={setPlantId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha a planta" />
              </SelectTrigger>
              <SelectContent>
                {plants.data?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.species.common_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dry">Leitura SECO (0%)</Label>
            <Input id="dry" value={dryRaw} onChange={(e) => setDryRaw(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wet">Leitura MOLHADO (100%)</Label>
            <Input id="wet" value={wetRaw} onChange={(e) => setWetRaw(e.target.value)} />
          </div>
          <Button type="submit" disabled={create.isPending} className="sm:col-span-2">
            <Plus className="mr-1 h-4 w-4" /> Cadastrar dispositivo
          </Button>
        </form>
      </section>

      <section className="mt-8 space-y-6">
        {devices.data?.length === 0 && (
          <p className="text-muted-foreground text-sm">Nenhum dispositivo cadastrado ainda.</p>
        )}
        {devices.data?.map((d) => (
          <article key={d.id} className="bg-card rounded-xl border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{d.device_id}</p>
                <p className="text-muted-foreground text-xs">
                  {d.last_seen_at
                    ? `Último envio: ${new Date(d.last_seen_at).toLocaleString("pt-BR")}`
                    : "Ainda não enviou nenhuma leitura."}
                  {d.battery !== null && ` · bateria ${d.battery}%`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover dispositivo"
                onClick={() => del.mutate(d.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Planta associada</Label>
                <Select
                  value={d.plant_id ?? ""}
                  onValueChange={(v) => patch.mutate({ id: d.id, data: { plant_id: v } })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha a planta" />
                  </SelectTrigger>
                  <SelectContent>
                    {plants.data?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {p.species.common_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave de envio (x-device-key)</Label>
                <div className="flex gap-2">
                  <Input readOnly value={d.device_key} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Copiar chave"
                    onClick={() => void copy(d.device_key, "Chave")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">
                Código do ESP32 (Arduino) já configurado
              </summary>
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor={`url-${d.id}`} className="text-xs">
                    API_BASE_URL
                  </Label>
                  <Input
                    id={`url-${d.id}`}
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="max-w-xs font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copy(firmwareCode(d, baseUrl), "Código")}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copiar código
                  </Button>
                </div>
                <pre className="bg-secondary/60 max-h-96 overflow-auto rounded-lg p-4 text-[11px] leading-relaxed">
                  <code>{firmwareCode(d, baseUrl)}</code>
                </pre>
                <p className="text-muted-foreground text-xs">
                  Teste rápido do envio:{" "}
                  <code className="font-mono">
                    {`curl -X POST ${baseUrl}/api/public/ingest -H "content-type: application/json" -H "x-device-key: ${d.device_key}" -d '{"deviceId":"${d.device_id}","soilMoisture":58}'`}
                  </code>
                </p>
              </div>
            </details>
          </article>
        ))}
      </section>
    </main>
  );
}
