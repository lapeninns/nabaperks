import Link from "next/link"

import { Eyebrow } from "@/components/brand"
import {
  type CustomerActivityCategory,
  type CustomerActivityItem,
} from "@/lib/customer/activity"
import { formatRelativeTime } from "@/lib/customer/format"
import { cn } from "@/lib/utils"

/** The category's spot ink, as the row's leading rule. */
const toneByCategory: Record<CustomerActivityCategory, string> = {
  join: "bg-cobalt",
  stamp: "bg-primary",
  reward: "bg-reward",
}

/**
 * The last few visits, as a footnote to the wallet.
 *
 * This used to render the Activity page's row markup verbatim — a
 * `surface-card grid gap-2 p-4` per item with a tag row, a title and a two-line
 * description, ~110px each, under a full SectionHeader — roughly 420px of a
 * first-class destination duplicated at maximum weight, at the bottom of a
 * dashboard the member has already stopped scrolling (CUS 02#15).
 *
 * Same items, same words, one line each: the badge and the relative time as
 * meta, the title as the sentence. Full detail is one tap away in the tab bar,
 * which is where the audit points and where the description already lives.
 */
export function HomeActivitySnippet({
  items,
}: {
  items: readonly CustomerActivityItem[]
}) {
  if (items.length === 0) return null

  return (
    <section className="grid gap-2">
      <Eyebrow>Recent activity</Eyebrow>
      <ol className="grid">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-baseline gap-2 border-b border-dashed border-line py-2 last:border-b-0"
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 shrink-0 translate-y-[-0.15em] rounded-full",
                toneByCategory[item.category]
              )}
            />
            <span className="min-w-0 flex-1 truncate text-sm leading-snug font-bold">
              {item.title}
            </span>
            <time
              dateTime={item.createdAt}
              className="mono-meta shrink-0 text-muted-foreground"
            >
              {formatRelativeTime(item.createdAt)}
            </time>
          </li>
        ))}
      </ol>
      <Link
        href="/home/activity"
        className="focus-ring mono-meta justify-self-start rounded-sm text-foreground underline-offset-4 hover:underline"
      >
        See all activity
      </Link>
    </section>
  )
}
