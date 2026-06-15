import { Skeleton } from "@/components/ui/skeleton"

export default function MerchantAppLoading() {
  return (
    <div
      aria-label="Loading merchant workspace"
      role="status"
      className="grid min-h-[560px] gap-6"
    >
      <div className="grid gap-3">
        <Skeleton className="h-3 w-24 rounded-full bg-ink/15" />
        <Skeleton className="h-10 w-full max-w-sm rounded-[8px] bg-ink/20" />
        <Skeleton className="h-5 w-full max-w-2xl rounded-[8px]" />
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        {["members", "stamps", "revenue"].map((metric) => (
          <div
            key={metric}
            className="grid h-32 content-between rounded-[8px] border-2 border-ink/20 bg-card/70 p-4"
          >
            <Skeleton className="h-3 w-20 rounded-full bg-ink/15" />
            <div className="grid gap-2">
              <Skeleton className="h-8 w-24 rounded-[8px] bg-primary/25" />
              <Skeleton className="h-3 w-32 rounded-full" />
            </div>
          </div>
        ))}
      </section>

      <section className="grid min-h-[260px] gap-3 rounded-[8px] border-2 border-dashed border-ink/25 bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-36 rounded-[8px] bg-ink/20" />
          <Skeleton className="h-9 w-28 rounded-full bg-accent/40" />
        </div>
        <div className="grid gap-3">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="grid grid-cols-[auto_1fr] gap-3">
              <Skeleton className="mt-1 size-3 rounded-full bg-ink/30" />
              <div className="grid gap-2 rounded-[8px] border-2 border-ink/15 bg-card/60 p-3">
                <Skeleton className="h-4 w-3/5 rounded-[8px]" />
                <Skeleton className="h-3 w-2/5 rounded-full bg-muted-foreground/20" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
