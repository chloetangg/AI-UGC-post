import OpenAI from "openai";
import {
  GenerateContentError,
  parseGenerateContentRequest,
  parseGenerateContentResponse,
  sanitizeErrorMessage,
} from "@/lib/generate-content/parse";
import {
  buildGenerateContentSystemPrompt,
  buildGenerateContentUserPrompt,
  generateContentJsonSchema,
} from "@/lib/generate-content/prompt";
import { generateHashtags } from "@/lib/generate-hashtags/generate";
import { ensureCaptionEmojis, fixFruitEmojisInTitles } from "@/lib/caption-emoji";
import { attachOfficialLocationTime, resolveDiningBranch, stripGeneratedLocationTime } from "@/lib/locations";
import { enforceXiaohongshuCompliance } from "@/lib/compliance";
import {
  aggregateGenerationCost,
  logGenerationCost,
  usageFromCompletion,
} from "@/lib/openai-usage";
import type { GenerateContentErrorCode } from "@/lib/generate-content/types";

export const maxDuration = 60;

function jsonError(code: GenerateContentErrorCode, message: string, status: number) {
  return Response.json({ error: sanitizeErrorMessage(message), code }, { status });
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new GenerateContentError("missing_api_key", "Missing OPENAI_API_KEY", 500);
  }
  return new OpenAI({ apiKey });
}

export async function POST(request: Request) {
  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new GenerateContentError("invalid_request", "Request body must be valid JSON", 400);
    }

    const payload = parseGenerateContentRequest(raw);
    const openai = getClient();
    const model = process.env.OPENAI_MODEL || "gpt-4o";

    let completion: OpenAI.Chat.Completions.ChatCompletion;
    try {
      completion = await openai.chat.completions.create({
        model,
        temperature: 0.8,
        response_format: {
          type: "json_schema",
          json_schema: generateContentJsonSchema,
        },
        messages: [
          { role: "system", content: buildGenerateContentSystemPrompt() },
          { role: "user", content: buildGenerateContentUserPrompt(payload) },
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "OpenAI API failure";
      throw new GenerateContentError("openai_error", message, 502);
    }

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      throw new GenerateContentError("invalid_ai_response", "Empty AI response", 502);
    }

    try {
      const generated = parseGenerateContentResponse(text);
      const story = ensureCaptionEmojis(stripGeneratedLocationTime(generated.body));
      let hashtags = generated.hashtags;
      const usageCalls = [usageFromCompletion(completion, model, "caption-1")];
      try {
        const hashtagResult = await generateHashtags(openai, model, {
          caption: story,
          dishes: [payload.experience.favoriteDish].filter(Boolean),
          recommendReasons: payload.experience.recommendTo,
        });
        hashtags = hashtagResult.hashtags;
        usageCalls.push(...hashtagResult.usage);
      } catch (error) {
        const message = error instanceof Error ? error.message : "OpenAI API failure";
        throw new GenerateContentError("openai_error", message, 502);
      }
      const compliant = await enforceXiaohongshuCompliance({
        content: {
          titles: fixFruitEmojisInTitles(generated.titles),
          caption: story,
          hashtags,
          coverTitle: "",
          coverSubtitle: "",
        },
        openai,
        model,
      });
      usageCalls.push(...compliant.usage);
      const located = attachOfficialLocationTime(
        ensureCaptionEmojis(compliant.caption),
        resolveDiningBranch(payload.experience.branch),
      );
      logGenerationCost(aggregateGenerationCost(usageCalls));
      return Response.json({
        titles: fixFruitEmojisInTitles(compliant.titles),
        body: located.caption,
        hashtags: compliant.hashtags,
        locationFormat: located.format,
      });
    } catch (error) {
      if (error instanceof GenerateContentError) throw error;
      throw new GenerateContentError("invalid_ai_response", "Invalid AI response", 502);
    }
  } catch (error) {
    if (error instanceof GenerateContentError) {
      return jsonError(error.code, error.message, error.status);
    }
    const message = error instanceof Error ? error.message : "Generation failed";
    return jsonError("openai_error", message, 500);
  }
}
