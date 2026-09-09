"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { getCampaign } from "@/lib/mock/campaign";
import { CONTENT_LANGUAGE } from "@/lib/i18n";
import { finalizeGeneratedHashtags, stripAllHashtagsFromCaption } from "@/lib/hashtags";
import { pickSuggestedStrategy, resolveStrategySelection } from "@/lib/content-strategy";
import { BAAN_YING_CONTENT_STRATEGY } from "@/lib/brand/baan-ying-strategy";
import { keywordsFromTitles } from "@/lib/title-keywords";
import { buildGenerateRequest } from "@/lib/generate-prompt";
import { emptyCustomerInfo, type CustomerInfo } from "@/types/customer";
import { isMealExpenseComplete } from "@/lib/meal-expense";
import { isKnownOriginCity } from "@/lib/world-cities";
import { composeCoverImage, preloadCoverFile } from "@/lib/compose-cover-client";
import { layoutCoverOverlay } from "@/lib/cover/cover-title";
import { normalizePhotoIndexes, pickFourGridSources } from "@/lib/cover/collage";
import { fontForTemplate, generateRandomFontAssignments } from "@/lib/cover/font-match";
import {
  autoMatchTemplate,
  isCoverTemplateId,
  isFourPhotoGridCover,
  parseRemainingPhotoIndexes,
  photosInIndexOrder,
  remainingPostPhotos,
} from "@/lib/cover/post-layout";
import {
  DEFAULT_COVER_TEMPLATE_ID,
  emptyProductFeedback,
  withDefaultBranch,
  isDiningExperienceNoteComplete,
  type CoverState,
  type GeneratedContent,
  type PhotoItem,
  type ProductFeedback,
  type ResultDraft,
} from "@/types/content";
import {
  attachOfficialLocationTime,
  captionHoursForBranch,
  detectLocationTimeFormat,
  isLocationTimeFormatId,
  pickNextLocationTimeFormat,
  resolveDiningBranch,
} from "@/lib/locations";
import type { LocationTimeFormatId } from "@/lib/locations";
import { formatGenerationCostLog, type GenerationCostReport } from "@/lib/openai-usage";
import { createId } from "@/lib/id";
import { saveSubmissionToServer } from "@/lib/save-submission-client";
import { compressPhotoForGenerate, compressPhotosForGenerate, makePhotoThumbUrl } from "@/lib/compress-photo";
import type { FlowStep } from "@/lib/flow";

const MAX_PHOTOS = 5;
const SERVER_DEFAULT = defaultPersisted();

type PersistedFlow = {
  submissionId: string;
  customer: CustomerInfo;
  productFeedback: ProductFeedback;
  photoCount: number;
  generated: GeneratedContent | null;
  draft: ResultDraft | null;
  cover: CoverState | null;
  selectedCoverTemplateId: string;
  variantIndex: number;
  locationFormatHistory: LocationTimeFormatId[];
  contentAngleHistory: string[];
  kspHistory: string[];
  storylineHistory: string[];
  searchKeywordHistory: string[];
  coverTemplateHistory: string[];
};

export type GeneratePhase = "post" | "cover";

type CampaignFlowContextValue = {
  campaignId: string;
  hydrated: boolean;
  customer: CustomerInfo;
  productFeedback: ProductFeedback;
  photos: PhotoItem[];
  generated: GeneratedContent | null;
  draft: ResultDraft | null;
  cover: CoverState | null;
  coverComposing: boolean;
  selectedCoverTemplateId: string;
  setCustomer: (customer: CustomerInfo) => void;
  setProductFeedback: (productFeedback: ProductFeedback) => void;
  saveYouPage: () => Promise<void>;
  saveFeelExpense: () => Promise<void>;
  addPhotos: (files: File[]) => { added: number; rejected: number };
  removePhoto: (id: string) => void;
  generatePost: (onPhase?: (phase: GeneratePhase) => void) => Promise<ResultDraft>;
  updateDraft: (draft: ResultDraft) => void;
  retryCover: () => Promise<void>;
  selectCoverTemplate: (templateId: string) => Promise<void>;
  canAccess: (step: FlowStep) => boolean;
  firstBlockedStep: (step: FlowStep) => FlowStep | null;
};

