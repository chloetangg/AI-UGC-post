import type OpenAI from "openai";
import { costFromTokens, pricingForModel } from "@/lib/openai-pricing";

export type OpenAICallUsage = {
  label: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  imageInputTokens: number;
  usageMissing: boolean;
};

export type GenerationCostReport = {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  imageInputTokens: number;
  inputCost: number;
  outputCost: number;
  imageInputCost: number;
  totalCost: number;
  usageMissingCalls: number;
};

export function usageFromCompletion(
  completion: OpenAI.Chat.Completions.ChatCompletion,
  fallbackModel: string,
  label: string,
): OpenAICallUsage {
  const usage = completion.usage;
  return {
    label,
    model: completion.model || fallbackModel,
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    cachedInputTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
    imageInputTokens: usage?.prompt_tokens_details?.image_tokens ?? 0,
    usageMissing: !usage,
  };
}

function costForCall(call: OpenAICallUsage) {
  const pricing = pricingForModel(call.model);
  const cached = Math.min(call.cachedInputTokens, call.inputTokens);
  const billedInput = Math.max(call.inputTokens - cached, 0);
  const inputCost =
    costFromTokens(billedInput, pricing.inputPerMillion) +
    costFromTokens(cached, pricing.cachedInputPerMillion);
  const outputCost = costFromTokens(call.outputTokens, pricing.outputPerMillion);
  const imageInputCost = costFromTokens(call.imageInputTokens, pricing.inputPerMillion);
  return { inputCost, outputCost, imageInputCost, totalCost: inputCost + outputCost };
}

export function aggregateGenerationCost(calls: OpenAICallUsage[]): GenerationCostReport {
  const models = [...new Set(calls.map((call) => call.model).filter(Boolean))];
  const totals = calls.reduce(
    (acc, call) => {
      const cost = costForCall(call);
      acc.inputTokens += call.inputTokens;
      acc.outputTokens += call.outputTokens;
      acc.totalTokens += call.totalTokens;
      acc.cachedInputTokens += call.cachedInputTokens;
      acc.imageInputTokens += call.imageInputTokens;
      acc.inputCost += cost.inputCost;
      acc.outputCost += cost.outputCost;
      acc.imageInputCost += cost.imageInputCost;
      acc.totalCost += cost.totalCost;
      if (call.usageMissing) acc.usageMissingCalls += 1;
      return acc;
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedInputTokens: 0,
      imageInputTokens: 0,
      inputCost: 0,
      outputCost: 0,
      imageInputCost: 0,
      totalCost: 0,
      usageMissingCalls: 0,
    },
  );

  return {
    model: models.join(", ") || "unknown",
    calls: calls.length,
    ...totals,
  };
}

function usd(amount: number) {
  return `$${amount.toFixed(6)}`;
}

export function formatGenerationCostLog(report: GenerationCostReport) {
  const lines = [
    "Generation Cost:",
    `Model: ${report.model}`,
    `Input Tokens: ${report.inputTokens}`,
    `Output Tokens: ${report.outputTokens}`,
    `Total Tokens: ${report.totalTokens}`,
    `Input Cost: ${usd(report.inputCost)}`,
    `Output Cost: ${usd(report.outputCost)}`,
    `Total Cost: ${usd(report.totalCost)}`,
  ];

  if (report.imageInputTokens > 0) {
    lines.splice(
      5,
      0,
      `Image Input Tokens: ${report.imageInputTokens}`,
      `Image Input Cost: ${usd(report.imageInputCost)}`,
    );
  }

  lines.splice(2, 0, `Calls: ${report.calls}`);

  if (report.usageMissingCalls > 0) {
    lines.push(`Missing usage on ${report.usageMissingCalls} call(s); those tokens were recorded as 0.`);
  }

  return lines.join("\n");
}

export function logGenerationCost(report: GenerationCostReport) {
  console.log(formatGenerationCostLog(report));
}
