import type OpenAI from "openai";
import { layoutCoverOverlay, type CoverTitleContext } from "@/lib/cover/cover-title";
import { normalizeHashtags } from "@/lib/hashtags";
import { usageFromCompletion, type OpenAICallUsage } from "@/lib/openai-usage";
import { complianceGenerationRules } from "./prompt";
import { rewriteCompliantText, rewriteHashtag } from "./rewrite";
import { scanCompliance } from "./scan";

export type ComplianceContent = {
  titles: [string, string, string];
  caption: string;
  hashtags: string[];
  coverTitle: string;
  coverSubtitle: string;
};

export type ComplianceResult = ComplianceContent & {
  usage: OpenAICallUsage[];
};

function collectHits(content: ComplianceContent) {
  return [
    ...content.titles.flatMap((title) => scanCompliance(title, { field: "title" })),
    ...scanCompliance(content.caption, { field: "caption" }),
    ...content.hashtags.flatMap((tag) => scanCompliance(tag, { field: "hashtag" })),
    ...scanCompliance(content.coverTitle, { field: "coverTitle" }),
    ...scanCompliance(content.coverSubtitle, { field: "coverSubtitle" }),
  ];
}

function localRewrite(content: ComplianceContent, coverContext: CoverTitleContext = {}): ComplianceContent {
  const titles = content.titles.map((title) => rewriteCompliantText(title, "title")) as [
    string,
    string,
    string,
  ];
  const caption = rewriteCompliantText(content.caption, "caption");
  const hashtags = normalizeHashtags(content.hashtags.map(rewriteHashtag));
  const cover = layoutCoverOverlay(
    rewriteCompliantText(content.coverTitle, "coverTitle"),
    rewriteCompliantText(content.coverSubtitle, "coverSubtitle"),
    titles,
    coverContext,
  );
  return { titles, caption, hashtags: [...hashtags], coverTitle: cover.title, coverSubtitle: cover.subtitle };
}

const rewriteSchema = {
  name: "xiaohongshu_compliance_rewrite",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["titles", "caption", "hashtags", "mainTitle", "subTitle"],
    properties: {
      titles: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string" },
      },
      caption: { type: "string" },
      hashtags: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: { type: "string" },
      },
      mainTitle: { type: "string" },
      subTitle: { type: "string" },
    },
  },
} as const;

async function modelRewrite(
  openai: OpenAI,
  model: string,
  content: ComplianceContent,
  coverContext: CoverTitleContext = {},
): Promise<{ content: ComplianceContent; usage: OpenAICallUsage[] }> {
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.4,
    response_format: { type: "json_schema", json_schema: rewriteSchema },
    messages: [
      {
        role: "system",
        content: `Rewrite only the risky sentences in this Xiaohongshu post into neutral, factual, personal experience. Keep dishes, facts, emoji count, and a natural spoken tone. Do not delete the thought — rewrite it. Keep required hashtags #baanying曼谷 and #曼谷必吃 exactly. COVER mainTitle 4–7 units, subTitle 4–9 units, keep EXACTLY 2 cover keywords from 曼谷/centralwOrld/泰餐/美食/必吃 plus KSP. 必吃 is allowed on the cover only, never as a post-title/caption claim. Never copy customer negatives such as 贵/难吃/踩雷/抽奖送东西 onto titles or cover; keep meaning as neutral wording, never as false praise. Do not truncate titles. Return JSON only. No analysis.
${complianceGenerationRules()}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          titles: content.titles,
          caption: content.caption,
          hashtags: content.hashtags,
          mainTitle: content.coverTitle,
          subTitle: content.coverSubtitle,
        }),
      },
    ],
  });
  const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Partial<ComplianceContent> & {
    mainTitle?: string;
    subTitle?: string;
  };
  const titles = parsed.titles?.map((title) => String(title ?? "").trim()).filter(Boolean) ?? [];
  const next: ComplianceContent = {
    titles: titles.length >= 3 ? [titles[0], titles[1], titles[2]] : content.titles,
    caption: String(parsed.caption ?? content.caption),
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : content.hashtags,
    coverTitle: String(parsed.mainTitle ?? parsed.coverTitle ?? content.coverTitle),
    coverSubtitle: String(parsed.subTitle ?? parsed.coverSubtitle ?? content.coverSubtitle),
  };
  return {
    content: localRewrite(next, coverContext),
    usage: [usageFromCompletion(completion, model, "compliance-rewrite")],
  };
}

export function scanGeneratedCompliance(content: ComplianceContent) {
  return collectHits(content);
}

export async function enforceXiaohongshuCompliance(options: {
  content: ComplianceContent;
  openai?: OpenAI;
  model?: string;
  coverContext?: CoverTitleContext;
}): Promise<ComplianceResult> {
  const usage: OpenAICallUsage[] = [];
  let next = localRewrite(options.content, options.coverContext);
  if (collectHits(next).length === 0) {
    return { ...next, usage };
  }

  if (options.openai && options.model) {
    try {
      const rewritten = await modelRewrite(options.openai, options.model, next, options.coverContext);
      usage.push(...rewritten.usage);
      next = rewritten.content;
    } catch {
      next = localRewrite(next, options.coverContext);
    }
  }

  next = localRewrite(next, options.coverContext);
  return { ...next, usage };
}
