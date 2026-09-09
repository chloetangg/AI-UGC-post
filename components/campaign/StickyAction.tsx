import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function StickyAction({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-auto bg-gradient-to-t from-background via-background/95 to-transparent px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Button type={type} className="w-full" disabled={disabled} onClick={onClick}>
        {children}
      </Button>
    </div>
  );
}
