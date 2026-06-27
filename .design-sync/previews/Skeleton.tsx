import { Skeleton } from "nabaperks"

export const Default = () => <Skeleton className="h-4 w-40" />

export const StampCardLoading = () => (
  <div className="flex max-w-sm items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/5">
    <Skeleton className="size-12 rounded-full" />
    <div className="grid flex-1 gap-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-44" />
    </div>
  </div>
)

export const GridLoading = () => (
  <div className="grid max-w-xs grid-cols-4 gap-3">
    {Array.from({ length: 8 }).map((_, i) => (
      <Skeleton key={i} className="size-12 rounded-full" />
    ))}
  </div>
)
