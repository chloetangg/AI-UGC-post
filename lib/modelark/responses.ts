import type { OpenAICallUsage } from "@/lib/openai-usage";

const ENDPOINT = "https://ark.ap-southeast.bytepluses.com/api/v3/responses";
export const MODELARK_MODEL = "dola-seed-2-1-turbo-260628";
const READ_TIMEOUT_MS = 50_000;
const INITIAL_OUTPUT_TOKENS = 2048;
const RAISED_OUTPUT_TOKENS = 4096;

export type ModelArkFailureStage =
  | "connect"
  | "read_timeout"
  | "http"
  | "incomplete"
  | "failed"
  | "missing_output"
  | "json_parse";

export type ModelArkContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

export type ModelArkMessage = {
  role: "system" | "user";
  content: ModelArkContentPart[];
};

export type ModelArkJsonSchema = {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
};

export class ModelArkError extends Error {
  status: number;
  stage: ModelArkFailureStage;
  reason: string;
  interpretation?: ModelArkInterpretation;

  constructor(status: number, message: string, stage: ModelArkFailureStage, reason = "") {
    super(message);
    this.name = "ModelArkError";
    this.status = status;
    this.stage = stage;
    this.reason = reason;
  }
}

function redact(text: string) {
  return text
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9_\-]{24,}/g, "[redacted]");
}

function hintForStatus(status: number) {
  if (status === 401) return "ModelArk rejected the API key.";
  if (status === 403) return "ModelArk refused this key or model.";
  if (status === 404) return "ModelArk endpoint or model was not found.";
  if (status === 429) return "ModelArk rate limit or quota was reached.";
  if (status >= 500) return "ModelArk returned a server error.";
  return `ModelArk request failed (${status}).`;
}

export function classifyTransportError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "ModelArk request failed";
  if (name === "TimeoutError" || /aborted due to timeout/i.test(message)) {
    return new ModelArkError(0, "ModelArk read timed out before a completed response.", "read_timeout", "client_timeout");
  }
  if (name === "AbortError") {
    return new ModelArkError(0, "ModelArk request was aborted before a completed response.", "read_timeout", "aborted");
  }
  return new ModelArkError(0, redact(message), "connect");
}

export function modelArkOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  const texts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as { type?: unknown; content?: unknown };
    if (row.type !== "message" || !Array.isArray(row.content)) continue;
    for (const part of row.content) {
      if (!part || typeof part !== "object") continue;
      const block = part as { type?: unknown; text?: unknown };
      if (block.type === "output_text" && typeof block.text === "string") texts.push(block.text);
    }
  }
  return texts.join("").trim();
}

function usageFromPayload(payload: unknown, model: string, label: string): OpenAICallUsage | null {
  const usage =
    payload && typeof payload === "object" ? (payload as { usage?: unknown }).usage : undefined;
  const row = usage && typeof usage === "object" ? (usage as Record<string, unknown>) : null;
  if (!row) return null;
  const details =
    row.input_tokens_details && typeof row.input_tokens_details === "object"
      ? (row.input_tokens_details as { cached_tokens?: unknown })
      : null;
  const inputTokens = typeof row.input_tokens === "number" ? row.input_tokens : 0;
  const outputTokens = typeof row.output_tokens === "number" ? row.output_tokens : 0;
  const totalTokens = typeof row.total_tokens === "number" ? row.total_tokens : inputTokens + outputTokens;
  return {
    label,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens: typeof details?.cached_tokens === "number" ? details.cached_tokens : 0,
    imageInputTokens: 0,
    usageMissing: typeof row.input_tokens !== "number" || typeof row.output_tokens !== "number",
  };
}

function reasoningTokens(payload: unknown) {
  if (!payload || typeof payload !== "object") return 0;
  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return 0;
  const details = (usage as { output_tokens_details?: unknown }).output_tokens_details;
  if (!details || typeof details !== "object") return 0;
  const value = (details as { reasoning_tokens?: unknown }).reasoning_tokens;
  return typeof value === "number" ? value : 0;
}

