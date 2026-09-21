"use client";

import { useState, startTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageTitle } from "@/components/campaign/PageTitle";
import { StickyAction } from "@/components/campaign/StickyAction";
import { FlowGuard } from "@/components/flow/FlowGuard";
import { ChoiceChip } from "@/components/preferences/ChoiceChip";
import { OriginCityField } from "@/components/customer/OriginCityField";
import { useCampaignFlow } from "@/components/providers/campaign-flow-provider";
import { Input } from "@/components/ui/input";
import { ExperienceNoteField } from "@/components/experience/ExperienceNoteField";
import { ReasonMultiSelect } from "@/components/experience/ReasonMultiSelect";
import { PhotoUploader } from "@/components/upload/PhotoUploader";
import { campaignPath } from "@/lib/flow";
import { interpolate, recommendationReasonLabel } from "@/lib/i18n";
import { useT } from "@/components/providers/language-provider";
import { isKnownOriginCity } from "@/lib/world-cities";
import {
  midpointForMealExpenseRange,
  pruneRecommendationReasons,
  reasonsForDish,
  RECOMMENDATION_REASON_OTHER,
} from "@/lib/recommendation-reasons";
import { isMealExpenseRangeComplete, parseMealExpenseBaht } from "@/lib/meal-expense";
import {
  CUSTOMER_TYPES,
  ENJOY_MOST,
  ENJOY_MOST_OTHER,
  MEAL_EXPENSE_RANGES,
  RECOMMENDED_DISHES,
  VISIT_FREQUENCIES,
  emptyProductFeedback,
  isDiningExperienceNoteComplete,
  countDiningExperienceUnits,
  withDefaultBranch,
  type EnjoyMost,
  type MealExpenseRange,
  type RecommendedDish,
  type VisitFrequency,
} from "@/types/content";

