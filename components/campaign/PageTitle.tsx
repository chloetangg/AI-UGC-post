export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6 space-y-2">
      <h1 className="font-display text-[1.85rem] leading-tight tracking-tight text-foreground">
        {title}
      </h1>
      {subtitle ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}
