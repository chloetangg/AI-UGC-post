import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { ensureCaptionEmojis, fixFruitEmojisInTitles } from "@/lib/caption-emoji";
import {
  buildSystemPrompt,
  buildUserPrompt,
  generatePostJsonSchema,
  type GenerateRequestBody,
} from "@/lib/generate-prompt";
import { insertGeneration } from "@/lib/generations";
import { upsertSubmission } from "@/lib/submissions";
import { trackServerEvent } from "@/lib/analytics/server";
import { readAnalyticsSession } from "@/lib/analytics/session";
import { normalizeHashtags } from "@/lib/hashtags";
import { attachOfficialLocationTime, resolveDiningBranch, stripGeneratedLocationTime } from "@/lib/locations";
import { parseGeneratedContent } from "@/lib/parse-generated";
import {
  classifyCoverHookType,
  ensureEvidenceLedCopy,
  ensureGroundedHeadlineCopy,
  previousPrimaryExperienceId,
} from "@/lib/content-evidence";
import { layoutCoverOverlay } from "@/lib/cover/cover-title";
import { aggregateGenerationCost, logGenerationCost, usageFromCompletion } from "@/lib/openai-usage";
import { ensureTitleFormats } from "@/lib/title-formats";
import { enforceXiaohongshuCompliance } from "@/lib/compliance";
import { ensureGenerationVariation, planGenerationVariation, type GenerationMemory } from "@/lib/generation-variation";
import { ensureContentLock } from "@/lib/content-lock";

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
  let formSubmitTrack: Promise<void> | null = null;
  const startedAt = Date.now();
  try {
    const form = await request.formData();
    const rawPayload = form.get("payload");
    if (typeof rawPayload !== "string") {
      return Response.json({ error: "Missing payload" }, { status: 400 });
    }

    const payload = JSON.parse(rawPayload) as GenerateRequestBody;
    payload.contentLanguage = "zh-CN";
    payload.branch = resolveDiningBranch(payload.branch);

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

    const openai = getClient();
    const model = process.env.OPENAI_MODEL || "gpt-4o";
    const previousTitles = payload.previousTitles ?? [];
    const formSubmitTrackTask = trackServerEvent("form_submit", { formType: "baan-ying-ugc" });
    formSubmitTrack = formSubmitTrackTask;

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.95,
      response_format: {
        type: "json_schema",
        json_schema: generatePostJsonSchema,
      },
      messages: [
        { role: "system", content: buildSystemPrompt(payload.contentStrategy) },
        {
          role: "user",
          content: [
            { type: "text", text: buildUserPrompt(payload) },
            ...imageParts,
          ],
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
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
    const parsed = parseGeneratedContent(
      text,
      photos.length || payload.photoCount || 1,
      payload.previousCoverTemplateId || "",
      coverContext,
    );

    const formatted = fixFruitEmojisInTitles(ensureTitleFormats(parsed.titles, previousTitles));

    const story = ensureCaptionEmojis(stripGeneratedLocationTime(parsed.caption));
    const compliant = await enforceXiaohongshuCompliance({
      content: {
        titles: formatted,
        caption: story,
        hashtags: parsed.hashtags,
        coverTitle: parsed.coverTitle,
        coverSubtitle: parsed.coverSubtitle,
      },
      openai,
      model,
      coverContext: {
        ...coverContext,
        sourceTexts: [...formatted, story],
      },
    });
    const titles = fixFruitEmojisInTitles(ensureTitleFormats(compliant.titles, previousTitles));
    const storySafe = ensureCaptionEmojis(compliant.caption);
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
    const evidenceTitles = fixFruitEmojisInTitles(
      ensureTitleFormats(diversified.titles, previousTitles),
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
    const titlesChanged = grounded.titles.some((title, index) => title !== evidenceTitles[index]);
    const coverChanged =
      grounded.coverTitle !== evidenceCover.title || grounded.coverSubtitle !== evidenceCover.subtitle;
    const groundedTitles = titlesChanged
      ? fixFruitEmojisInTitles(ensureTitleFormats(grounded.titles, previousTitles))
      : grounded.titles;
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
    const finalTitles = sealed.titles.some((title, index) => title !== groundedTitles[index])
      ? fixFruitEmojisInTitles(ensureTitleFormats(sealed.titles, previousTitles))
      : sealed.titles;
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
    const variedTitles = varied.titles.some((title, index) => title !== finalTitles[index])
      ? fixFruitEmojisInTitles(ensureTitleFormats(varied.titles, previousTitles))
      : varied.titles;
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
    const locked = ensureContentLock({
      titles: groundedVaried.titles.some((title, index) => title !== variedTitles[index])
        ? fixFruitEmojisInTitles(ensureTitleFormats(groundedVaried.titles, previousTitles))
        : groundedVaried.titles,
      caption: varied.caption,
      coverTitle: groundedVaried.coverTitle,
      coverSubtitle: groundedVaried.coverSubtitle,
      context: {
        ...coverContext,
        sourceTexts: [...groundedVaried.titles, varied.caption],
      },
    });
    const outputTitles = locked.titles.some((title, index) => title !== groundedVaried.titles[index])
      ? fixFruitEmojisInTitles(ensureTitleFormats(locked.titles, previousTitles))
      : locked.titles;
    const outputCover = {
      title: locked.coverTitle,
      subtitle: locked.coverSubtitle,
    };
    const located = attachOfficialLocationTime(
      ensureCaptionEmojis(locked.caption),
      payload.branch,
      payload.requiredLocationFormat,
      payload.previousLocationFormat,
      payload.previousLocationFormats,
    );

    const cost = aggregateGenerationCost([
      usageFromCompletion(completion, model, "generate"),
      ...compliant.usage,
    ]);
    logGenerationCost(cost);

    const hashtags = normalizeHashtags(compliant.hashtags, payload.previousHashtags ?? []);

    const generationId = randomUUID();
    const session = await readAnalyticsSession();
    try {
      await insertGeneration({
        generationId,
        campaignId: payload.campaignId,
        brandId: "baan-ying",
        submissionId: payload.submissionId,
        sessionId: session.sessionId,
        branch: payload.branch,
        kspId: parsed.selectedKspId,
        storylineId: parsed.selectedStorylineId,
        contentAngleId: parsed.selectedContentAngleId,
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
        titles: outputTitles,
        caption: located.caption,
        hashtags,
        coverTitle: outputCover.title,
        coverSubtitle: outputCover.subtitle,
        enjoyMost: payload.enjoyMost,
        recommendedDishes: payload.recommendedDishes,
        recommendedDishOther: payload.recommendedDishOther,
        recommendTo: payload.recommendTo,
        diningExperienceNote: payload.diningExperienceNote,
        searchKeyword: parsed.selectedSearchKeyword,
        cost,
      });
    } catch (error) {
      console.error("[generations] save failed");
      const detail = error instanceof Error ? error.message : "";
      if (detail) console.error("[generations]", detail);
    }
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

    await Promise.all([
      formSubmitTrackTask,
      trackServerEvent("generation_complete", {
        generationType: "baan-ying-ugc",
        generationId,
      }),
    ]);

    return Response.json({
      titles: outputTitles,
      caption: located.caption,
      hashtags,
      coverTitle: outputCover.title,
      coverSubtitle: outputCover.subtitle,
      selectedPhotoIndex: parsed.selectedPhotoIndex,
      selectedPhotoIndexes: parsed.selectedPhotoIndexes,
      photoSelectionReason: parsed.photoSelectionReason,
      selectedTemplateId: parsed.selectedTemplateId,
      suitableTemplateIds: parsed.suitableTemplateIds,
      remainingPhotoIndexes: parsed.remainingPhotoIndexes,
      remainingOrderPattern: parsed.remainingOrderPattern,
      generationMemory: varied.memory,
      selectedKspId: parsed.selectedKspId,
      selectedStorylineId: parsed.selectedStorylineId,
      selectedContentAngleId: parsed.selectedContentAngleId,
      selectedSearchKeyword: parsed.selectedSearchKeyword,
      locationFormat: located.format,
      cost,
      generationId,
    });
  } catch (error) {
    if (formSubmitTrack) await formSubmitTrack;
    const raw = error instanceof Error ? error.message : "Generation failed";
    const detail = errorDetail(error);
    console.error("[generate] failed");
    if (detail) console.error("[generate]", detail);
    const tls =
      /cert|certificate|ssl|unable to verify|unable to get local issuer/i.test(detail);
    const connection = isOpenAIConnectionError(error, detail);
    const message = /sk-|api[_-]?key/i.test(detail)
      ? "Generation failed"
      : tls
        ? "Could not reach OpenAI. If a VPN or proxy is on, turn it off and retry."
        : connection
          ? "Could not reach OpenAI. Check the network and retry."
          : raw;
    return Response.json({ error: message }, { status: 500 });
  }
}
