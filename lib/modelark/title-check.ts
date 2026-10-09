import { titleSlotCounts } from "@/lib/parse-generated";
import { ModelArkError } from "@/lib/modelark/responses";
import type { OpenAICallUsage } from "@/lib/openai-usage";

export type ModelArkRetryResult = {
  text: string;
  usages: OpenAICallUsage[];
};

/**
 * Title-count failures are the only reason to ask the model once more.
 * An empty caption, illegal JSON, or a transport timeout stays on its own path.
 */
export function isModelArkTitleCountFailure(error: unknown) {
  if (!(error instanceof Error) || !error.message.startsWith("Incomplete model output:")) return false;
  if (!error.message.includes("caption=present") || !error.message.includes("stage=empty-title-filter")) return false;
  const titles = Number(error.message.match(/titles=(\d+)/)?.[1]);
  return Number.isInteger(titles) && titles < 3;
}

function logTitleSlots(log: (line: string) => void, text: string) {
  try {
    const slots = titleSlotCounts((JSON.parse(text) as { titles?: unknown }).titles);
    log(
      `[modelark] label=generate titles raw=${slots.raw} blank=${slots.blank} kept=${slots.kept} stage=empty-title-filter`,
    );
  } catch {
    log("[modelark] label=generate titles raw=0 blank=0 kept=0 stage=empty-title-filter");
  }
}

/** One optional title retry after a successful JSON parse. Does not invent titles. */
export async function withModelArkTitleCheck<T>(input: {
  text: string;
  recovered?: string;
  requestRetry: () => Promise<ModelArkRetryResult>;
  parseJson: (text: string) => void;
  parsePost: (text: string) => T;
  log?: (line: string) => void;
  observe?: (outputText: string, parseStatus: "json_ok" | "json_parse" | "business_failed") => void;
}): Promise<{ parsed: T; text: string; usages: OpenAICallUsage[]; recovered: string }> {
  const log = input.log ?? (() => {});
  const recovered = input.recovered ?? "";
  try {
    const parsed = input.parsePost(input.text);
    logTitleSlots(log, input.text);
    log(`[modelark] label=generate final=ok recovered=${recovered}`);
    return { parsed, text: input.text, usages: [], recovered };
  } catch (error) {
    if (!isModelArkTitleCountFailure(error)) throw error;
    const message = error instanceof Error ? error.message : "missing_fields";
    log(`[modelark] label=generate stage=missing_fields retry=1 ${message}`);
    const again = await input.requestRetry();
    try {
      input.parseJson(again.text);
      input.observe?.(again.text, "json_ok");
      const parsed = input.parsePost(again.text);
      logTitleSlots(log, again.text);
      const nextRecovered = recovered ? `${recovered}+missing_fields` : "missing_fields";
      log(`[modelark] label=generate final=ok recovered=${nextRecovered}`);
      return { parsed, text: again.text, usages: again.usages, recovered: nextRecovered };
    } catch (retryError) {
      if (retryError instanceof ModelArkError && retryError.stage === "json_parse") {
        input.observe?.(again.text, "json_parse");
      }
      if (retryError instanceof ModelArkError) {
        log(
          `[modelark] label=generate final=${retryError.stage} recovered= skeleton=${retryError.interpretation?.reason ?? ""}`,
        );
        throw retryError;
      }
      const detail = retryError instanceof Error ? retryError.message : "missing_fields";
      log(`[modelark] label=generate final=missing_fields recovered= ${detail}`);
      throw retryError;
    }
  }
}
