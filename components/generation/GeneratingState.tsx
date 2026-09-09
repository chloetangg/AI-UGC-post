"use client";

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/language-provider";

type GeneratingStateProps = {
  error?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  phase?: "post" | "cover";
};

export function GeneratingState({
  error = false,
  errorMessage,
  onRetry,
  phase = "post",
}: GeneratingStateProps) {
  const t = useT();
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    if (error) return;
    const progressTimer = window.setInterval(() => {
      setProgress((current) => Math.min(current + 8, 96));
    }, 180);
    return () => {
      window.clearInterval(progressTimer);
    };
  }, [error]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <p className="font-display text-2xl text-foreground">{t.generating.error}</p>
        {errorMessage ? (
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">{errorMessage}</p>
        ) : null}
        {onRetry ? (
          <Button className="mt-6" onClick={onRetry}>
            {t.generating.retry}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-8 size-20">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="relative flex size-20 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border">
          <div className="size-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        </div>
      </div>
      <p className="font-display text-2xl text-foreground">
        {phase === "cover" ? t.generating.cover : t.generating.post}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{t.generating.wait}</p>
      <div className="mt-8 w-full max-w-xs">
        <Progress value={progress} />
      </div>
    </div>
  );
}
