export function Footer() {
  return (
    <footer className="mt-auto w-full px-5 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-[430px] flex-col items-center gap-2">
        <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground">Powered by</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/seedi-logo.png?v=2"
          alt="seedai"
          className="h-auto w-[130px] max-w-[70vw] object-contain object-center"
        />
      </div>
    </footer>
  );
}
