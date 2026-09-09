"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { PhotoPreview } from "@/components/upload/PhotoPreview";
import { MAX_PHOTOS } from "@/components/providers/campaign-flow-provider";
import { useT } from "@/components/providers/language-provider";
import { interpolate } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PhotoItem } from "@/types/content";

const ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export function PhotoUploader({
  photos,
  onAdd,
  onRemove,
}: {
  photos: PhotoItem[];
  onAdd: (files: File[]) => { added: number; rejected: number };
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const [message, setMessage] = useState<string | null>(null);
  const atLimit = photos.length >= MAX_PHOTOS;

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const { added, rejected } = onAdd(Array.from(fileList));
    if (rejected > 0 && added === 0) {
      setMessage(t.upload.typeError);
    } else if (rejected > 0) {
      setMessage(interpolate(t.upload.partialError, { added, rejected }));
    } else {
      setMessage(null);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <p className="text-sm text-muted-foreground">{t.upload.formats}</p>
        <p className="text-sm font-semibold text-foreground">
          {interpolate(t.upload.count, { count: photos.length, max: MAX_PHOTOS })}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
      />

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed border-primary/35 bg-card/70 text-foreground shadow-inner"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
            <ImagePlus className="size-6" />
          </span>
          <span className="text-base font-semibold">+ {t.upload.addPhotos}</span>
          <span className="text-sm text-muted-foreground">{t.upload.emptyHint}</span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {photos.map((photo, index) => (
            <PhotoPreview
              key={photo.id}
              photo={photo}
              index={index}
              onRemove={() => onRemove(photo.id)}
            />
          ))}
          {!atLimit ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-primary/35 bg-card text-primary",
              )}
            >
              <ImagePlus className="size-5" />
              <span className="text-xs font-semibold">{t.upload.add}</span>
            </button>
          ) : null}
        </div>
      )}

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  );
}
