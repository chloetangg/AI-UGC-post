export type AiProviderId = "openai" | "modelark";

export function resolveAiProvider(): AiProviderId {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase() ?? "";
  if (!raw || raw === "openai") return "openai";
  if (raw === "modelark") return "modelark";
  throw new Error(`Unknown AI_PROVIDER. Use openai or modelark.`);
}
