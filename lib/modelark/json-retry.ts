import { ModelArkError } from "@/lib/modelark/responses";
import type { OpenAICallUsage } from "@/lib/openai-usage";

export type ModelArkJsonAttempt = {
  text: string;
  usages: OpenAICallUsage[];
};

/** Parse once. If that text is illegal JSON, ask for a schema-valid object one time. */
export async function withModelArkJsonRetry(input: {
  first: ModelArkJsonAttempt;
  requestRetry: () => Promise<ModelArkJsonAttempt>;
  parseJson: (text: string) => unknown;
  log?: (line: string) => void;
  observe?: (outputText: string, parseStatus: "json_parse") => void;
}): Promise<{ text: string; usages: OpenAICallUsage[]; recovered: "" | "json_parse" }> {
  const log = input.log ?? (() => {});
  try {
    input.parseJson(input.first.text);
    log(`[modelark] label=generate json=ok attempts=${input.first.usages.length}`);
    return { text: input.first.text, usages: input.first.usages, recovered: "" };
  } catch (error) {
    if (!(error instanceof ModelArkError) || error.stage !== "json_parse") throw error;
    input.observe?.(input.first.text, "json_parse");
    log(
      `[modelark] label=generate stage=json_parse retry=1 error=${error.reason} skeleton=${error.interpretation?.reason ?? ""}`,
    );
    const again = await input.requestRetry();
    const usages = [...input.first.usages, ...again.usages];
    try {
      input.parseJson(again.text);
    } catch (retryError) {
      input.observe?.(again.text, "json_parse");
      const stage = retryError instanceof ModelArkError ? retryError.stage : "json_parse";
      const skeleton = retryError instanceof ModelArkError ? retryError.interpretation?.reason ?? "" : "";
      log(`[modelark] label=generate final=${stage} attempts=${usages.length} recovered= skeleton=${skeleton}`);
      throw retryError;
    }
    log(`[modelark] label=generate json=ok attempts=${usages.length} recovered=json_parse`);
    return { text: again.text, usages, recovered: "json_parse" };
  }
}
