import type OpenAI from "openai";
import {
  normalizeHashtags,
  parseHashtagOnlyOutput,
  type GeneratedHashtags,
} from "@/lib/hashtags";
import {
  buildHashtagSystemPrompt,
  buildHashtagUserPrompt,
  type HashtagGenerateInput,
} from "@/lib/generate-hashtags/prompt";
import { usageFromCompletion, type OpenAICallUsage } from "@/lib/openai-usage";

const MAX_HASHTAG_ATTEMPTS = 3;

export type HashtagGenerateResult = {
  hashtags: GeneratedHashtags;
  usage: OpenAICallUsage[];
};

export async function generateHashtags(
  openai: OpenAI,
  model: string,
  input: HashtagGenerateInput,
): Promise<HashtagGenerateResult> {
  let lastTags: string[] = [];
  const usage: OpenAICallUsage[] = [];

  for (let attempt = 0; attempt < MAX_HASHTAG_ATTEMPTS; attempt += 1) {
    const completion = await openai.chat.completions.create({
      model,
      temperature: attempt === 0 ? 0.85 : 0.6,
      messages: [
        { role: "system", content: buildHashtagSystemPrompt() },
        { role: "user", content: buildHashtagUserPrompt(input) },
      ],
    });
    usage.push(usageFromCompletion(completion, model, `hashtags-${attempt + 1}`));

    const text = completion.choices[0]?.message?.content ?? "";
    const parsed = parseHashtagOnlyOutput(text);
    if (parsed) return { hashtags: parsed, usage };
    lastTags = text.match(/#[^\s#]+/g) ?? lastTags;
  }

  return { hashtags: normalizeHashtags(lastTags), usage };
}
