// Quiet placeholder shown while a section's data loads: the page title
// area and a few rows, in the same layout the real page uses.
export function PageSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Carregando"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8 sm:px-8 lg:py-12"
    >
      <div className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-secondary" />
        <div className="h-12 w-full max-w-md animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="divide-y divide-border border-y border-border">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between gap-6 py-5">
            <div className="space-y-2">
              <div className="h-4 w-56 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-24 animate-pulse rounded bg-secondary/70" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded-lg bg-secondary" />
          </div>
        ))}
      </div>
    </main>
  );
}