export type ModelArkInterpretation = {
  text: string;
  model: string;
  status: string;
  reason: string;
  outputChars: number;
  usage: OpenAICallUsage | null;
  reasoningTokens: number;
  formatType: string;
};

export function modelArkTextFormat(schema: ModelArkJsonSchema) {
  return {
    type: "json_schema" as const,
    name: schema.name,
    strict: schema.strict ?? true,
    schema: schema.schema,
  };
}

export function echoedFormatType(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const text = (payload as { text?: unknown }).text;
  if (!text || typeof text !== "object") return "";
  const format = (text as { format?: unknown }).format;
  if (!format || typeof format !== "object") return "";
  const type = (format as { type?: unknown }).type;
  return typeof type === "string" ? type : "";
}

export function interpretModelArkPayload(payload: unknown, fallbackModel: string, label: string): ModelArkInterpretation {
  if (!payload || typeof payload !== "object") {
    throw new ModelArkError(502, "ModelArk response was not a JSON object.", "missing_output");
  }
  const row = payload as Record<string, unknown>;
  const status = typeof row.status === "string" ? row.status : "";
  const incomplete =
    row.incomplete_details && typeof row.incomplete_details === "object"
      ? (row.incomplete_details as { reason?: unknown }).reason
      : "";
  const reason = typeof incomplete === "string" ? incomplete : "";
  const errorObject =
    row.error && typeof row.error === "object"
      ? (row.error as { code?: unknown; message?: unknown })
      : null;
  const model = typeof row.model === "string" ? row.model : fallbackModel;
  const text = modelArkOutputText(payload);
  const usage = usageFromPayload(payload, model, label);
  const base = {
    text,
    model,
    status,
    reason,
    outputChars: text.length,
    usage,
    reasoningTokens: reasoningTokens(payload),
    formatType: echoedFormatType(payload),
  };

  if (status === "failed" || (errorObject && status !== "completed")) {
    const detail = [errorObject?.code, errorObject?.message].filter((item) => typeof item === "string").join(": ");
    const failure = new ModelArkError(502, redact(`ModelArk response failed. ${detail}`.trim()), "failed", detail);
    failure.interpretation = base;
    throw failure;
  }
  if (status !== "completed") {
    const why = reason || status || "missing";
    const failure = new ModelArkError(
      502,
      `ModelArk response was not completed (${why}). output_chars=${text.length}`,
      "incomplete",
      why,
    );
    failure.interpretation = base;
    throw failure;
  }
  if (!text) {
    throw new ModelArkError(502, "ModelArk response did not include output_text.", "missing_output");
  }
  return base;
}

export function jsonStructureSkeleton(text: string, index: number) {
  const start = Math.max(0, index - 48);
  return text
    .slice(start, index + 48)
    .replace(/[^\s[\]{}":,0-9.\\-]/g, "x");
}

export function parseModelArkJsonText(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof SyntaxError ? error.message : "invalid JSON";
    const indexMatch = /position (\d+)/.exec(message);
    const index = indexMatch ? Number(indexMatch[1]) : 0;
    const failure = new ModelArkError(502, `ModelArk output was not valid JSON. ${message}`, "json_parse", message);
    const at = text.codePointAt(index) ?? 0;
    failure.interpretation = {
      text: "",
      model: "",
      status: "completed",
      reason: `${jsonStructureSkeleton(text, index)} at=U+${at.toString(16).toUpperCase().padStart(4, "0")}`,
      outputChars: text.length,
      usage: null,
      reasoningTokens: 0,
      formatType: "",
    };
    throw failure;
  }
}

function logAttempt(entry: Record<string, string | number>) {
  const line = Object.entries(entry)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  console.info(`[modelark] ${line}`);
}

function httpError(status: number, payload: unknown) {
  let detail = "";
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown; code?: unknown } }).error;
    detail = [error?.code, error?.message].filter((item) => typeof item === "string").join(": ");
  }
  return new ModelArkError(status, redact(`${hintForStatus(status)} ${detail}`.trim()), "http", detail);
}

export function shouldRaiseOutputCap(reason: string) {
  return reason === "max_output_tokens" || reason === "length";
}

function isRetryableHttp(error: ModelArkError) {
  return error.stage === "connect" || (error.stage === "http" && [429, 502, 503, 504].includes(error.status));
}

