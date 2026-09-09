import * as React from "react";
import { cn } from "@/lib/utils";

function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold tracking-wide text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
