import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { applyBrandSpelling, pickBrandSpelling } from "@/lib/brand-spelling";
import { ensureCaptionEmojis, fixFruitEmojisInTitles } from "@/lib/caption-emoji";
import {
  buildSystemPrompt,
  buildUserPrompt,
  generatePostJsonSchema,
  humanStyleForInput,
  type GenerateRequestBody,
} from "@/lib/generate-prompt";
import { insertGeneration } from "@/lib/generations";
import { upsertSubmission } from "@/lib/submissions";
import { resolveAnalyticsSession, trackServerEvent } from "@/lib/analytics/server";
import { normalizeHashtags } from "@/lib/hashtags";
import { resolveGenerationContext } from "@/lib/generation/context";
import { DeploymentMismatchError } from "@/lib/deployment/config";
import { assertDeploymentOutput } from "@/lib/deployment/isolation";
import {
  finalizeOfficialLocationTime,
  planLocationTime,
  scrubForeignBranchFacts,
  stripGeneratedLocationTime,
} from "@/lib/locations";
import { parseGeneratedContent } from "@/lib/parse-generated";
import {
  classifyCoverHookType,
  ensureEvidenceLedCopy,
  ensureGroundedHeadlineCopy,
  previousPrimaryExperienceId,
} from "@/lib/content-evidence";
import { layoutCoverOverlay } from "@/lib/cover/cover-title";
import { selectOneValidSubtitle } from "@/lib/cover/subtitle-units";
import { aggregateGenerationCost, logGenerationCost, usageFromCompletion, type OpenAICallUsage } from "@/lib/openai-usage";
import { resolveAiProvider } from "@/lib/ai-provider";
import { MODELARK_JSON_RETRY_HINT, MODELARK_OUTPUT_APPENDIX, MODELARK_TITLE_RETRY_HINT, modelArkPostSchema, modelArkRewriteSchema } from "@/lib/modelark/post-schema";
import { withModelArkJsonRetry } from "@/lib/modelark/json-retry";
import { createModelArkResponse, ModelArkError, parseModelArkJsonText, type ModelArkContentPart } from "@/lib/modelark/responses";
import { withModelArkTitleCheck } from "@/lib/modelark/title-check";
import { ensureTitleFormats } from "@/lib/title-formats";
import { enforceCustomerEvidence } from "@/lib/customer-evidence";
import { separateOverlappingHeadlines } from "@/lib/headline-overlap";
import { separateHeadlinesFromNote } from "@/lib/title-insight";
import { enforceXiaohongshuCompliance } from "@/lib/compliance";
import { ensureGenerationVariation, planGenerationVariation, type GenerationMemory } from "@/lib/generation-variation";
import { ensureContentLock } from "@/lib/content-lock";
import { createGenerationDiagnostics, generationDiagnosticsEnabled } from "@/lib/generation/diagnostics";

export const maxDuration = 60;

const MAX_IMAGES = 5;

function errorDetail(error: unknown) {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  return parts.filter(Boolean).join(" | ");
}

function isOpenAIConnectionError(error: unknown, detail: string) {
  return (
    error instanceof OpenAI.APIConnectionError ||
    /connection error|fetch failed|econnreset|enotfound|etimedout|cert|certificate|ssl/i.test(detail)
  );
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return new OpenAI({ apiKey, maxRetries: 1, timeout: 60_000 });
}

