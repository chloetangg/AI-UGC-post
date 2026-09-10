"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { isPoolHashtag, isRequiredHashtag } from "@/lib/hashtags";
import { Input } from "@/components/ui/input";
import { useT } from "@/components/providers/language-provider";

function normalizeTag(value: string) {
  const trimmed = value.trim().replace(/^#+/, "");
  return trimmed ? `#${trimmed}` : "";
}

export function HashtagEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const tag = normalizeTag(raw);
    if (!tag) return;
    if (!isPoolHashtag(tag) || isRequiredHashtag(tag)) {
      setDraft("");
      return;
    }
    if (value.includes(tag) || value.length >= 5) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t.result.hashtags}</h2>
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
          >
            {tag}
            {isRequiredHashtag(tag) ? null : (
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item !== tag))}
                aria-label={`Remove ${tag}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </span>
        ))}
      </div>
      <Input
        value={draft}
        placeholder={t.result.addHashtag}
        disabled={value.length >= 5}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " " || event.key === ",") {
            event.preventDefault();
            addTag(draft);
          }
        }}
        onBlur={() => addTag(draft)}
      />
    </section>
  );
}
