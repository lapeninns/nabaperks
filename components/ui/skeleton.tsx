import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  // Default rounding stays here (a sane `rounded-lg` that per-usage classes can
  // override via tailwind-merge); the ink-tinted fill is owned by the Wet Ink
  // `[data-slot="skeleton"]` layer in `app/globals.css`.
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-lg motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