export async function createModelArkResponse(options: {
  messages: ModelArkMessage[];
  schema?: ModelArkJsonSchema;
  label: string;
}) {
  const apiKey = process.env.MODELARK_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new ModelArkError(500, "Missing MODELARK_API_KEY", "http");
  }
  const model = process.env.MODELARK_MODEL?.trim() || MODELARK_MODEL;
  const usages: OpenAICallUsage[] = [];
  let outputCap = INITIAL_OUTPUT_TOKENS;
  let raisedCap = false;
  let retriedTransport = false;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const started = Date.now();
    let response: Response;
    try {
      const body: Record<string, unknown> = {
        model,
        stream: false,
        thinking: { type: "disabled" },
        max_output_tokens: outputCap,
        input: options.messages,
      };
      if (options.schema) {
        body.text = { format: modelArkTextFormat(options.schema) };
      }
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(READ_TIMEOUT_MS),
      });
    } catch (error) {
      const classified = classifyTransportError(error);
      logAttempt({
        label: options.label,
        attempt,
        elapsed_ms: Date.now() - started,
        http: 0,
        status: "",
        incomplete: classified.reason,
        output_chars: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        reasoning_tokens: 0,
        stage: classified.stage,
      });
      if (!retriedTransport && classified.stage === "connect") {
        retriedTransport = true;
        continue;
      }
      throw classified;
    }

    const raw = await response.text();
    let payload: unknown = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const error = httpError(response.status, payload);
      logAttempt({
        label: options.label,
        attempt,
        elapsed_ms: Date.now() - started,
        http: response.status,
        status: "",
        incomplete: "",
        output_chars: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        reasoning_tokens: 0,
        stage: error.stage,
      });
      if (!retriedTransport && isRetryableHttp(error)) {
        retriedTransport = true;
        continue;
      }
      throw error;
    }

    try {
      const interpreted = interpretModelArkPayload(payload, model, options.label);
      if (interpreted.usage) usages.push(interpreted.usage);
      logAttempt({
        label: options.label,
        attempt,
        elapsed_ms: Date.now() - started,
        http: response.status,
        status: interpreted.status,
        format: interpreted.formatType,
        incomplete: interpreted.reason,
        output_chars: interpreted.outputChars,
        input_tokens: interpreted.usage?.inputTokens ?? 0,
        output_tokens: interpreted.usage?.outputTokens ?? 0,
        total_tokens: interpreted.usage?.totalTokens ?? 0,
        reasoning_tokens: interpreted.reasoningTokens,
        stage: "completed",
      });
      return {
        text: interpreted.text,
        model: interpreted.model,
        usage: interpreted.usage ?? {
          label: options.label,
          model: interpreted.model,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cachedInputTokens: 0,
          imageInputTokens: 0,
          usageMissing: true,
        },
        usages,
      };
    } catch (error) {
      const failure = error instanceof ModelArkError ? error : new ModelArkError(502, "ModelArk response could not be read.", "missing_output");
      const interpreted = failure.interpretation;
      if (interpreted?.usage) usages.push(interpreted.usage);
      logAttempt({
        label: options.label,
        attempt,
        elapsed_ms: Date.now() - started,
        http: response.status,
        status: interpreted?.status ?? "",
        format: interpreted?.formatType ?? "",
        incomplete: failure.reason,
        output_chars: interpreted?.outputChars ?? 0,
        input_tokens: interpreted?.usage?.inputTokens ?? 0,
        output_tokens: interpreted?.usage?.outputTokens ?? 0,
        total_tokens: interpreted?.usage?.totalTokens ?? 0,
        reasoning_tokens: interpreted?.reasoningTokens ?? 0,
        stage: failure.stage,
      });
      if (
        !raisedCap &&
        failure.stage === "incomplete" &&
        shouldRaiseOutputCap(failure.reason)
      ) {
        raisedCap = true;
        outputCap = RAISED_OUTPUT_TOKENS;
        continue;
      }
      throw failure;
    }
  }

  throw new ModelArkError(502, "ModelArk request was not completed.", "incomplete");
}
