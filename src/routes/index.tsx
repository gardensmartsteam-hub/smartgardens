import { createFileRoute, Link } from "@tanstack/react-router";
import { Leaf, Droplets, Sun, Sprout, MessageCircleHeart } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Garden — cuide das suas plantas com sensores" },
      {
        name: "description",
        content:
          "Acompanhe umidade, luz, temperatura e nutrientes das suas plantas, receba alertas e converse com o jardineiro virtual.",
      },
      { property: "og:title", content: "Smart Garden — cuide das suas plantas com sensores" },
      {
        property: "og:description",
        content:
          "Painel de sensores, catálogo com 52 plantas de casa e apartamento e um jardineiro virtual sempre por perto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const features = [
  {
    icon: Droplets,
    title: "Sensores em tempo real",
    text: "Umidade, luminosidade, temperatura e nutrientes de cada vaso, com limites ideais no gráfico.",
  },
  {
    icon: Sprout,
    title: "52 espécies catalogadas",
    text: "As plantas mais comuns em casas e apartamentos, cada uma com faixas ideais próprias.",
  },
  {
    icon: MessageCircleHeart,
    title: "Jardineiro virtual",
    text: "Um assistente que conhece a planta selecionada e responde no seu ritmo, em português.",
  },
];

function Home() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 text-lg font-semibold">
          <Leaf className="h-5 w-5 text-primary" />
          Smart Garden
        </span>
        <Button asChild variant="ghost">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-10 pb-20">
        <p className="text-sm tracking-widest text-accent uppercase">Versão 4.0</p>
        <h1 className="mt-4 max-w-2xl text-5xl leading-[1.05] text-balance sm:text-6xl">
          Suas plantas avisam quando precisam de você.
        </h1>
        <p className="text-muted-foreground mt-6 max-w-xl text-lg">
          O Smart Garden lê os sensores de cada vaso, compara com a faixa ideal da espécie e chama
          um jardineiro virtual quando algo sai do lugar.
        </p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link to="/auth">Começar meu jardim</Link>
          </Button>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-card rounded-xl border p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h2 className="mt-4 text-lg">{f.title}</h2>
              <p className="text-muted-foreground mt-2 text-sm">{f.text}</p>
            </div>
          ))}
        </div>

        <div className="bg-secondary mt-16 flex items-center gap-4 rounded-xl p-6">
          <Sun className="text-accent h-8 w-8 shrink-0" />
          <p className="text-secondary-foreground text-sm">
            Cada gráfico mostra as faixas ideais de umidade, luminosidade e nutrientes da espécie —
            fica fácil ver, num relance, quando a planta saiu do conforto.
          </p>
        </div>
      </section>
    </main>
  );
}
