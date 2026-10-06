export function PageTitle({
  title,
  subtitle,
  centered = false,
}: {
  title: string;
  subtitle?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mb-6 space-y-2 text-center" : "mb-6 space-y-2"}>
      <h1 className="font-display text-[1.85rem] leading-tight tracking-tight text-foreground">
        {title}
      </h1>
      {subtitle ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}
