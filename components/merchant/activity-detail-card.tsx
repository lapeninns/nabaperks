import { ACTIVITY_CATEGORY_ICON, MonoTag } from "@/components/brand"
import type {
  ActivityCategory,
  ActivityDisplayRow,
} from "@/lib/merchant/activity"
import { cn } from "@/lib/utils"

type ActivityDetailCardProps = {
  readonly row: ActivityDisplayRow
}

export function ActivityDetailCard({ row }: ActivityDetailCardProps) {
  return (
    <li className="relative pl-5">
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-4 left-0 size-2.5 rounded-full border-2 border-ink ring-4 ring-background",
          activityDotClass(row.category)
        )}
      />
      <article className="group/activity surface-card border-ink px-4 py-3 transition-[border-color,box-shadow,transform] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none hover:-translate-y-0.5">
        <div className="min-w-0">
          <p className="text-sm leading-6 font-extrabold text-foreground">
            {row.headline}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <CategoryBadge category={row.category} label={row.badgeLabel} />
            <span
              aria-hidden="true"
              className="hidden size-1 rounded-full bg-muted-foreground/35 sm:inline-block"
            />
            <time dateTime={row.timestamp} className="numeric-tabular">
              {row.relativeTime} at {row.timestampLabel}
            </time>
          </div>
        </div>
      </article>
    </li>
  )
}

function CategoryBadge({
  category,
  label,
}: {
  readonly category: ActivityCategory
  readonly label: string
}) {
  return (
    <MonoTag
      tone={categoryBadgeTone(category)}
      icon={ACTIVITY_CATEGORY_ICON[category]}
      className={cn(
        categoryBadgeTone(category) === "plain" && categoryBadgeClass(category)
      )}
    >
      {label}
    </MonoTag>
  )
}

function categoryBadgeTone(
  category: ActivityCategory
): "plain" | "accent" | "ink" | "leaf" | "sun" {
  switch (category) {
    case "customer":
      return "accent"
    case "stamp":
      return "ink"
    case "reward":
      return "leaf"
    case "qr":
      return "sun"
    case "account":
      return "plain"
  }
}

function activityDotClass(category: ActivityCategory) {
  switch (category) {
    case "customer":
      return "bg-accent"
    case "stamp":
      return "bg-primary"
    case "reward":
      return "bg-reward"
    case "qr":
      return "bg-qr"
    case "account":
      return "bg-muted-foreground"
  }
}

function categoryBadgeClass(category: ActivityCategory) {
  switch (category) {
    case "customer":
      return "border-accent/80 bg-accent text-accent-foreground"
    case "stamp":
      return "border-primary/20 bg-primary/10 text-primary"
    case "reward":
      return "border-reward/25 bg-reward/10 text-reward"
    case "qr":
      return "border-qr/20 bg-qr/10 text-foreground"
    case "account":
      return "border-border bg-secondary/70 text-secondary-foreground"
  }
}
