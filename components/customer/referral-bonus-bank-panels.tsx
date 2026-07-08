import { UserMultiple02Icon } from "@hugeicons/core-free-icons"

import { Icon, MonoTag } from "@/components/brand"
import {
  referralBonusBankCopy,
  type ReferralBonusBankCopy,
} from "@/lib/customer/referral-bonus-bank-copy"
import type { ReferralBonusBank } from "@/lib/customer/referral-bonus-bank"

export function ReferralBonusBankNotice({
  bank,
}: {
  bank: ReferralBonusBank
}) {
  const copy = referralBonusBankCopy(bank)

  return (
    <section
      data-testid="referral-bonus-bank"
      className="grid gap-3 rounded-lg border-2 border-ink bg-seal/15 p-3 text-left"
    >
      <ReferralBonusBankHeader copy={copy} iconSize={16} />
      <p className="text-sm leading-tight font-extrabold break-words">
        {copy.headline}
      </p>
      <dl
        className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3"
        aria-label="Referral bonus bank"
      >
        {copy.stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-md border-2 border-ink bg-card px-2 py-1"
          >
            <dt className="mono-id text-muted-foreground">{stat.label}</dt>
            <dd className="text-base leading-none font-black text-ink">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm leading-6 text-muted-foreground">{copy.detail}</p>
      <div className="rounded-md border-2 border-ink bg-card/80 px-3 py-2">
        <p className="mono-id text-ink">Stamp rule</p>
        <p className="text-sm leading-5 text-ink-soft">{copy.ruleSummary}</p>
      </div>
    </section>
  )
}

export function ReferralBonusBankMini({ bank }: { bank: ReferralBonusBank }) {
  const copy = referralBonusBankCopy(bank)

  return (
    <div
      data-testid="home-referral-bonus-bank"
      className="grid gap-1.5 rounded-lg border-2 border-ink bg-seal/15 p-3"
    >
      <ReferralBonusBankHeader copy={copy} iconSize={14} compact />
      <p className="text-sm leading-tight font-extrabold break-words">
        {copy.headline}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        {copy.compactDetail}
      </p>
      <p className="mono-id text-ink-soft">{copy.badgeLabel} limit</p>
    </div>
  )
}

function ReferralBonusBankHeader({
  copy,
  iconSize,
  compact = false,
}: {
  readonly copy: ReferralBonusBankCopy
  readonly iconSize: number
  readonly compact?: boolean
}) {
  const title = compact ? "Bonus bank" : "Referral bonus bank"

  return (
    <div
      className={
        compact
          ? "flex min-w-0 flex-wrap items-start justify-between gap-2"
          : "flex min-w-0 flex-wrap items-start justify-between gap-3"
      }
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon icon={UserMultiple02Icon} size={iconSize} />
        <p className="mono-meta text-ink">{title}</p>
      </div>
      <MonoTag className={compact ? "shrink-0" : "shrink-0 px-2.5 py-1"}>
        {copy.badgeLabel}
      </MonoTag>
    </div>
  )
}
