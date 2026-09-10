import OpenAI from "openai";
import { ensureCaptionEmojis, fixFruitEmojisInTitles } from "@/lib/caption-emoji";
import {
  buildSystemPrompt,
  buildUserPrompt,
  generatePostJsonSchema,
  type GenerateRequestBody,
} from "@/lib/generate-prompt";
import { normalizeHashtags } from "@/lib/hashtags";
import { attachOfficialLocationTime, resolveDiningBranch, stripGeneratedLocationTime } from "@/lib/locations";
import { parseGeneratedContent } from "@/lib/parse-generated";
import { aggregateGenerationCost, logGenerationCost, usageFromCompletion } from "@/lib/openai-usage";
import { ensureTitleFormats, evaluateTitleFormats } from "@/lib/title-formats";
import { enforceXiaohongshuCompliance } from "@/lib/compliance";

export const maxDuration = 60;

const MAX_IMAGES = 5;

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
    const coverContext = {
      branch: payload.branch,
      dishes: [
        ...payload.recommendedDishes.filter((dish) => dish !== "Others"),
        payload.recommendedDishOther.trim(),
      ].filter(Boolean),
      previousCoverTitle: payload.previousCoverTitle,
      variantIndex: payload.variantIndex,
      kspId: payload.suggestedKspId,
      contentAngleId: payload.suggestedContentAngle,
    };
    const parsed = parseGeneratedContent(
      text,
      photos.length || payload.photoCount || 1,
      payload.previousCoverTemplateId || "",
      coverContext,
    );

    const formatted = fixFruitEmojisInTitles(
      evaluateTitleFormats(parsed.titles, previousTitles).ok
        ? parsed.titles
        : ensureTitleFormats(parsed.titles, previousTitles),
    );

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
      coverContext,
    });
    const titles = fixFruitEmojisInTitles(
      evaluateTitleFormats(compliant.titles, previousTitles).ok
        ? compliant.titles
        : ensureTitleFormats(compliant.titles, previousTitles),
    );
    const storySafe = ensureCaptionEmojis(compliant.caption);
    const located = attachOfficialLocationTime(
      storySafe,
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

    return Response.json({
      titles,
      caption: located.caption,
      hashtags: normalizeHashtags(compliant.hashtags, payload.previousHashtags ?? []),
      coverTitle: compliant.coverTitle,
      coverSubtitle: compliant.coverSubtitle,
      selectedPhotoIndex: parsed.selectedPhotoIndex,
      selectedPhotoIndexes: parsed.selectedPhotoIndexes,
      photoSelectionReason: parsed.photoSelectionReason,
      selectedTemplateId: parsed.selectedTemplateId,
      suitableTemplateIds: parsed.suitableTemplateIds,
      remainingPhotoIndexes: parsed.remainingPhotoIndexes,
      remainingOrderPattern: parsed.remainingOrderPattern,
      selectedKspId: parsed.selectedKspId,
      selectedStorylineId: parsed.selectedStorylineId,
      selectedContentAngleId: parsed.selectedContentAngleId,
      selectedSearchKeyword: parsed.selectedSearchKeyword,
      locationFormat: located.format,
      cost,
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Generation failed";
    const connection =
      error instanceof OpenAI.APIConnectionError || /connection error/i.test(raw);
    const message = /sk-|api[_-]?key/i.test(raw)
      ? "Generation failed"
      : connection
        ? "Could not reach OpenAI. Check the network and retry."
        : raw;
    return Response.json({ error: message }, { status: 500 });
  }
}
