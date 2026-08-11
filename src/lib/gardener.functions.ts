import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { streamText } from "ai";
import { z } from "zod";

const ChatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1),
  plantContext: z
    .object({
      name: z.string(),
      species: z.string(),
      humidity: z.number(),
      light: z.number(),
      temperature: z.number(),
      nutrients: z.number(),
      idealHumidity: z.string(),
      idealLight: z.string(),
      idealTemperature: z.string(),
      idealNutrients: z.string(),
    })
    .nullable()
    .optional(),
});

export const askGardener = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) {
      throw new Error("O jardineiro virtual está indisponível no momento.");
    }

    const p = data.plantContext;
    const context = p
      ? `Planta selecionada agora pelo usuário: ${p.name} (${p.species}). ` +
        `Umidade do solo: ${p.humidity}% (ideal ${p.idealHumidity}). ` +
        `Luminosidade: ${p.light}% (ideal ${p.idealLight}). ` +
        `Temperatura: ${p.temperature}°C (ideal ${p.idealTemperature}). ` +
        `Nutrientes no solo: ${p.nutrients}% (ideal ${p.idealNutrients}).`
      : "Nenhuma planta específica está selecionada no momento.";

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    try {
      const result = streamText({
        model: gateway("google/gemini-3.6-flash"),
        system:
          "Você é o jardineiro virtual do app Smart Garden. Converse em português do Brasil, de forma calorosa, prática e breve — como um jardineiro experiente e atencioso falando com o dono das plantas. Dê dicas de cuidado, rega, luz, adubação e pragas quando perguntado. Use no máximo 3 parágrafos curtos. " +
          context,
        messages: data.messages,
      });
      const text = await result.text;
      return {
        reply:
          text.trim() ||
          "Desculpe, não consegui pensar em uma resposta agora. Pode tentar de novo?",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("429")) {
        throw new Error("Muitas perguntas seguidas. Espere um minutinho e tente de novo.");
      }
      if (message.includes("402")) {
        throw new Error("Os créditos de IA do projeto acabaram. Recarregue para continuar.");
      }
      throw new Error("Não consegui falar com o jardineiro agora. Tente novamente.");
    }
  });
