import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ref, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-2xl border border-border bg-card px-4 text-base text-foreground shadow-sm transition-colors outline-none placeholder:text-muted-foreground/80",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
