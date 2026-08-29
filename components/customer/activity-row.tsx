import {
  type CustomerActivityCategory,
  type CustomerActivityItem,
} from "@/lib/customer/activity"
import { formatRelativeTime } from "@/lib/customer/format"
import { cn } from "@/lib/utils"

/**
 * One activity entry, shared by `/home/activity` and the dashboard snippet.
 *
 * The two surfaces used to declare this markup — and the `toneByCategory` map —
 * independently, so any density fix would have landed on one and not the other
 * (CUS 02#44). One component, one tone map, two densities.
 *
 * The row itself is no longer a shadowed card. Forty `surface-card p-4` rows at
 * ~142px each was ~5,800px of visually identical blocks with no landmarks;
 * these are hairline-separated two-line rows at ~56px, and the timestamp moves
 * from .mono-id (10px, the system floor) up to .mono-meta on the one screen
 * that is entirely about time (CUS 02#43).
 */
const TONE_BY_CATEGORY: Record<CustomerActivityCategory, string> = {
  join: "bg-cobalt",
  stamp: "bg-primary",
  reward: "bg-reward",
}

export function ActivityRow({
  item,
  density = "full",
}: {
  item: CustomerActivityItem
  /** `compact` drops the description — the dashboard snippet's density. */
  density?: "compact" | "full"
}) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1 border-b border-dashed border-line py-2.5 last:border-b-0">
      <span
        aria-hidden="true"
        className={cn(
          "mt-[0.45em] size-2 shrink-0 rounded-full border-2 border-ink",
          TONE_BY_CATEGORY[item.category]
        )}
      />
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-sm leading-snug font-bold">
          {item.title}
        </p>
        <time
          dateTime={item.createdAt}
          className="mono-meta shrink-0 text-muted-foreground"
        >
          {formatRelativeTime(item.createdAt)}
        </time>
      </div>
      {density === "full" ? (
        <p className="col-start-2 text-sm leading-5 text-muted-foreground">
          <span className="mono-meta text-muted-foreground">
            {item.badgeLabel}
          </span>{" "}
          · {item.description}
        </p>
      ) : null}
    </li>
  )
}
