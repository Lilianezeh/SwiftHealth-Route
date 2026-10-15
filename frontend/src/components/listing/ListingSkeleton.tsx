/** Grey blocks where the listing will be, so a loading screen is never blank. UI spec, "Standard states". Hidden from screen readers
 * (the page's live region says what is happening); the animation stops for people who ask for less motion.
 */
export function ListingSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="h-10 w-3/4 animate-pulse rounded-xl bg-closed-bg motion-reduce:animate-none" />
      <div className="h-6 w-1/2 animate-pulse rounded-xl bg-closed-bg motion-reduce:animate-none" />
      <div className="h-14 animate-pulse rounded-xl bg-closed-bg motion-reduce:animate-none" />
      <div className="h-12 animate-pulse rounded-xl bg-closed-bg motion-reduce:animate-none" />
      <div className="h-48 animate-pulse rounded-2xl bg-closed-bg motion-reduce:animate-none" />
    </div>
  );
}
