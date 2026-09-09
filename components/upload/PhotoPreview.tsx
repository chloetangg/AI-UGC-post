"use client";

import { X } from "lucide-react";
import { useT } from "@/components/providers/language-provider";
import { interpolate } from "@/lib/i18n";
import type { PhotoItem } from "@/types/content";

export function PhotoPreview({
  photo,
  index,
  onRemove,
}: {
  photo: PhotoItem;
  index: number;
  onRemove: () => void;
}) {
  const t = useT();

  return (
    <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo.thumbUrl ? (
        <img
          src={photo.thumbUrl}
          alt={photo.name || `Photo ${index + 1}`}
          className="size-full object-cover"
        />
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-black/70 text-white"
        aria-label={interpolate(t.upload.removePhoto, { index: index + 1 })}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
