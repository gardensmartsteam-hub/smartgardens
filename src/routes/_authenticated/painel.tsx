import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Leaf, Plus, AlertTriangle, LogOut, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  addReading,
  createPlant,
  fetchAlerts,
  fetchLatestReadings,
  fetchPlants,
  fetchSpecies,
  range,
  removePlant,
  resolveAlert,
  statusOf,
  type MetricKey,
  type Plant,
} from "@/lib/garden";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel do jardim | Smart Garden" },
      {
        name: "description",
        content: "Veja os sensores de cada planta, alertas abertos e o estado do seu jardim.",
      },
      { property: "og:title", content: "Painel do jardim | Smart Garden" },
      { property: "og:description", content: "Sensores, alertas e cuidados das suas plantas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

const STATUS_STYLE: Record<string, string> = {
  ideal: "bg-primary/10 text-primary",
  baixo: "bg-accent/15 text-accent",
  alto: "bg-destructive/10 text-destructive",
};

function Painel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const plants = useQuery({ queryKey: ["plants"], queryFn: fetchPlants });
  const latest = useQuery({ queryKey: ["latest"], queryFn: fetchLatestReadings });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: fetchAlerts });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["plants"] });
    void qc.invalidateQueries({ queryKey: ["latest"] });
    void qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  const readMutation = useMutation({
    mutationFn: (plant: Plant) => addReading(plant),
    onSuccess: () => {
      toast.success("Nova leitura registrada.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removePlant(id),
    onSuccess: () => {
      toast.success("Planta removida.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => resolveAlert(id),
    onSuccess: refresh,
  });

  async function sair() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-lg font-semibold">
          <Leaf className="h-5 w-5 text-primary" />
          Smart Garden
        </span>
        <div className="flex items-center gap-2">
          <NovaPlanta onDone={refresh} />
          <Button variant="ghost" size="icon" onClick={sair} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {alerts.data && alerts.data.length > 0 && (
        <section className="mt-8 space-y-2">
          <h2 className="text-sm tracking-widest text-accent uppercase">Alertas abertos</h2>
          {alerts.data.map((a) => (
            <div
              key={a.id}
              className="bg-card flex items-start gap-3 rounded-lg border p-4 text-sm"
            >
              <AlertTriangle
                className={
                  a.severity === "critico" ? "text-destructive h-4 w-4 mt-0.5" : "text-accent h-4 w-4 mt-0.5"
                }
              />
              <p className="flex-1">{a.message}</p>
              <button
                className="text-muted-foreground hover:text-foreground text-xs"
                onClick={() => resolveMutation.mutate(a.id)}
              >
                resolver
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="mt-10">
        <h1 className="text-3xl">Meu jardim</h1>
        {plants.isLoading && <p className="text-muted-foreground mt-4 text-sm">Carregando…</p>}
        {plants.data?.length === 0 && (
          <p className="text-muted-foreground mt-4 text-sm">
            Nenhuma planta ainda. Adicione a primeira e o sensor começa a registrar.
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {plants.data?.map((plant) => {
            const reading = latest.data?.[plant.id];
            return (
              <article key={plant.id} className="bg-card rounded-xl border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      to="/plantas/$plantId"
                      params={{ plantId: plant.id }}
                      className="text-lg font-semibold hover:underline"
                    >
                      {plant.name}
                    </Link>
                    <p className="text-muted-foreground text-xs italic">
                      {plant.species.common_name} · {plant.species.scientific_name}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">{plant.location}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Nova leitura"
                      onClick={() => readMutation.mutate(plant)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover planta"
                      onClick={() => deleteMutation.mutate(plant.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {(["humidity", "light", "temperature", "nutrients"] as MetricKey[]).map((m) => {
                    const bounds = range(plant.species, m);
                    const value = reading?.[m];
                    const status = value === undefined ? "ideal" : statusOf(value, bounds);
                    const unit = m === "temperature" ? "°C" : "%";
                    const label = {
                      humidity: "Umidade",
                      light: "Luz",
                      temperature: "Temp.",
                      nutrients: "Nutrientes",
                    }[m];
                    return (
                      <div key={m} className="bg-secondary/60 rounded-lg px-3 py-2">
                        <p className="text-muted-foreground text-xs">{label}</p>
                        <p className="font-semibold">
                          {value === undefined ? "—" : `${value}${unit}`}
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          ideal {bounds[0]}–{bounds[1]}
                          {unit}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] ${STATUS_STYLE[status]}`}
                        >
                          {status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function NovaPlanta({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("Sala");
  const [speciesId, setSpeciesId] = useState("");
  const species = useQuery({ queryKey: ["species"], queryFn: fetchSpecies });

  const mutation = useMutation({
    mutationFn: () => createPlant({ name, speciesId, location }),
    onSuccess: () => {
      toast.success("Planta adicionada com 24h de leituras simuladas.");
      setOpen(false);
      setName("");
      setSpeciesId("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected = useMemo(
    () => species.data?.find((s) => s.id === speciesId),
    [species.data, speciesId],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> Nova planta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar planta</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!speciesId) {
              toast.error("Escolha a espécie.");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="apelido">Apelido</Label>
            <Input
              id="apelido"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Jibinha da estante"
            />
          </div>
          <div className="space-y-2">
            <Label>Espécie</Label>
            <Select value={speciesId} onValueChange={setSpeciesId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha entre 52 espécies" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {species.data?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.common_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-muted-foreground text-xs">
                {selected.care_tip} Umidade ideal {selected.humidity_min}–{selected.humidity_max}%,
                nutrientes {selected.nutrients_min}–{selected.nutrients_max}%.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="local">Onde ela fica</Label>
            <Input id="local" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            Adicionar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