export default function ExperiencePage() {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();
  const {
    customer,
    setCustomer,
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
  const visitFrequency = VISIT_FREQUENCIES.includes(feedback.visitFrequency as VisitFrequency)
    ? feedback.visitFrequency
    : "";

  const identityReady = Boolean(feedback.customerType && visitFrequency);
  const originReady = isKnownOriginCity(customer.location);
  const expenseReady = isMealExpenseRangeComplete(feedback.mealExpenseRange, feedback.totalMealExpense);
  const noteReady = isDiningExperienceNoteComplete(feedback.diningExperienceNote);
  const photosReady = photos.length > 0;
  const ready = identityReady && originReady && expenseReady && noteReady && photosReady;
  const noteCount = countDiningExperienceUnits(feedback.diningExperienceNote);
  const selectedDishes = feedback.recommendedDishes.filter((dish) => dish !== "Others");
  const hasOthersDish = feedback.recommendedDishes.includes("Others");
  const hasReasonOther = feedback.recommendTo.includes(RECOMMENDATION_REASON_OTHER);
  const showReasonOther = selectedDishes.length > 0;
  const reasonGroups = selectedDishes.map((dish) => ({
    id: dish,
    label: t.options.recommendedDishes[dish],
    options: reasonsForDish(dish).map((reason) => ({
      value: reason,
      label: t.options.recommendTo[reason],
    })),
  }));

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

  function patchFeedback(next: Partial<typeof feedback>) {
    setProductFeedback({ ...feedback, ...next });
  }

  function toggleEnjoyMost(option: EnjoyMost) {
    if (option === ENJOY_MOST_OTHER) {
      const selecting = !feedback.enjoyMost.includes(ENJOY_MOST_OTHER);
      patchFeedback({
        enjoyMost: selecting
          ? [...feedback.enjoyMost, ENJOY_MOST_OTHER]
          : feedback.enjoyMost.filter((item) => item !== ENJOY_MOST_OTHER),
        enjoyMostOther: selecting ? feedback.enjoyMostOther : "",
      });
      return;
    }
    const selected = feedback.enjoyMost.includes(option)
      ? feedback.enjoyMost.filter((item) => item !== option)
      : [...feedback.enjoyMost, option];
    patchFeedback({ enjoyMost: selected });
  }

  function setEnjoyMostOther(value: string) {
    const hasText = value.trim().length > 0;
    const without = feedback.enjoyMost.filter((item) => item !== ENJOY_MOST_OTHER);
    patchFeedback({
      enjoyMost: hasText ? [...without, ENJOY_MOST_OTHER] : without,
      enjoyMostOther: value,
    });
  }

  function keepRecommendToOther(recommendTo: string[], recommendedDishes: RecommendedDish[] = feedback.recommendedDishes) {
    return recommendTo.includes(RECOMMENDATION_REASON_OTHER) || recommendedDishes.includes("Others")
      ? feedback.recommendToOther
      : "";
  }

  function patchRecommendTo(recommendTo: string[]) {
    patchFeedback({
      recommendTo,
      recommendToOther: keepRecommendToOther(recommendTo),
    });
  }

  function toggleRecommendedDish(option: RecommendedDish) {
    if (option === "Others") {
      const selecting = !feedback.recommendedDishes.includes("Others");
      const recommendedDishes: RecommendedDish[] = selecting
        ? [...feedback.recommendedDishes, "Others"]
        : feedback.recommendedDishes.filter((item) => item !== "Others");
      const recommendTo = pruneRecommendationReasons(feedback.recommendTo, recommendedDishes);
      patchFeedback({
        recommendedDishes,
        recommendedDishOther: selecting ? feedback.recommendedDishOther : "",
        recommendTo,
        recommendToOther: keepRecommendToOther(recommendTo, recommendedDishes),
      });
      return;
    }
    const recommendedDishes: RecommendedDish[] = feedback.recommendedDishes.includes(option)
      ? feedback.recommendedDishes.filter((item) => item !== option)
      : [...feedback.recommendedDishes, option];
    const recommendTo = pruneRecommendationReasons(feedback.recommendTo, recommendedDishes);
    patchFeedback({
      recommendedDishes,
      recommendTo,
      recommendToOther: keepRecommendToOther(recommendTo, recommendedDishes),
    });
  }

  function setRecommendedDishOther(value: string) {
    const hasText = value.trim().length > 0;
    const withoutOthers = feedback.recommendedDishes.filter((item) => item !== "Others");
    const recommendedDishes: RecommendedDish[] = hasText ? [...withoutOthers, "Others"] : withoutOthers;
    const recommendTo = pruneRecommendationReasons(feedback.recommendTo, recommendedDishes);
    patchFeedback({
      recommendedDishes,
      recommendedDishOther: value,
      recommendTo,
      recommendToOther: keepRecommendToOther(recommendTo, recommendedDishes),
    });
  }

  function selectExpenseRange(range: MealExpenseRange) {
    if (range === "฿2,000+") {
      patchFeedback({
        mealExpenseRange: range,
        totalMealExpense: feedback.mealExpenseRange === "฿2,000+" ? feedback.totalMealExpense : null,
      });
      return;
    }
    patchFeedback({
      mealExpenseRange: range,
      totalMealExpense: midpointForMealExpenseRange(range),
    });
  }

  function setOver2000Amount(text: string) {
    patchFeedback({
      mealExpenseRange: "฿2,000+",
      totalMealExpense: parseMealExpenseBaht(text),
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
            <h2 className="text-base font-semibold">{t.experience.q3Title}</h2>
            <p className="text-sm text-muted-foreground">{t.experience.q3Description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {VISIT_FREQUENCIES.map((option) => (
              <ChoiceChip
                key={option}
                label={t.options.visitFrequencies[option]}
                selected={visitFrequency === option}
                onClick={() => patchFeedback({ visitFrequency: option })}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{t.experience.q2Title}</h2>
            <p className="text-sm text-muted-foreground">{t.experience.q2Description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CUSTOMER_TYPES.map((option) => (
              <ChoiceChip
                key={option}
                label={t.options.customerTypes[option]}
                selected={feedback.customerType === option}
                onClick={() => patchFeedback({ customerType: option })}
              />
            ))}
          </div>
          {touched && !identityReady ? (
            <p className="text-sm text-destructive">{t.experience.requiredError}</p>
          ) : null}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{t.experience.q4Title}</h2>
            <p className="text-sm text-muted-foreground">{t.experience.q4Description}</p>
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
          {feedback.enjoyMost.includes(ENJOY_MOST_OTHER) || feedback.enjoyMostOther ? (
            <Input
              value={feedback.enjoyMostOther}
              placeholder={t.experience.q4OthersPlaceholder}
              onChange={(event) => setEnjoyMostOther(event.target.value)}
            />
          ) : null}
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
          {hasOthersDish || feedback.recommendedDishOther ? (
            <Input
              value={feedback.recommendedDishOther}
              placeholder={t.experience.q5OthersPlaceholder}
              onChange={(event) => setRecommendedDishOther(event.target.value)}
            />
          ) : null}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{t.experience.q6Title}</h2>
            <p className="text-sm text-muted-foreground">{t.experience.q6Description}</p>
          </div>
          <ReasonMultiSelect
            groups={reasonGroups}
            selected={feedback.recommendTo}
            placeholder={t.experience.q6Placeholder}
            emptyLabel={t.experience.q6Empty}
            otherOption={
              showReasonOther
                ? {
                    value: RECOMMENDATION_REASON_OTHER,
                    label: t.options.recommendTo[RECOMMENDATION_REASON_OTHER],
                  }
                : undefined
            }
            onChange={patchRecommendTo}
          />
          {feedback.recommendTo.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {feedback.recommendTo.map((reason) => (
                <ChoiceChip
                  key={reason}
                  label={recommendationReasonLabel(t, reason)}
                  selected
                  onClick={() =>
                    patchRecommendTo(feedback.recommendTo.filter((item) => item !== reason))
                  }
                />
              ))}
            </div>
          ) : null}
          {hasReasonOther || hasOthersDish ? (
            <Input
              value={feedback.recommendToOther}
              placeholder={t.experience.q6CustomPlaceholder}
              onChange={(event) => patchFeedback({ recommendToOther: event.target.value })}
            />
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">{t.experience.q7Title}</h2>
          <ExperienceNoteField
            value={feedback.diningExperienceNote}
            placeholder={t.experience.q7Placeholder}
            invalid={touched && !noteReady}
            onChange={(diningExperienceNote) => patchFeedback({ diningExperienceNote })}
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
            <h2 className="text-base font-semibold">{t.experience.qExpenseTitle}</h2>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {MEAL_EXPENSE_RANGES.map((range) =>
              range === "฿2,000+" ? (
                <div key={range} className="space-y-2">
                  <ChoiceChip
                    label={range}
                    selected={feedback.mealExpenseRange === range}
                    onClick={() => selectExpenseRange(range)}
                  />
                  {feedback.mealExpenseRange === "฿2,000+" ? (
                    <Input
                      className="min-w-[16rem]"
                      inputMode="numeric"
                      placeholder={t.experience.qExpenseOverPlaceholder}
                      value={feedback.totalMealExpense != null ? String(feedback.totalMealExpense) : ""}
                      onChange={(event) => setOver2000Amount(event.target.value)}
                    />
                  ) : null}
                </div>
              ) : (
                <ChoiceChip
                  key={range}
                  label={range}
                  selected={feedback.mealExpenseRange === range}
                  onClick={() => selectExpenseRange(range)}
                />
              ),
            )}
          </div>
          {touched && !expenseReady ? (
            <p className="text-xs text-destructive">
              {feedback.mealExpenseRange === "฿2,000+"
                ? t.experience.qExpenseOverPlaceholder
                : t.experience.qExpenseError}
            </p>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">{t.experience.qOriginTitle}</h2>
          <OriginCityField
            value={customer.location}
            invalid={touched && !originReady}
            placeholder={t.customer.locationPlaceholder}
            searchPlaceholder={t.customer.locationSearchPlaceholder}
            noMatches={t.customer.locationNoMatches}
            onChange={(location) => setCustomer({ ...customer, location })}
          />
          {touched && !originReady ? (
            <p className="text-sm text-destructive">{t.customer.errors.location}</p>
          ) : null}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{t.upload.title}</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{t.upload.subtitle}</p>
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