const CampaignFlowContext = createContext<CampaignFlowContextValue | null>(null);
const listeners = new Map<string, Set<() => void>>();
const memoryStore = new Map<string, PersistedFlow>();

function storageKey(campaignId: string) {
  return `xhs-ugc-flow:${campaignId}`;
}

function clearLegacyStorage(campaignId: string) {
  try {
    window.sessionStorage.removeItem(storageKey(campaignId));
  } catch {
    /* ignore */
  }
}

function defaultPersisted(): PersistedFlow {
  return {
    submissionId: "",
    customer: emptyCustomerInfo,
    productFeedback: emptyProductFeedback,
    photoCount: 0,
    generated: null,
    draft: null,
    cover: null,
    selectedCoverTemplateId: DEFAULT_COVER_TEMPLATE_ID,
    variantIndex: 0,
    locationFormatHistory: [],
    contentAngleHistory: [],
    kspHistory: [],
    storylineHistory: [],
    searchKeywordHistory: [],
    coverTemplateHistory: [],
  };
}

function isCustomerComplete(customer: CustomerInfo) {
  return Boolean(
    customer.ageRange &&
      customer.gender &&
      isKnownOriginCity(customer.location),
  );
}

function isProductFeedbackComplete(productFeedback: ProductFeedback) {
  return Boolean(
    productFeedback.customerType &&
      productFeedback.visitFrequency &&
      isMealExpenseComplete(productFeedback.totalMealExpense) &&
      isDiningExperienceNoteComplete(productFeedback.diningExperienceNote ?? ""),
  );
}

function readPersisted(campaignId: string): PersistedFlow {
  clearLegacyStorage(campaignId);
  return defaultPersisted();
}

function subscribeToFlow(campaignId: string, onStoreChange: () => void) {
  let set = listeners.get(campaignId);
  if (!set) {
    set = new Set();
    listeners.set(campaignId, set);
  }
  set.add(onStoreChange);
  return () => {
    set.delete(onStoreChange);
  };
}

function getFlowSnapshot(campaignId: string) {
  const cached = memoryStore.get(campaignId);
  const loaded = cached ?? readPersisted(campaignId);
  const productFeedback = withDefaultBranch(loaded.productFeedback);
  const next =
    productFeedback.branch === loaded.productFeedback.branch
      ? loaded
      : { ...loaded, productFeedback };
  memoryStore.set(campaignId, next);
  return next;
}

function ensureSubmissionId(campaignId: string) {
  const current = getFlowSnapshot(campaignId);
  if (current.submissionId) return current.submissionId;
  const submissionId = createId();
  patchFlow(campaignId, { submissionId });
  return submissionId;
}

function revokeBlobUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

function patchFlow(campaignId: string, partial: Partial<PersistedFlow>) {
  const current = getFlowSnapshot(campaignId);
  const nextCoverUrl = partial.cover?.generatedCoverImageUrl;
  const previousCoverUrl = current.cover?.generatedCoverImageUrl;
  if (
    previousCoverUrl &&
    previousCoverUrl !== nextCoverUrl &&
    (partial.cover || nextCoverUrl === null)
  ) {
    revokeBlobUrl(previousCoverUrl);
  }
  const next = {
    ...current,
    ...partial,
    productFeedback: withDefaultBranch(partial.productFeedback ?? current.productFeedback),
  };
  memoryStore.set(campaignId, next);
  listeners.get(campaignId)?.forEach((listener) => listener());
}

function draftFromGenerated(generated: GeneratedContent): ResultDraft {
  const finalized = finalizeGeneratedHashtags(generated.caption, generated.hashtags);
  return {
    selectedTitleIndex: 0,
    caption: finalized.caption,
    hashtags: [...finalized.hashtags],
  };
}

