import Link from "next/link"

import { Eyebrow } from "@/components/brand"
import { ActivityRow } from "@/components/customer/activity-row"
import { type CustomerActivityItem } from "@/lib/customer/activity"

/**
 * The last few visits, as a footnote to the wallet.
 *
 * This used to render the Activity page's row markup verbatim — a
 * `surface-card grid gap-2 p-4` per item with a tag row, a title and a two-line
 * description, ~110px each, under a full SectionHeader — roughly 420px of a
 * first-class destination duplicated at maximum weight, at the bottom of a
 * dashboard the member has already stopped scrolling (CUS 02#15). It now shares
 * {@link ActivityRow} with the page it summarises (CUS 02#44) at the compact
 * density: one line per visit, full detail one thumb-tap away in the tab bar.
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
          <ActivityRow key={item.id} item={item} density="compact" />
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
