import { EmptyState, MonoTag, PageTitle } from "@/components/brand"
import {
  getCustomerActivity,
  type CustomerActivityCategory,
  type CustomerActivityItem,
} from "@/lib/customer/activity"
import { formatRelativeTime } from "@/lib/customer/format"

export const metadata = {
  title: "Your activity — Nabaperks",
}

const toneByCategory: Record<CustomerActivityCategory, "accent" | "ink" | "leaf"> = {
  join: "ink",
  stamp: "accent",
  reward: "leaf",
}

export default async function WalletActivityPage() {
  const items = await getCustomerActivity()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Your wallet"
        title="Activity"
        description="Every stamp and reward across your cards, newest first."
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Your stamps and rewards will appear here once you start visiting venues."
        />
      ) : (
        <ol className="grid gap-3">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ol>
      )}
    </div>
  )
}

function ActivityRow({ item }: { item: CustomerActivityItem }) {
  return (
    <li className="surface-card grid gap-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <MonoTag tone={toneByCategory[item.category]}>{item.badgeLabel}</MonoTag>
        <span className="font-mono text-[0.625rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
          {formatRelativeTime(item.createdAt)}
        </span>
      </div>
      <p className="text-sm leading-snug font-bold">{item.title}</p>
      <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
    </li>
  )
}
