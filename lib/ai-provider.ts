export type AiProviderId = "openai" | "modelark";

/** ModelArk unless AI_PROVIDER=openai is set on purpose. */
export function resolveAiProvider(): AiProviderId {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase() ?? "";
  if (!raw || raw === "modelark") return "modelark";
  if (raw === "openai") return "openai";
  throw new Error(`Unknown AI_PROVIDER. Use modelark or openai.`);
}
