import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENDPOINT = "https://ark.ap-southeast.bytepluses.com/api/v3/responses";
const MODEL = "dola-seed-2-1-turbo-260628";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key]?.trim()) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function redact(text: string) {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]")
    .replace(/("(?:api[_-]?key|authorization|token)"\s*:\s*")[^"]+/gi, '$1[redacted]');
}

function hintForStatus(status: number) {
  if (status === 401) return "401：密钥被拒绝。检查 MODELARK_API_KEY 是否有效，且没有多余空格。";
  if (status === 403) return "403：没有权限。确认该密钥可以调用这个模型，并且模型已在 ModelArk 开通。";
  if (status === 404) return "404：地址或模型不存在。确认 Base URL、/responses 和模型名 dola-seed-2-1-turbo-260628。";
  if (status === 429) return "429：请求过于频繁或额度用尽。稍后重试，不要换一个写死的密钥。";
  if (status >= 500) return `${status}：ModelArk 服务端错误。请求格式已发出，问题在服务端。`;
  return `${status}：请求未被接受。`;
}

function describe(value: unknown, depth = 0): string {
  if (depth > 3) return "…";
  if (Array.isArray(value)) {
    return `[${value.slice(0, 4).map((item) => describe(item, depth + 1)).join(", ")}]`;
  }
  if (value && typeof value === "object") {
    return `{ ${Object.entries(value)
      .slice(0, 12)
      .map(([key, item]) => `${key}: ${describe(item, depth + 1)}`)
      .join(", ")} }`;
  }
  return typeof value;
}

function outputTexts(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return [];
  const texts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as { type?: unknown; content?: unknown };
    if (row.type !== "message" || !Array.isArray(row.content)) continue;
    for (const part of row.content) {
      if (!part || typeof part !== "object") continue;
      const block = part as { type?: unknown; text?: unknown };
      if (block.type === "output_text" && typeof block.text === "string" && block.text.trim()) {
        texts.push(block.text.trim());
      }
    }
  }
  return texts;
}

function usageLine(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("usage" in payload)) return "usage: 响应里没有 usage";
  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return "usage: 响应里没有 usage";
  const row = usage as Record<string, unknown>;
  const input = row.input_tokens;
  const output = row.output_tokens;
  const total = row.total_tokens;
  if (typeof input !== "number" && typeof output !== "number" && typeof total !== "number") {
    return `usage 字段存在，但没有 input_tokens / output_tokens / total_tokens。形状：${describe(usage)}`;
  }
  return `usage input_tokens=${String(input ?? "n/a")} output_tokens=${String(output ?? "n/a")} total_tokens=${String(total ?? "n/a")}`;
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  const apiKey = process.env.MODELARK_API_KEY?.trim() ?? "";
  if (!apiKey) {
    console.error("配置错误：缺少 MODELARK_API_KEY。请把它写在 .env.local 或当前环境里。没有发送请求，也不会使用写死的密钥。");
    process.exitCode = 1;
    return;
  }

  const body = {
    model: MODEL,
    stream: false,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "请用简体中文写一句自然、真实的小红书泰餐体验文案，并只返回文案正文。",
          },
        ],
      },
    ],
  };

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`请求失败：无法连接 ${ENDPOINT}。${redact(message)}`);
    process.exitCode = 1;
    return;
  }

  const elapsedMs = Date.now() - started;
  const raw = await response.text();
  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  console.log(`http_status=${response.status}`);
  console.log(`elapsed_ms=${elapsedMs}`);
  console.log(`model=${MODEL}`);

  if (!response.ok) {
    console.error(hintForStatus(response.status));
    const errorText = payload ? describe(payload) : redact(raw).slice(0, 500);
    console.error(`error_body=${errorText}`);
    process.exitCode = 1;
    return;
  }

  const texts = outputTexts(payload);
  console.log(`response_shape=${describe(payload)}`);
  console.log(usageLine(payload));
  if (texts.length === 0) {
    console.error("HTTP 成功，但没有在 output[].content[] 里找到 type=output_text 的文本。上面的 response_shape 是实际结构，没有按 Chat Completions 去猜。");
    process.exitCode = 1;
    return;
  }

  console.log("success=true");
  console.log("--- text ---");
  console.log(texts.join("\n"));
}

main();
