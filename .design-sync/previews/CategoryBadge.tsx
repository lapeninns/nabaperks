import { CategoryBadge } from "nabaperks"

export const AllCategories = () => (
  <div className="flex max-w-md flex-wrap gap-2">
    <CategoryBadge category="customer" label="New member" />
    <CategoryBadge category="stamp" label="Stamp issued" />
    <CategoryBadge category="reward" label="Reward redeemed" />
    <CategoryBadge category="qr" label="QR scanned" />
    <CategoryBadge category="account" label="Settings updated" />
  </div>
)

export const InActivityRow = () => (
  <div className="grid max-w-sm gap-2">
    {(
      [
        { category: "stamp", label: "Stamp", who: "Priya M.", when: "2 min ago" },
        { category: "customer", label: "Joined", who: "Tom H.", when: "18 min ago" },
        { category: "reward", label: "Reward", who: "Ellie W.", when: "1 hr ago" },
      ] as const
    ).map((row) => (
      <div
        key={row.who}
        className="flex items-center justify-between gap-3 rounded-lg border-2 border-ink bg-card px-3 py-2 shadow-xs"
      >
        <div className="flex items-center gap-2.5">
          <CategoryBadge category={row.category} label={row.label} />
          <span className="text-sm font-semibold">{row.who}</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground uppercase">{row.when}</span>
      </div>
    ))}
  </div>
)