async function fileToImagePart(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length) return null;
  let output: Buffer = buffer;
  let mime = file.type || "image/jpeg";
  if (buffer.length > 300_000) {
    try {
      const sharp = (await import("sharp")).default;
      output = await sharp(buffer)
        .rotate()
        .resize(640, 640, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 62 })
        .toBuffer();
      mime = "image/jpeg";
    } catch {
      // Keep the original bytes if the photo cannot be re-encoded.
    }
  }
  return {
    type: "image_url" as const,
    image_url: {
      url: `data:${mime};base64,${output.toString("base64")}`,
      detail: "low" as const,
    },
  };
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const generationId = randomUUID();
  let trace = createGenerationDiagnostics({
    generationId,
    provider: "openai",
    model: "",
    enabled: false,
  });
  let providerName = "OpenAI";
  try {
    const form = await request.formData();
    const rawPayload = form.get("payload");
    if (typeof rawPayload !== "string") {
      return Response.json({ error: "Missing payload" }, { status: 400 });
    }

    const payload = JSON.parse(rawPayload) as GenerateRequestBody;
    payload.contentLanguage = "zh-CN";
    const generationContext = resolveGenerationContext({
      campaignId: payload.campaignId,
      brandId: payload.brandId,
      branchId: payload.branchId,
      branch: payload.branch,
    });
    payload.brandId = generationContext.brandId;
    payload.branchId = generationContext.branchId;
    payload.campaignId = generationContext.campaignId;
    payload.branch = generationContext.branch.surveyValue as GenerateRequestBody["branch"];
    const locationPlan = planLocationTime({
      branch: payload.branch,
      placement: payload.requiredLocationPlacement,
      format: payload.requiredLocationFormat,
      previousPlacement: payload.previousLocationPlacement,
      previousFormat: payload.previousLocationFormat,
      recentFormats: payload.previousLocationFormats,
      inlineStyle: payload.requiredInlineLocationStyle,
      inlineSlot: payload.requiredInlineLocationSlot,
    });
    payload.requiredLocationPlacement = locationPlan.placement;
    payload.requiredLocationFormat = locationPlan.format;
    payload.requiredInlineLocationStyle = locationPlan.inlineStyle;
    payload.requiredInlineLocationSlot = locationPlan.inlineSlot;
    const analyticsSessionId = payload.analyticsSessionId?.trim() || "";
    await trackServerEvent(
      "form_submit",
      { source: "generate_api", formType: "baan-ying-ugc" },
      analyticsSessionId,
    );

    const photos = form
      .getAll("photos")
      .filter((item): item is File => typeof item !== "string")
      .slice(0, MAX_IMAGES);

    const imageParts = (
      await Promise.all(
        photos.map(async (photo, index) => {
          const part = await fileToImagePart(photo);
          const pieces: Array<
            | { type: "text"; text: string }
            | { type: "image_url"; image_url: { url: string; detail: "low" } }
          > = [{ type: "text", text: `Photo ${index + 1} (selectedPhotoIndex ${index}):` }];
          if (part) pieces.push(part);
          return pieces;
        }),
      )
    ).flat();

    const provider = resolveAiProvider();
    providerName = provider === "modelark" ? "ModelArk" : "OpenAI";
    const openai = provider === "openai" ? getClient() : null;
    const model =
      provider === "modelark"
        ? process.env.MODELARK_MODEL?.trim() || "dola-seed-2-1-turbo-260628"
        : process.env.OPENAI_MODEL || "gpt-4o";
    trace = createGenerationDiagnostics({
      generationId,
      provider,
      model,
      enabled: generationDiagnosticsEnabled(),
    });
    const brandSpelling = pickBrandSpelling(generationContext.branch);
    const previousTitles = payload.previousTitles ?? [];
    const humanStyle = humanStyleForInput(payload);
    const systemPrompt = buildSystemPrompt(payload.contentStrategy, payload.brandContext, payload.branch);
    const userPrompt = buildUserPrompt(payload, brandSpelling);
    let text = "";
    let modelArkRecovered = "";
    let requestModel: ((hint?: string) => ReturnType<typeof createModelArkResponse>) | null = null;
    const generationUsage: OpenAICallUsage[] = [];
    let complianceComplete: ((system: string, user: string) => Promise<{ text: string; usage: OpenAICallUsage }>) | undefined;

    if (provider === "modelark") {
      const userContent: ModelArkContentPart[] = [
        { type: "input_text", text: `${userPrompt}\n\n${MODELARK_OUTPUT_APPENDIX}` },
      ];
      for (const part of imageParts) {
        if (part.type === "text") userContent.push({ type: "input_text", text: part.text });
        else userContent.push({ type: "input_image", image_url: part.image_url.url });
      }
      const request = (hint = "") =>
        createModelArkResponse({
          label: "generate",
          schema: modelArkPostSchema,
          messages: [
            { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
            {
              role: "user",
              content: hint ? [...userContent, { type: "input_text", text: hint }] : userContent,
            },
          ],
        });
      requestModel = request;
      const generated = await withModelArkJsonRetry({
        first: await request(),
        requestRetry: () => request(MODELARK_JSON_RETRY_HINT),
        parseJson: parseModelArkJsonText,
        log: (line) => console.info(line),
        observe: (outputText, parseStatus) => trace.recordRaw(outputText, parseStatus),
      });
      text = generated.text;
      generationUsage.push(...generated.usages);
      modelArkRecovered = generated.recovered;
      complianceComplete = async (system, user) => {
        const rewritten = await createModelArkResponse({
          label: "compliance-rewrite",
          schema: modelArkRewriteSchema,
          messages: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: `${system}\nReturn captionParagraphs as separate strings. Do not put a line break inside a string.`,
                },
              ],
            },
            { role: "user", content: [{ type: "input_text", text: user }] },
          ],
        });
        const parsed = parseModelArkJsonText(rewritten.text) as {
          titles?: unknown;
          caption?: unknown;
          captionParagraphs?: unknown;
          hashtags?: unknown;
          mainTitle?: unknown;
          subTitle?: unknown;
        };
        const paragraphs = Array.isArray(parsed.captionParagraphs)
          ? parsed.captionParagraphs.map((item) => String(item ?? "").trim()).filter(Boolean)
          : [];
        return {
          text: JSON.stringify({
            titles: parsed.titles,
            caption: paragraphs.join("\n\n") || String(parsed.caption ?? ""),
            hashtags: parsed.hashtags,
            mainTitle: parsed.mainTitle,
            subTitle: parsed.subTitle,
          }),
          usage: rewritten.usage,
        };
      };
    } else {
      const completion = await openai!.chat.completions.create({
        model,
        temperature: 0.95,
        response_format: {
          type: "json_schema",
          json_schema: generatePostJsonSchema,
        },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [{ type: "text", text: userPrompt }, ...imageParts],
          },
        ],
      });
      text = completion.choices[0]?.message?.content ?? "";
      generationUsage.push(usageFromCompletion(completion, model, "generate"));
    }
    const enjoyMost = [
      ...payload.enjoyMost.filter((item) => item !== "其他"),
      payload.enjoyMostOther?.trim() ?? "",
    ].filter(Boolean);
    const recommendTo = [
      ...payload.recommendTo.filter((item) => item !== "其他"),
      payload.recommendToOther?.trim() ?? "",
    ].filter(Boolean);
    const coverContext = {
      branch: payload.branch,
      dishes: [
        ...payload.recommendedDishes.filter((dish) => dish !== "Others"),
        payload.recommendedDishOther.trim(),
      ].filter(Boolean),
      previousCoverTitle: payload.previousCoverTitle,
      previousCoverHookType: classifyCoverHookType(payload.previousCoverTitle ?? ""),
      previousPrimaryExperience: previousPrimaryExperienceId(
        {
          diningNote: payload.diningExperienceNote,
          dishes: [
            ...payload.recommendedDishes.filter((dish) => dish !== "Others"),
            payload.recommendedDishOther.trim(),
          ].filter(Boolean),
          enjoyMost,
          recommendTo,
          visitFrequency: payload.visitFrequency,
          previousCoverTitle: payload.previousCoverTitle,
        },
        payload.previousTitles ?? [],
      ),
      previousTitleAngle: classifyCoverHookType(payload.previousTitle ?? ""),
      variantIndex: payload.variantIndex,
      kspId: payload.suggestedKspId,
      contentAngleId: payload.suggestedContentAngle,
      diningNote: payload.diningExperienceNote,
      mealAmount: payload.totalMealExpense,
      enjoyMost,
      recommendTo,
      visitFrequency: payload.visitFrequency,
      customerType: payload.customerType,
    };
    const parsePost = (raw: string) =>
      parseGeneratedContent(
        raw,
        photos.length || payload.photoCount || 1,
        payload.previousCoverTemplateId || "",
        coverContext,
      );
    const diningNote = payload.diningExperienceNote ?? "";
    const snap = (
      stage: string,
      before: { titles: readonly string[]; caption: string },
      after: { titles: readonly string[]; caption: string },
    ) => {
      trace.snapshot(stage, { titles: [...before.titles], caption: before.caption }, { titles: [...after.titles], caption: after.caption }, diningNote);
    };
    let parsed;
    if (provider === "modelark" && requestModel) {
      trace.recordRaw(text, "json_ok");
      const checked = await withModelArkTitleCheck({
        text,
        recovered: modelArkRecovered,
        requestRetry: () => requestModel!(MODELARK_TITLE_RETRY_HINT),
        parseJson: parseModelArkJsonText,
        parsePost,
        log: (line) => console.info(line),
        observe: (outputText, parseStatus) => trace.recordRaw(outputText, parseStatus),
      });
      parsed = checked.parsed;
      text = checked.text;
      generationUsage.push(...checked.usages);
      modelArkRecovered = checked.recovered;
    } else {
      trace.recordRaw(text, "received");
      parsed = parsePost(text);
    }
    snap("parseGeneratedContent", { titles: [], caption: "" }, { titles: parsed.titles, caption: parsed.caption });

    const titleOptions = {
      style: humanStyle.primaryStyle,
      note: payload.diningExperienceNote,
    };
    const formatted = fixFruitEmojisInTitles(ensureTitleFormats(parsed.titles, previousTitles, titleOptions));
    snap(
      "ensureTitleFormats+fixFruitEmojisInTitles",
      { titles: parsed.titles, caption: parsed.caption },
      { titles: formatted, caption: parsed.caption },
    );

    const strippedCaption = stripGeneratedLocationTime(parsed.caption);
    snap(
      "stripGeneratedLocationTime",
      { titles: formatted, caption: parsed.caption },
      { titles: formatted, caption: strippedCaption },
    );
    const story = ensureCaptionEmojis(strippedCaption, humanStyle, payload.diningExperienceNote);
    snap("ensureCaptionEmojis", { titles: formatted, caption: strippedCaption }, { titles: formatted, caption: story });
    const compliant = await enforceXiaohongshuCompliance({
      content: {
        titles: formatted,
        caption: story,
        hashtags: parsed.hashtags,
        coverTitle: parsed.coverTitle,
        coverSubtitle: parsed.coverSubtitle,
      },
      openai: openai ?? undefined,
      model,
      complete: complianceComplete,
      coverContext: {
        ...coverContext,
        sourceTexts: [...formatted, story],
      },
    });
    snap("enforceXiaohongshuCompliance", { titles: formatted, caption: story }, { titles: compliant.titles, caption: compliant.caption });
    const titles = fixFruitEmojisInTitles(ensureTitleFormats(compliant.titles, previousTitles, titleOptions));
    snap(
      "ensureTitleFormats+fixFruitEmojisInTitles",
      { titles: compliant.titles, caption: compliant.caption },
      { titles, caption: compliant.caption },
    );
    const storySafe = ensureCaptionEmojis(compliant.caption, humanStyle, payload.diningExperienceNote);
    snap("ensureCaptionEmojis", { titles, caption: compliant.caption }, { titles, caption: storySafe });
    const diversified = ensureEvidenceLedCopy({
      titles,
      caption: storySafe,
      coverTitle: compliant.coverTitle,
      coverSubtitle: compliant.coverSubtitle,
      context: {
        ...coverContext,
        sourceTexts: [...titles, storySafe],
      },
      previousTitles,
    });
    snap(
      "ensureEvidenceLedCopy",
      { titles, caption: storySafe },
      { titles: diversified.titles, caption: diversified.caption },
    );
    const evidenceTitles = fixFruitEmojisInTitles(
      ensureTitleFormats(diversified.titles, previousTitles, titleOptions),
    );
    snap(
      "ensureTitleFormats+fixFruitEmojisInTitles",
      { titles: diversified.titles, caption: diversified.caption },
      { titles: evidenceTitles, caption: diversified.caption },
    );
    const evidenceCover = layoutCoverOverlay(
      diversified.coverTitle,
      diversified.coverSubtitle,
      evidenceTitles,
      {
        ...coverContext,
        sourceTexts: [...evidenceTitles, diversified.caption],
      },
    );
    const grounded = ensureGroundedHeadlineCopy({
      titles: evidenceTitles,
      coverTitle: evidenceCover.title,
      coverSubtitle: evidenceCover.subtitle,
      context: {
        ...coverContext,
        sourceTexts: [...evidenceTitles, diversified.caption],
      },
    });
    snap(
      "ensureGroundedHeadlineCopy",
      { titles: evidenceTitles, caption: diversified.caption },
      { titles: grounded.titles, caption: diversified.caption },
    );
    const titlesChanged = grounded.titles.some((title, index) => title !== evidenceTitles[index]);
    const coverChanged =
      grounded.coverTitle !== evidenceCover.title || grounded.coverSubtitle !== evidenceCover.subtitle;
    let groundedTitles = grounded.titles;
    if (titlesChanged) {
      groundedTitles = fixFruitEmojisInTitles(ensureTitleFormats(grounded.titles, previousTitles, titleOptions));
      snap(
        "ensureTitleFormats+fixFruitEmojisInTitles",
        { titles: grounded.titles, caption: diversified.caption },
        { titles: groundedTitles, caption: diversified.caption },
      );
    }
    let finalCover = { title: grounded.coverTitle, subtitle: grounded.coverSubtitle };
    if (coverChanged) {
      finalCover = layoutCoverOverlay(grounded.coverTitle, grounded.coverSubtitle, groundedTitles, {
        ...coverContext,
        sourceTexts: [...groundedTitles, diversified.caption],
      });
    }
    const sealed = ensureGroundedHeadlineCopy({
      titles: groundedTitles,
      coverTitle: finalCover.title,
      coverSubtitle: finalCover.subtitle,
      context: {
        ...coverContext,
        sourceTexts: [...groundedTitles, diversified.caption],
      },
    });
    snap(
      "ensureGroundedHeadlineCopy",
      { titles: groundedTitles, caption: diversified.caption },
      { titles: sealed.titles, caption: diversified.caption },
    );
    let finalTitles = sealed.titles;
    if (sealed.titles.some((title, index) => title !== groundedTitles[index])) {
      finalTitles = fixFruitEmojisInTitles(ensureTitleFormats(sealed.titles, previousTitles, titleOptions));
      snap(
        "ensureTitleFormats+fixFruitEmojisInTitles",
        { titles: sealed.titles, caption: diversified.caption },
        { titles: finalTitles, caption: diversified.caption },
      );
    }
    const variationPlan = planGenerationVariation({
      context: coverContext,
      variantIndex: payload.variantIndex,
      previousCaption: payload.previousCaption,
      previousCoverTitle: payload.previousCoverTitle,
      previousTitles,
      previousMemories: payload.previousGenerationMemories as GenerationMemory[] | undefined,
    });
    const varied = ensureGenerationVariation({
      titles: finalTitles,
      caption: diversified.caption,
      coverTitle: finalCover.title,
      coverSubtitle: finalCover.subtitle,
      plan: variationPlan,
      context: coverContext,
      previousCaption: payload.previousCaption,
      previousCoverTitle: payload.previousCoverTitle,
      previousTitles,
      previousMemories: payload.previousGenerationMemories as GenerationMemory[] | undefined,
      variantIndex: payload.variantIndex,
    });
    snap(
      "ensureGenerationVariation",
      { titles: finalTitles, caption: diversified.caption },
      { titles: varied.titles, caption: varied.caption },
    );
    let variedTitles = varied.titles;
    if (varied.titles.some((title, index) => title !== finalTitles[index])) {
      variedTitles = fixFruitEmojisInTitles(ensureTitleFormats(varied.titles, previousTitles, titleOptions));
      snap(
        "ensureTitleFormats+fixFruitEmojisInTitles",
        { titles: varied.titles, caption: varied.caption },
        { titles: variedTitles, caption: varied.caption },
      );
    }
    let variedCover = { title: varied.coverTitle, subtitle: varied.coverSubtitle };
    if (varied.coverTitle !== finalCover.title || varied.coverSubtitle !== finalCover.subtitle) {
      variedCover = layoutCoverOverlay(varied.coverTitle, varied.coverSubtitle, variedTitles, {
        ...coverContext,
        sourceTexts: [...variedTitles, varied.caption],
      });
    }
    const groundedVaried = ensureGroundedHeadlineCopy({
      titles: variedTitles,
      coverTitle: variedCover.title,
      coverSubtitle: variedCover.subtitle,
      context: {
        ...coverContext,
        sourceTexts: [...variedTitles, varied.caption],
      },
    });
    snap(
      "ensureGroundedHeadlineCopy",
      { titles: variedTitles, caption: varied.caption },
      { titles: groundedVaried.titles, caption: varied.caption },
    );
    let lockedTitles = groundedVaried.titles;
    if (groundedVaried.titles.some((title, index) => title !== variedTitles[index])) {
      lockedTitles = fixFruitEmojisInTitles(ensureTitleFormats(groundedVaried.titles, previousTitles, titleOptions));
      snap(
        "ensureTitleFormats+fixFruitEmojisInTitles",
        { titles: groundedVaried.titles, caption: varied.caption },
        { titles: lockedTitles, caption: varied.caption },
      );
    }
    const locked = ensureContentLock({
      titles: lockedTitles,
      caption: varied.caption,
      coverTitle: groundedVaried.coverTitle,
      coverSubtitle: groundedVaried.coverSubtitle,
      context: {
        ...coverContext,
        sourceTexts: [...groundedVaried.titles, varied.caption],
      },
    });
    snap(
      "ensureContentLock",
      { titles: lockedTitles, caption: varied.caption },
      { titles: locked.titles, caption: locked.caption },
    );
    let outputTitles = locked.titles;
    if (locked.titles.some((title, index) => title !== groundedVaried.titles[index])) {
      outputTitles = fixFruitEmojisInTitles(ensureTitleFormats(locked.titles, previousTitles, titleOptions));
      snap(
        "ensureTitleFormats+fixFruitEmojisInTitles",
        { titles: locked.titles, caption: locked.caption },
        { titles: outputTitles, caption: locked.caption },
      );
    }
    const separated = separateHeadlinesFromNote({
      titles: outputTitles,
      coverTitle: locked.coverTitle,
      coverSubtitle: locked.coverSubtitle,
      note: payload.diningExperienceNote ?? "",
    });
    snap(
      "separateHeadlinesFromNote",
      { titles: outputTitles, caption: locked.caption },
      { titles: separated.titles, caption: locked.caption },
    );
    const allocated = enforceCustomerEvidence({
      titles: separated.titles,
      caption: locked.caption,
      coverTitle: separated.coverTitle,
      coverSubtitle: separated.coverSubtitle,
      note: payload.diningExperienceNote,
      dishes: coverContext.dishes,
      enjoyMost: coverContext.enjoyMost,
      recommendTo: coverContext.recommendTo,
      branch: payload.branch,
    });
    snap(
      "enforceCustomerEvidence",
      { titles: separated.titles, caption: locked.caption },
      { titles: allocated.titles, caption: allocated.caption },
    );
    const headlineTitles = allocated.titles;
    const outputCover = {
      title: allocated.coverTitle,
      subtitle: selectOneValidSubtitle({
        note: payload.diningExperienceNote,
        preferred: allocated.coverSubtitle,
      }),
    };
    const locatedCaption = ensureCaptionEmojis(allocated.caption, humanStyle, payload.diningExperienceNote);
    snap(
      "ensureCaptionEmojis",
      { titles: headlineTitles, caption: allocated.caption },
      { titles: headlineTitles, caption: locatedCaption },
    );
    const located = finalizeOfficialLocationTime({
      caption: locatedCaption,
      branch: payload.branch,
      placement: locationPlan.placement,
      format: locationPlan.format,
      previousPlacement: payload.previousLocationPlacement,
      previousFormat: payload.previousLocationFormat,
      recentFormats: payload.previousLocationFormats,
      inlineStyle: locationPlan.inlineStyle,
      inlineSlot: locationPlan.inlineSlot,
    });
    snap(
      "finalizeOfficialLocationTime",
      { titles: headlineTitles, caption: locatedCaption },
      { titles: headlineTitles, caption: located.caption },
    );

    const cost = aggregateGenerationCost([...generationUsage, ...compliant.usage]);
    logGenerationCost(cost);

    const hashtags = normalizeHashtags(compliant.hashtags, payload.previousHashtags ?? [], {
      branchId: payload.branchId,
    }).map((tag) => applyBrandSpelling(tag, brandSpelling)) as typeof compliant.hashtags;
    const polishedTitles = fixFruitEmojisInTitles(
      ensureTitleFormats(headlineTitles, previousTitles, {
        ...titleOptions,
        caption: located.caption,
      }),
    );
    snap(
      "ensureTitleFormats+fixFruitEmojisInTitles",
      { titles: headlineTitles, caption: located.caption },
      { titles: polishedTitles, caption: located.caption },
    );
    const distinctHeadlines = separateOverlappingHeadlines({
      titles: polishedTitles,
      coverTitle: outputCover.title,
      coverSubtitle: outputCover.subtitle,
      note: payload.diningExperienceNote,
      recommendTo: payload.recommendTo,
      enjoyMost: payload.enjoyMost,
    });
    const spelledTitles = distinctHeadlines.titles.map((title) =>
      applyBrandSpelling(scrubForeignBranchFacts(title, payload.branch), brandSpelling),
    ) as typeof headlineTitles;
    const spelledCaption = applyBrandSpelling(located.caption, brandSpelling);
    const spelledCover = {
      title: applyBrandSpelling(scrubForeignBranchFacts(distinctHeadlines.coverTitle, payload.branch), brandSpelling),
      subtitle: applyBrandSpelling(scrubForeignBranchFacts(distinctHeadlines.coverSubtitle, payload.branch), brandSpelling),
    };
    snap(
      "applyBrandSpelling",
      { titles: distinctHeadlines.titles, caption: located.caption },
      { titles: spelledTitles, caption: spelledCaption },
    );
    snap("response", { titles: spelledTitles, caption: spelledCaption }, { titles: spelledTitles, caption: spelledCaption });

    const session = await resolveAnalyticsSession(analyticsSessionId);
    try {
      await insertGeneration({
        generationId,
        campaignId: payload.campaignId,
        brandId: payload.brandId,
        branchId: payload.branchId,
        submissionId: payload.submissionId,
        sessionId: session.sessionId,
        branch: payload.branch,
        kspId: parsed.selectedKspId || payload.suggestedKspId || "",
        storylineId: parsed.selectedStorylineId || payload.suggestedStorylineId || "",
        contentAngleId: parsed.selectedContentAngleId || payload.suggestedContentAngle || "",
        durationMs: Date.now() - startedAt,
        customer: {
          ageRange: payload.dinerAgeRange,
          gender: payload.dinerGender,
          location: payload.dinerOrigin,
          countryIso2: payload.dinerCountryIso2,
          countryCode: payload.dinerCountryCode,
        },
        customerType: payload.customerType,
        visitFrequency: payload.visitFrequency,
        mealExpenseThb: payload.totalMealExpense,
        origin: payload.dinerOrigin,
        titles: spelledTitles,
        caption: spelledCaption,
        hashtags,
        coverTitle: spelledCover.title,
        coverSubtitle: spelledCover.subtitle,
        enjoyMost: payload.enjoyMost,
        recommendedDishes: payload.recommendedDishes,
        recommendedDishOther: payload.recommendedDishOther,
        recommendTo: payload.recommendTo,
        diningExperienceNote: payload.diningExperienceNote,
        searchKeyword: parsed.selectedSearchKeyword || payload.suggestedSearchKeyword || "",
        cost,
      });
    } catch (error) {
      console.error("[generations] save failed");
      const detail = error instanceof Error ? error.message : "";
      if (detail) console.error("[generations]", detail);
    }
    await trackServerEvent(
      "generation_complete",
      { source: "generate_api" },
      analyticsSessionId,
    );
    if (payload.submissionId && payload.campaignId) {
      try {
        await upsertSubmission({
          submissionId: payload.submissionId,
          campaignId: payload.campaignId,
          diningExperienceNote: payload.diningExperienceNote,
        });
      } catch (error) {
        console.error("[submissions] memorable note save failed");
        const detail = error instanceof Error ? error.message : "";
        if (detail) console.error("[submissions]", detail);
      }
    }

    assertDeploymentOutput(
      [spelledTitles.join("\n"), spelledCaption, hashtags.join(" "), spelledCover.title, spelledCover.subtitle].join(
        "\n",
      ),
    );
    await trace.finish({
      titles: [...spelledTitles],
      caption: spelledCaption,
      hashtags: [...hashtags],
      modelCalls: generationUsage.length,
      complianceCalls: compliant.usage.length,
    });

    return Response.json({
      titles: spelledTitles,
      caption: spelledCaption,
      hashtags,
      coverTitle: spelledCover.title,
      coverSubtitle: spelledCover.subtitle,
      selectedPhotoIndex: parsed.selectedPhotoIndex,
      selectedPhotoIndexes: parsed.selectedPhotoIndexes,
      photoSelectionReason: parsed.photoSelectionReason,
      selectedTemplateId: parsed.selectedTemplateId,
      suitableTemplateIds: parsed.suitableTemplateIds,
      remainingPhotoIndexes: parsed.remainingPhotoIndexes,
      remainingOrderPattern: parsed.remainingOrderPattern,
      generationMemory: {
        ...varied.memory,
        humanStyle: humanStyle.primaryStyle,
        emojiMode: humanStyle.emojiMode,
      },
      selectedKspId: parsed.selectedKspId || payload.suggestedKspId || "",
      selectedStorylineId: parsed.selectedStorylineId || payload.suggestedStorylineId || "",
      selectedContentAngleId: parsed.selectedContentAngleId || payload.suggestedContentAngle || "",
      selectedSearchKeyword: parsed.selectedSearchKeyword || payload.suggestedSearchKeyword || "",
      locationFormat: located.format,
      locationPlacement: located.placement,
      cost,
      generationId,
    });
  } catch (error) {
    const failureStage =
      error instanceof ModelArkError
        ? error.stage
        : error instanceof DeploymentMismatchError
          ? "deployment_mismatch"
          : error instanceof Error && error.message.startsWith("Incomplete model output:")
            ? "parseGeneratedContent"
            : "generate";
    const failureMessage = error instanceof Error ? error.message : "Generation failed";
    if (failureStage === "parseGeneratedContent") trace.markLatest("business_failed");
    await trace.fail(failureStage, failureMessage);
    if (error instanceof DeploymentMismatchError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ModelArkError) {
      if (error.stage !== "json_parse") {
        console.info(`[modelark] label=generate final=${error.stage} recovered=`);
      }
      const safe = /sk-|api[_-]?key|bearer /i.test(error.message) ? "Generation failed" : error.message;
      return Response.json({ error: safe }, { status: error.status >= 400 ? error.status : 502 });
    }
    const raw = error instanceof Error ? error.message : "Generation failed";
    const detail = errorDetail(error);
    console.error("[generate] failed");
    if (detail) console.error("[generate]", detail);
    const tls =
      /cert|certificate|ssl|unable to verify|unable to get local issuer/i.test(detail);
    const connection = isOpenAIConnectionError(error, detail);
    const message = /sk-|api[_-]?key|bearer /i.test(detail)
      ? "Generation failed"
      : tls
        ? `Could not reach ${providerName}. If a VPN or proxy is on, turn it off and retry.`
        : connection
          ? `Could not reach ${providerName}. Check the network and retry.`
          : raw;
    return Response.json({ error: message }, { status: 500 });
  }
}
