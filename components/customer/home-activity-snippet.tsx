import Link from "next/link"

import { MonoTag, SectionHeader } from "@/components/brand"
import {
  type CustomerActivityCategory,
  type CustomerActivityItem,
} from "@/lib/customer/activity"
import { formatRelativeTime } from "@/lib/customer/format"

const toneByCategory: Record<
  CustomerActivityCategory,
  "accent" | "ink" | "leaf"
> = {
  join: "ink",
  stamp: "accent",
  reward: "leaf",
}

export function HomeActivitySnippet({
  items,
}: {
  items: readonly CustomerActivityItem[]
}) {
  if (items.length === 0) return null

  return (
    <section className="grid gap-4">
      <SectionHeader eyebrow="Recent activity" title="Latest visits" />
      <ol className="grid gap-3">
        {items.map((item) => (
          <li key={item.id} className="surface-card grid gap-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <MonoTag tone={toneByCategory[item.category]}>
                {item.badgeLabel}
              </MonoTag>
              <time
                dateTime={item.createdAt}
                className="font-mono text-[0.625rem] font-bold tracking-[0.06em] text-muted-foreground uppercase"
              >
                {formatRelativeTime(item.createdAt)}
              </time>
            </div>
            <p className="text-sm leading-snug font-bold">{item.title}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              {item.description}
            </p>
          </li>
        ))}
      </ol>
      <Link
        href="/home/activity"
        className="justify-self-start font-mono text-[0.68rem] font-bold tracking-[0.08em] text-foreground uppercase underline-offset-4 hover:underline"
      >
        See all activity
      </Link>
    </section>
  )
}
