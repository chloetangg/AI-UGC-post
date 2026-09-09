import {
  type GenerateContentErrorCode,
  type GenerateContentPhotoMeta,
  type GenerateContentRequest,
  type GenerateContentResponse,
} from "@/lib/generate-content/types";
import { finalizeGeneratedHashtags, stripAllHashtagsFromCaption } from "@/lib/hashtags";
import { resolveDiningBranch } from "@/lib/locations";

export class GenerateContentError extends Error {
  constructor(
    public readonly code: GenerateContentErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GenerateContentError";
  }
}

function asTrimmedString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asStringArray(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (!Array.isArray(value)) return [];
  return value.map((item) => asTrimmedString(item)).filter(Boolean);
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parsePhotos(value: unknown): GenerateContentPhotoMeta[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        const name = item.trim();
        return name ? { name, description: "" } : null;
      }
      const photo = asObject(item);
      if (!photo) return null;
      const name = asTrimmedString(photo.name ?? photo.filename ?? photo.fileName);
      const description = asTrimmedString(photo.description ?? photo.alt ?? photo.caption);
      if (!name && !description) return null;
      return { name, description };
    })
    .filter((item): item is GenerateContentPhotoMeta => item !== null);
}

function parseFavoriteDish(value: unknown) {
  if (Array.isArray(value)) return asStringArray(value).join("、");
  return asTrimmedString(value);
}

export function parseGenerateContentRequest(raw: unknown): GenerateContentRequest {
  const body = asObject(raw);
  if (!body) {
    throw new GenerateContentError("invalid_request", "Request body must be a JSON object", 400);
  }

  const campaign = asObject(body.campaign);
  if (!campaign) {
    throw new GenerateContentError("invalid_request", "Missing campaign object", 400);
  }

  const customer = asObject(body.customer) ?? {};
  const experience = asObject(body.experience) ?? {};

  return {
    campaign: {
      brand: asTrimmedString(campaign.brand),
      brandType: asTrimmedString(campaign.brandType),
      campaign: asTrimmedString(campaign.campaign),
      product: asTrimmedString(campaign.product),
      category: asTrimmedString(campaign.category),
      contentType: asTrimmedString(campaign.contentType),
    },
    customer: {
      name: asTrimmedString(customer.name),
      ageRange: asTrimmedString(customer.ageRange),
      origins: asTrimmedString(customer.origins),
      gender: asTrimmedString(customer.gender),
    },
    experience: {
      branch: resolveDiningBranch(asTrimmedString(experience.branch)),
      customerType: asTrimmedString(experience.customerType),
      visitFrequency: asTrimmedString(experience.visitFrequency),
      enjoyedMost: asStringArray(experience.enjoyedMost),
      favoriteDish: parseFavoriteDish(experience.favoriteDish),
      recommendTo: asStringArray(experience.recommendTo),
    },
    photos: parsePhotos(body.photos),
  };
}

export function normalizeGenerateContentHashtags(
  candidates: string[] = [],
  caption = "",
): GenerateContentResponse["hashtags"] {
  return finalizeGeneratedHashtags(caption, candidates).hashtags;
}

function asTitleList(value: unknown) {
  return asStringArray(value).filter(Boolean);
}

export function parseGenerateContentResponse(raw: unknown): GenerateContentResponse {
  const parsed =
    typeof raw === "string"
      ? (JSON.parse(raw.replace(/```json|```/g, "").trim()) as unknown)
      : raw;
  const body = asObject(parsed);
  if (!body) {
    throw new GenerateContentError("invalid_ai_response", "AI response was not a JSON object", 502);
  }

  const titles = asTitleList(body.titles);
  const caption = stripAllHashtagsFromCaption(asTrimmedString(body.body ?? body.caption));
  const hashtags = asStringArray(body.hashtags);

  if (titles.length < 3 || !caption) {
    throw new GenerateContentError(
      "invalid_ai_response",
      "AI response must include 3 titles and 1 body",
      502,
    );
  }

  const finalized = finalizeGeneratedHashtags(caption, hashtags);
  return {
    titles: [titles[0], titles[1], titles[2]],
    body: finalized.caption,
    hashtags: finalized.hashtags,
  };
}

export function sanitizeErrorMessage(message: string) {
  if (/sk-|api[_-]?key/i.test(message)) return "Generation failed";
  return message;
}
