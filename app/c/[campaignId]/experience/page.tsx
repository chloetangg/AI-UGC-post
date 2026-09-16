"use client";

import { useState, startTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageTitle } from "@/components/campaign/PageTitle";
import { StickyAction } from "@/components/campaign/StickyAction";
import { FlowGuard } from "@/components/flow/FlowGuard";
import { ChoiceChip } from "@/components/preferences/ChoiceChip";
import { useCampaignFlow } from "@/components/providers/campaign-flow-provider";
import { Input } from "@/components/ui/input";
import { ExperienceNoteField } from "@/components/experience/ExperienceNoteField";
import { MealExpenseField } from "@/components/experience/MealExpenseField";
import { PhotoUploader } from "@/components/upload/PhotoUploader";
import { campaignPath } from "@/lib/flow";
import { interpolate } from "@/lib/i18n";
import { useT } from "@/components/providers/language-provider";
import {
  ENJOY_MOST,
  RECOMMEND_TO,
  RECOMMENDED_DISHES,
  emptyProductFeedback,
  isDiningExperienceNoteComplete,
  countDiningExperienceUnits,
  withDefaultBranch,
  type EnjoyMost,
  type RecommendTo,
  type RecommendedDish,
} from "@/types/content";
import { isMealExpenseComplete } from "@/lib/meal-expense";

export default function ExperiencePage() {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();
  const {
    productFeedback,
    setProductFeedback,
    saveFeelExpense,
    photos,
    addPhotos,
    removePhoto,
  } = useCampaignFlow();
  const t = useT();
  const [touched, setTouched] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const feedback = withDefaultBranch({ ...emptyProductFeedback, ...productFeedback });

  const expenseReady = isMealExpenseComplete(feedback.totalMealExpense);
  const noteReady = isDiningExperienceNoteComplete(feedback.diningExperienceNote);
  const photosReady = photos.length > 0;
  const ready = expenseReady && noteReady && photosReady;
  const noteCount = countDiningExperienceUnits(feedback.diningExperienceNote);

  function continueNext() {
    setTouched(true);
    if (!ready) return;
    setLeaving(true);
    setProductFeedback(withDefaultBranch(feedback));
    void saveFeelExpense();
    startTransition(() => {
      router.push(campaignPath(campaignId, "generating"));
    });
  }

  function toggleEnjoyMost(option: EnjoyMost) {
    const selected = feedback.enjoyMost.includes(option)
      ? feedback.enjoyMost.filter((item) => item !== option)
      : [...feedback.enjoyMost, option];
    setProductFeedback({ ...feedback, enjoyMost: selected });
  }

  function toggleRecommendedDish(option: RecommendedDish) {
    if (option === "Others") {
      const selecting = !feedback.recommendedDishes.includes("Others");
      setProductFeedback({
        ...feedback,
        recommendedDishes: selecting
          ? [...feedback.recommendedDishes, "Others"]
          : feedback.recommendedDishes.filter((item) => item !== "Others"),
        recommendedDishOther: selecting ? feedback.recommendedDishOther : "",
      });
      return;
    }
    const selected = feedback.recommendedDishes.includes(option)
      ? feedback.recommendedDishes.filter((item) => item !== option)
      : [...feedback.recommendedDishes, option];
    setProductFeedback({
      ...feedback,
      recommendedDishes: selected,
    });
  }

  function toggleRecommendTo(option: RecommendTo) {
    const selected = feedback.recommendTo.includes(option)
      ? feedback.recommendTo.filter((item) => item !== option)
      : [...feedback.recommendTo, option];
    setProductFeedback({
      ...feedback,
      recommendTo: selected,
    });
  }

  function setRecommendedDishOther(value: string) {
    const hasText = value.trim().length > 0;
    const withoutOthers = feedback.recommendedDishes.filter((item) => item !== "Others");
    setProductFeedback({
      ...feedback,
      recommendedDishes: hasText ? [...withoutOthers, "Others"] : withoutOthers,
      recommendedDishOther: value,
    });
  }

  function setDiningExperienceNote(value: string) {
    setProductFeedback({
      ...feedback,
      diningExperienceNote: value,
    });
  }

  return (
    <>
      <FlowGuard step="experience" />
      <PageTitle
        title={t.campaign.title}
        subtitle={t.campaign.subtitle}
      />
      <div className="space-y-7 pb-28">
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{t.experience.qExpenseTitle}</h2>
          </div>
          <MealExpenseField
            value={feedback.totalMealExpense}
            currency={t.experience.qExpenseCurrency}
            placeholder={t.experience.qExpensePlaceholder}
            invalid={touched && !expenseReady}
            onChange={(totalMealExpense) => setProductFeedback({ ...feedback, totalMealExpense })}
          />
          {touched && !expenseReady ? (
            <p className="text-xs text-destructive">{t.experience.qExpenseError}</p>
          ) : null}
        </section>
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{t.experience.q4Title}</h2>
            <p className="text-sm text-muted-foreground">
              {t.experience.q4Description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ENJOY_MOST.map((option) => (
              <ChoiceChip
                key={option}
                label={t.options.enjoyMost[option]}
                selected={feedback.enjoyMost.includes(option)}
                onClick={() => toggleEnjoyMost(option)}
              />
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{t.experience.q5Title}</h2>
            <p className="text-sm text-muted-foreground">{t.experience.q5Description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RECOMMENDED_DISHES.map((option) => (
              <ChoiceChip
                key={option}
                label={t.options.recommendedDishes[option]}
                selected={feedback.recommendedDishes.includes(option)}
                onClick={() => toggleRecommendedDish(option)}
              />
            ))}
          </div>
          <Input
            value={feedback.recommendedDishOther}
            placeholder={t.experience.q5OthersPlaceholder}
            onChange={(event) => setRecommendedDishOther(event.target.value)}
          />
        </section>
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{t.experience.q6Title}</h2>
            <p className="text-sm text-muted-foreground">
              {t.experience.q6Description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RECOMMEND_TO.map((option) => (
              <ChoiceChip
                key={option}
                label={t.options.recommendTo[option]}
                selected={feedback.recommendTo.includes(option)}
                onClick={() => toggleRecommendTo(option)}
              />
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-base font-semibold">{t.experience.q7Title}</h2>
          <ExperienceNoteField
            value={feedback.diningExperienceNote}
            placeholder={t.experience.q7Placeholder}
            invalid={touched && !noteReady}
            onChange={setDiningExperienceNote}
          />
          <p className="text-sm text-muted-foreground">
            {interpolate(t.experience.q7Hint, { count: noteCount })}
          </p>
          {touched && !noteReady ? (
            <p className="text-sm text-destructive">{t.experience.q7Error}</p>
          ) : null}
        </section>
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{t.upload.title}</h2>
            <p className="text-sm text-muted-foreground">{t.upload.subtitle}</p>
          </div>
          <PhotoUploader photos={photos} onAdd={addPhotos} onRemove={removePhoto} />
          {touched && !photosReady ? (
            <p className="text-sm text-destructive">{t.upload.requiredError}</p>
          ) : null}
        </section>
      </div>
      <StickyAction disabled={leaving} onClick={continueNext}>{t.upload.generate}</StickyAction>
    </>
  );
}