async function composeCoverFromState(cover: CoverState, files: File[]) {
  const templateId = cover.selectedCoverTemplateId || DEFAULT_COVER_TEMPLATE_ID;
  const sourceIndex = cover.selectedPhotoIndex;
  const fourGrid = isFourPhotoGridCover(files.length, templateId);
  const chosen = fourGrid
    ? pickFourGridSources(
        files,
        normalizePhotoIndexes(cover.selectedPhotoIndexes ?? [], sourceIndex, files.length),
      )
    : [files[sourceIndex] ?? files[0]].filter((file): file is File => Boolean(file));
  if (!chosen[0] || !cover.coverTitle) {
    throw new Error("Cover generation failed");
  }
  const overlay = layoutCoverOverlay(cover.coverTitle, cover.coverSubtitle);
  if (!overlay.title) {
    throw new Error("Cover generation failed");
  }
  return composeCoverImage({
    image: chosen[0],
    images: fourGrid ? chosen.slice(1) : [],
    title: overlay.title,
    subtitle: overlay.subtitle,
    templateId,
    fontId: fontForTemplate(templateId, cover.templateFontIds, cover.selectedFontId),
  });
}

function emptySubscribe() {
  return () => {};
}

function clientTrue() {
  return true;
}

function serverFalse() {
  return false;
}

