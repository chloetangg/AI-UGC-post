"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/language-provider";
import { copyRednoteText } from "@/lib/rednote-publish";

export function CopyButton({ label, value }: { label: string; value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const ok = await copyRednoteText(value);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? t.common.copied : label}
    </Button>
  );
}
