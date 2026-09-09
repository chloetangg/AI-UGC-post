import { cn } from "@/lib/utils";
import type { Campaign } from "@/types/campaign";

export function CampaignHeader({
  campaign,
  compact = false,
}: {
  campaign: Campaign;
  compact?: boolean;
}) {
  const initials = campaign.brandName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn("flex items-center gap-3", compact ? "py-1" : "py-2")}>
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full bg-white p-1 shadow-sm ring-1 ring-border",
          compact ? "size-9 text-xs" : "size-12 text-sm",
        )}
        aria-hidden
      >
        {campaign.heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={campaign.heroImage}
            alt=""
            className="size-full object-contain"
          />
        ) : (
          <span className="font-semibold text-primary">{initials}</span>
        )}
      </div>
      <div className="min-w-0 text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {campaign.brandName}
        </p>
        <p className={cn("truncate font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
          {campaign.campaignName}
        </p>
      </div>
    </div>
  );
}
