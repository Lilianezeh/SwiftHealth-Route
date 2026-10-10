/** Grey blocks where the cards will be, so a loading screen is never blank. UI spec, "Standard states". */
export function ResultsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="h-56 animate-pulse rounded-2xl bg-closed-bg motion-reduce:animate-none" />
      <div className="h-56 animate-pulse rounded-2xl bg-closed-bg motion-reduce:animate-none" />
      <div className="h-56 animate-pulse rounded-2xl bg-closed-bg motion-reduce:animate-none" />
    </div>
  );
}