export function CampaignFlowProvider({
  campaignId,
  children,
}: {
  campaignId: string;
  children: ReactNode;
}) {
  const persisted = useSyncExternalStore(
    (onChange) => subscribeToFlow(campaignId, onChange),
    () => getFlowSnapshot(campaignId),
    () => SERVER_DEFAULT,
  );
  const hydrated = useSyncExternalStore(emptySubscribe, clientTrue, serverFalse);

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const photosRef = useRef<PhotoItem[]>([]);
  const photoPrepRef = useRef(new Map<string, Promise<void>>());
  const generateInFlightRef = useRef<Promise<ResultDraft> | null>(null);
  const [coverComposing, setCoverComposing] = useState(false);
  const composeInFlightRef = useRef<Promise<void> | null>(null);

  const setCustomer = useCallback(
    (customer: CustomerInfo) => {
      patchFlow(campaignId, { customer });
    },
    [campaignId],
  );

  const setProductFeedback = useCallback(
    (productFeedback: ProductFeedback) => {
      patchFlow(campaignId, { productFeedback: withDefaultBranch(productFeedback) });
    },
    [campaignId],
  );

  const saveYouPage = useCallback(async () => {
    const submissionId = ensureSubmissionId(campaignId);
    const current = getFlowSnapshot(campaignId);
    try {
      await saveSubmissionToServer({
        submissionId,
        campaignId,
        customer: current.customer,
      });
    } catch {
      /* Saving to MongoDB should not block the customer flow. */
    }
  }, [campaignId]);

  const saveFeelExpense = useCallback(async () => {
    const submissionId = ensureSubmissionId(campaignId);
    const current = getFlowSnapshot(campaignId);
    try {
      await saveSubmissionToServer({
        submissionId,
        campaignId,
        customer: current.customer,
        mealExpenseThb: current.productFeedback.totalMealExpense,
      });
    } catch {
      /* Saving to MongoDB should not block the customer flow. */
    }
  }, [campaignId]);

  const addPhotos = useCallback(
    (files: File[]) => {
      const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
      const current = photosRef.current;
      const next = [...current];
      let added = 0;
      let rejected = 0;

      for (const file of files) {
        const okType =
          acceptedTypes.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
        if (!okType || next.length >= MAX_PHOTOS) {
          rejected += 1;
          continue;
        }
        const id = createId();
        next.push({
          id,
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          file,
        });
        added += 1;
        preloadCoverFile(file, `photo-${id}.jpg`);
        const prep = Promise.all([compressPhotoForGenerate(file), makePhotoThumbUrl(file)]).then(
          ([compressed, thumbUrl]) => {
            const currentPhoto = photosRef.current.find((photo) => photo.id === id);
            if (!currentPhoto) {
              revokeBlobUrl(thumbUrl);
              return;
            }
            const updated = photosRef.current.map((photo) =>
              photo.id === id
                ? {
                    ...photo,
                    uploadFile: compressed,
                    thumbUrl: thumbUrl || photo.thumbUrl,
                  }
                : photo,
            );
            photosRef.current = updated;
            setPhotos(updated);
          },
        );
        photoPrepRef.current.set(id, prep);
      }

      if (added > 0) {
        photosRef.current = next;
        setPhotos(next);
        patchFlow(campaignId, { photoCount: next.length });
      }

      return { added, rejected };
    },
    [campaignId],
  );

  const removePhoto = useCallback(
    (id: string) => {
      const current = photosRef.current;
      const target = current.find((photo) => photo.id === id);
      if (target) {
        revokeBlobUrl(target.previewUrl);
        revokeBlobUrl(target.thumbUrl);
        photoPrepRef.current.delete(id);
      }
      const next = current.filter((photo) => photo.id !== id);
      photosRef.current = next;
      setPhotos(next);
      patchFlow(campaignId, { photoCount: next.length });
    },
    [campaignId],
  );

  const generatePost = useCallback(async (onPhase?: (phase: GeneratePhase) => void) => {
    if (generateInFlightRef.current) {
      return generateInFlightRef.current;
    }

    const run = (async () => {
    onPhase?.("post");
    await Promise.all([...photoPrepRef.current.values()]);
    const current = getFlowSnapshot(campaignId);
    const campaign = getCampaign(campaignId);
    const files = photosRef.current.map((photo) => photo.file).filter(Boolean);
    const previousTitles = current.generated?.titles?.filter(Boolean) ?? [];
    const previousSelectedTitle =
      current.draft && current.generated
        ? current.generated.titles[current.draft.selectedTitleIndex] || previousTitles[0] || ""
        : previousTitles[0] || "";
    const previousCaption = current.draft?.caption?.trim() || current.generated?.caption?.trim() || "";
    const history = current.locationFormatHistory ?? [];
    const detectedPrevious = previousCaption ? detectLocationTimeFormat(previousCaption) : "";
    const previousLocationFormat =
      history[history.length - 1] || (isLocationTimeFormatId(detectedPrevious) ? detectedPrevious : "");
    const previousLocationFormats = history.length > 0 ? history : previousLocationFormat ? [previousLocationFormat] : [];
    const diningBranch = resolveDiningBranch(current.productFeedback.branch);
    const requiredLocationFormat = pickNextLocationTimeFormat(
      previousLocationFormat,
      previousLocationFormats,
      Boolean(captionHoursForBranch(diningBranch)),
    );
    const angleInput = {
      branch: diningBranch,
      customerType: current.productFeedback.customerType,
      visitFrequency: current.productFeedback.visitFrequency,
      enjoyMost: current.productFeedback.enjoyMost,
      recommendedDishes: current.productFeedback.recommendedDishes,
      variantIndex: current.variantIndex,
    };
    const strategyLibrary = campaign.contentStrategy ?? BAAN_YING_CONTENT_STRATEGY;
    const previousContentAngle = (current.contentAngleHistory ?? []).at(-1) || "";
    const previousKspId = (current.kspHistory ?? []).at(-1) || "";
    const previousStorylineId = (current.storylineHistory ?? []).at(-1) || "";
    const previousSearchKeyword = (current.searchKeywordHistory ?? []).at(-1) || "";
    const suggestedStrategy = pickSuggestedStrategy(
      strategyLibrary,
      {
        ...angleInput,
        recommendedDishOther: current.productFeedback.recommendedDishOther,
        recommendTo: current.productFeedback.recommendTo,
        diningExperienceNote: current.productFeedback.diningExperienceNote ?? "",
        dinerOrigin: current.customer.location.trim(),
        dinerAgeRange: current.customer.ageRange,
        dinerGender: current.customer.gender,
        photoCount: files.length || current.photoCount,
      },
      {
        previousKspId,
        previousStorylineId,
        previousContentAngleId: previousContentAngle,
        previousSearchKeyword,
        previousTitleKeywords: previousTitles.length > 0 ? keywordsFromTitles(previousTitles) : [],
      },
    );
    const payload = buildGenerateRequest(campaign, {
      ...angleInput,
      recommendedDishOther: current.productFeedback.recommendedDishOther,
      recommendTo: current.productFeedback.recommendTo,
      diningExperienceNote: current.productFeedback.diningExperienceNote ?? "",
      totalMealExpense: current.productFeedback.totalMealExpense,
      photoCount: files.length || current.photoCount,
      contentType: campaign.contentStyle.contentType,
      productName: campaign.productName,
      contentLanguage: CONTENT_LANGUAGE,
      dinerOrigin: current.customer.location.trim(),
      dinerAgeRange: current.customer.ageRange || "",
      dinerGender: current.customer.gender || "",
      previousTitle: previousSelectedTitle,
      previousCaption: stripAllHashtagsFromCaption(previousCaption),
      previousTitles: previousTitles.length > 0 ? previousTitles : undefined,
      previousTitleKeywords: previousTitles.length > 0 ? keywordsFromTitles(previousTitles) : undefined,
      previousLocationFormat,
      previousLocationFormats,
      requiredLocationFormat,
      previousHashtags: current.draft?.hashtags ?? current.generated?.hashtags,
      previousContentAngle,
      suggestedContentAngle: suggestedStrategy.contentAngleId,
      suggestedKspId: suggestedStrategy.kspId,
      suggestedStorylineId: suggestedStrategy.storylineId,
      suggestedSearchKeyword: suggestedStrategy.searchKeyword,
      previousKspId,
      previousStorylineId,
      previousSearchKeyword,
      previousCoverTemplateId: current.cover?.selectedCoverTemplateId || "",
      previousCoverTitle: [current.cover?.coverTitle || current.generated?.coverTitle, current.cover?.coverSubtitle || current.generated?.coverSubtitle]
        .filter((part) => Boolean(part?.trim()))
        .join(" / "),
    });

    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    const uploadPhotos = await compressPhotosForGenerate(
      photosRef.current.map((photo) => photo.uploadFile ?? photo.file).filter(Boolean),
    );
    uploadPhotos.forEach((file) => form.append("photos", file));

    const response = await fetch("/api/generate", {
      method: "POST",
      body: form,
    });
    let data: GeneratedContent & {
      error?: string;
      locationFormat?: string;
      cost?: GenerationCostReport;
    };
    try {
      data = (await response.json()) as GeneratedContent & {
        error?: string;
        locationFormat?: string;
        cost?: GenerationCostReport;
      };
    } catch {
      if (response.status === 413) {
        throw new Error("Photos are too large to upload. Try 1–2 smaller photos.");
      }
      if (response.status === 504 || response.status === 502) {
        throw new Error("Generation timed out on the server. Retry with fewer photos.");
      }
      throw new Error("Generation failed");
    }
    if (!response.ok) {
      if (response.status === 413) {
        throw new Error("Photos are too large to upload. Try 1–2 smaller photos.");
      }
      throw new Error(data.error || "Generation failed");
    }
    if (!data.titles?.[0] || !data.titles?.[1] || !data.titles?.[2] || !data.caption) {
      throw new Error("Incomplete model output");
    }
    if (data.cost) {
      console.log(formatGenerationCostLog(data.cost));
    }

    const finalized = finalizeGeneratedHashtags(data.caption, data.hashtags);
    const located = attachOfficialLocationTime(
      finalized.caption,
      diningBranch,
      isLocationTimeFormatId(data.locationFormat) ? data.locationFormat : requiredLocationFormat,
      previousLocationFormat,
      previousLocationFormats,
    );
    const maxPhotoIndex = Math.max(files.length - 1, 0);
    const aiSelectedPhotoIndex = Math.min(
      Math.max(data.selectedPhotoIndex ?? 0, 0),
      maxPhotoIndex,
    );
    const selectedPhotoIndexes = normalizePhotoIndexes(
      data.selectedPhotoIndexes ?? [aiSelectedPhotoIndex],
      aiSelectedPhotoIndex,
      files.length || 1,
    );
    const coverContext = {
      branch: diningBranch,
      dishes: [
        ...current.productFeedback.recommendedDishes.filter((dish) => dish !== "Others"),
        current.productFeedback.recommendedDishOther?.trim() ?? "",
      ].filter(Boolean),
      previousCoverTitle: current.cover?.coverTitle || current.generated?.coverTitle,
      variantIndex: current.variantIndex,
      kspId: data.selectedKspId || suggestedStrategy.kspId,
      contentAngleId: data.selectedContentAngleId || suggestedStrategy.contentAngleId,
    };
    const overlay = layoutCoverOverlay(data.coverTitle ?? "", data.coverSubtitle ?? "", [
      data.titles[0],
      data.titles[1],
      data.titles[2],
    ], coverContext);
    const coverTitle = overlay.title;
    const coverSubtitle = overlay.subtitle;
    const previousTemplateId = current.cover?.selectedCoverTemplateId || "";
    const selectedTemplateId = autoMatchTemplate({
      selected: data.selectedTemplateId,
      suitable: data.suitableTemplateIds,
      previousTemplateId,
      recentTemplateIds: current.coverTemplateHistory ?? [],
    });
    const remainingPhotoIndexes = parseRemainingPhotoIndexes(
      data.remainingPhotoIndexes,
      aiSelectedPhotoIndex,
      files.length || 1,
      selectedTemplateId,
    );
    const templateFontIds = generateRandomFontAssignments();
    const selectedFontId = fontForTemplate(selectedTemplateId, templateFontIds);
    const coverSourcePhoto = photosRef.current[aiSelectedPhotoIndex] ?? photosRef.current[0] ?? null;
    const remainingPhotos = isFourPhotoGridCover(photosRef.current.length, selectedTemplateId)
      ? photosInIndexOrder(photosRef.current, remainingPhotoIndexes)
      : photosInIndexOrder(photosRef.current, remainingPhotoIndexes).filter(
          (photo) => photo.id !== coverSourcePhoto?.id,
        );
    const nextGenerated: GeneratedContent = {
      titles: [data.titles[0], data.titles[1], data.titles[2]],
      caption: located.caption,
      hashtags: finalized.hashtags,
      coverTitle,
      coverSubtitle,
      selectedPhotoIndex: aiSelectedPhotoIndex,
      selectedPhotoIndexes,
      photoSelectionReason: data.photoSelectionReason?.trim() || "",
      selectedTemplateId,
      suitableTemplateIds: data.suitableTemplateIds ?? [],
      remainingPhotoIndexes,
      remainingOrderPattern: data.remainingOrderPattern?.trim() || "",
    };
    const nextDraft = draftFromGenerated(nextGenerated);
    const nextCover: CoverState = {
      coverTitle,
      coverSubtitle,
      selectedPhotoIndex: nextGenerated.selectedPhotoIndex,
      selectedPhotoIndexes,
      generatedCoverImageUrl: null,
      selectedCoverTemplateId: selectedTemplateId,
      selectedFontId,
      templateFontIds,
      coverSourcePhotoId: coverSourcePhoto?.id ?? null,
      remainingPhotoIds: remainingPhotos.map((photo) => photo.id),
      error: null,
    };
    const usedFormat = located.format;
    const locationFormatHistory = [...previousLocationFormats, usedFormat].slice(-6);
    const selectedStrategy = resolveStrategySelection(strategyLibrary, suggestedStrategy, {
      kspId: data.selectedKspId,
      storylineId: data.selectedStorylineId,
      contentAngleId: data.selectedContentAngleId,
      searchKeyword: data.selectedSearchKeyword,
    });
    const contentAngleHistory = [...(current.contentAngleHistory ?? []), selectedStrategy.contentAngleId].slice(-8);
    const kspHistory = [...(current.kspHistory ?? []), selectedStrategy.kspId].slice(-8);
    const storylineHistory = [...(current.storylineHistory ?? []), selectedStrategy.storylineId].slice(-8);
    const searchKeywordHistory = [...(current.searchKeywordHistory ?? []), selectedStrategy.searchKeyword].slice(-8);
    const coverTemplateHistory = [...(current.coverTemplateHistory ?? []), selectedTemplateId].slice(-9);
    patchFlow(campaignId, {
      generated: {
        ...nextGenerated,
        selectedKspId: selectedStrategy.kspId,
        selectedStorylineId: selectedStrategy.storylineId,
        selectedContentAngleId: selectedStrategy.contentAngleId,
        selectedSearchKeyword: selectedStrategy.searchKeyword,
      },
      draft: nextDraft,
      cover: nextCover,
      variantIndex: current.variantIndex + 1,
      locationFormatHistory,
      contentAngleHistory,
      kspHistory,
      storylineHistory,
      searchKeywordHistory,
      coverTemplateHistory,
      selectedCoverTemplateId: selectedTemplateId,
    });

    onPhase?.("cover");
    const coverFile = files[nextCover.selectedPhotoIndex] ?? files[0];
    if (coverFile) {
      try {
        setCoverComposing(true);
        const imageUrl = await composeCoverFromState(nextCover, files);
        patchFlow(campaignId, {
          cover: {
            ...nextCover,
            generatedCoverImageUrl: imageUrl,
            error: null,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Cover generation failed";
        patchFlow(campaignId, {
          cover: {
            ...nextCover,
            generatedCoverImageUrl: null,
            error: message,
          },
        });
      } finally {
        setCoverComposing(false);
      }
    } else {
      patchFlow(campaignId, {
        cover: {
          ...nextCover,
          generatedCoverImageUrl: null,
          error: "Cover generation failed",
        },
      });
    }

    return nextDraft;
    })();

    generateInFlightRef.current = run;
    void run.finally(() => {
      if (generateInFlightRef.current === run) {
        generateInFlightRef.current = null;
      }
    }).catch(() => {});
    return run;
  }, [campaignId]);

  const composeCurrentCover = useCallback(async (next: Partial<CoverState> = {}) => {
    const cover = getFlowSnapshot(campaignId).cover;
    if (!cover) return;
    const merged: CoverState = { ...cover, ...next, error: null };
    patchFlow(campaignId, { cover: merged });
    if (composeInFlightRef.current) await composeInFlightRef.current;

    const latest = getFlowSnapshot(campaignId).cover ?? merged;
    const title = latest.coverTitle;
    const photoIndex = latest.selectedPhotoIndex;
    const templateId = latest.selectedCoverTemplateId;
    const fontId = latest.selectedFontId;

    const run = (async () => {
      await Promise.all([...photoPrepRef.current.values()]);
      const files = photosRef.current.map((photo) => photo.file).filter(Boolean);
      const photo = files[photoIndex] ?? files[0];
      if (!photo || !title) {
        patchFlow(campaignId, {
          cover: { ...latest, error: "Cover generation failed" },
        });
        return;
      }
      try {
        setCoverComposing(true);
        const imageUrl = await composeCoverFromState(latest, files);
        const after = getFlowSnapshot(campaignId).cover;
        if (
          after &&
          after.selectedPhotoIndex === photoIndex &&
          after.coverTitle === title &&
          after.selectedCoverTemplateId === templateId &&
          after.selectedFontId === fontId
        ) {
          patchFlow(campaignId, {
            cover: {
              ...after,
              generatedCoverImageUrl: imageUrl,
              error: null,
            },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Cover generation failed";
        const after = getFlowSnapshot(campaignId).cover;
        if (
          after &&
          after.selectedPhotoIndex === photoIndex &&
          after.coverTitle === title &&
          after.selectedCoverTemplateId === templateId &&
          after.selectedFontId === fontId
        ) {
          patchFlow(campaignId, {
            cover: {
              ...after,
              generatedCoverImageUrl: null,
              error: message,
            },
          });
        }
      } finally {
        setCoverComposing(false);
      }
    })();

    composeInFlightRef.current = run;
    void run.finally(() => {
      if (composeInFlightRef.current === run) composeInFlightRef.current = null;
    });
    return run;
  }, [campaignId]);

  const retryCover = useCallback(async () => {
    await composeCurrentCover();
  }, [composeCurrentCover]);

  const selectCoverTemplate = useCallback(
    async (templateId: string) => {
      if (!isCoverTemplateId(templateId)) return;
      const cover = getFlowSnapshot(campaignId).cover;
      if (!cover || cover.selectedCoverTemplateId === templateId) return;
      const snapshot = getFlowSnapshot(campaignId);
      const remaining = remainingPostPhotos(photosRef.current, templateId, {
        id: cover.coverSourcePhotoId,
        index: cover.selectedPhotoIndex,
        remainingOrder: snapshot.generated?.remainingPhotoIndexes,
      });
      patchFlow(campaignId, { selectedCoverTemplateId: templateId });
      await composeCurrentCover({
        selectedCoverTemplateId: templateId,
        selectedFontId: fontForTemplate(templateId, cover.templateFontIds, cover.selectedFontId),
        remainingPhotoIds: remaining.map((photo) => photo.id),
      });
    },
    [campaignId, composeCurrentCover],
  );

  const updateDraft = useCallback(
    (draft: ResultDraft) => {
      patchFlow(campaignId, { draft });
    },
    [campaignId],
  );

  const photoReady = photos.length > 0 || persisted.photoCount > 0;

  const canAccess = useCallback(
    (step: FlowStep) => {
      switch (step) {
        case "landing":
        case "customer":
          return true;
        case "experience":
          return isCustomerComplete(persisted.customer);
        case "upload":
          return (
            isCustomerComplete(persisted.customer) &&
            isProductFeedbackComplete(persisted.productFeedback)
          );
        case "generating":
        case "result":
        case "publish":
          return (
            isCustomerComplete(persisted.customer) &&
            isProductFeedbackComplete(persisted.productFeedback) &&
            photoReady
          );
        default:
          return false;
      }
    },
    [persisted.customer, persisted.productFeedback, photoReady],
  );

  const firstBlockedStep = useCallback(
    (step: FlowStep): FlowStep | null => {
      if (canAccess(step)) return null;
      if (!isCustomerComplete(persisted.customer)) return "customer";
      if (!isProductFeedbackComplete(persisted.productFeedback)) return "experience";
      if (!photoReady) return "upload";
      return "customer";
    },
    [canAccess, persisted.customer, persisted.productFeedback, photoReady],
  );

  const value = useMemo(
    () => ({
      campaignId,
      hydrated,
      customer: persisted.customer,
      productFeedback: persisted.productFeedback,
      photos,
      generated: persisted.generated,
      draft: persisted.draft,
      cover: persisted.cover,
      coverComposing,
      selectedCoverTemplateId:
        persisted.selectedCoverTemplateId || DEFAULT_COVER_TEMPLATE_ID,
      setCustomer,
      setProductFeedback,
      saveYouPage,
      saveFeelExpense,
      addPhotos,
      removePhoto,
      generatePost,
      updateDraft,
      retryCover,
      selectCoverTemplate,
      canAccess,
      firstBlockedStep,
    }),
    [
      campaignId,
      hydrated,
      persisted.customer,
      persisted.productFeedback,
      persisted.generated,
      persisted.draft,
      persisted.cover,
      persisted.selectedCoverTemplateId,
      coverComposing,
      photos,
      setCustomer,
      setProductFeedback,
      saveYouPage,
      saveFeelExpense,
      addPhotos,
      removePhoto,
      generatePost,
      updateDraft,
      retryCover,
      selectCoverTemplate,
      canAccess,
      firstBlockedStep,
    ],
  );

  return (
    <CampaignFlowContext.Provider value={value}>{children}</CampaignFlowContext.Provider>
  );
}

export function useCampaignFlow() {
  const context = useContext(CampaignFlowContext);
  if (!context) {
    throw new Error("useCampaignFlow must be used within CampaignFlowProvider");
  }
  return context;
}

export { MAX_PHOTOS };
