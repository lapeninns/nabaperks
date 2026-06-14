import Link from "next/link"

import { Eyebrow, EmptyState, MonoTag, PageTitle, ReceiptCard, VenueMark } from "@/components/brand"
import { ProgressTrack } from "@/components/loyalty"
import { getCustomerWallet, type WalletCard } from "@/lib/customer/wallet"

export const metadata = {
  title: "Your cards — Nabaperks",
}

export default async function WalletDashboardPage() {
  const { cards } = await getCustomerWallet()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Your wallet"
        title="Your cards"
        description="Every loyalty card you've collected, in one place. Tap a card to add a stamp or redeem."
      />

      {cards.length === 0 ? (
        <EmptyState
          title="No cards yet"
          description="Scan a venue's QR code to collect your first stamp — it'll show up here automatically."
        />
      ) : (
        <div className="grid gap-4">
          {cards.map((card) => (
            <WalletCardTile key={card.membershipId} card={card} />
          ))}
        </div>
      )}
    </div>
  )
}

function WalletCardTile({ card }: { card: WalletCard }) {
  const rewardTag =
    card.redeemableRewards > 0
      ? { tone: "leaf" as const, label: "Reward ready" }
      : card.unlockedRewards > 0
        ? { tone: "sun" as const, label: "Reward soon" }
        : null

  return (
    <Link
      href={`/card/${card.membershipId}`}
      className="block rounded-[var(--radius)] outline-none transition focus-visible:ring-3 focus-visible:ring-ring/35"
      aria-label={`Open your ${card.businessName} card`}
    >
      <ReceiptCard className="grid gap-4 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <Eyebrow>{card.cardName ?? "Loyalty card"}</Eyebrow>
            <h2 className="text-lg leading-tight font-extrabold text-balance">
              {card.businessName}
            </h2>
          </div>
          <VenueMark size={48} name={card.businessName} />
        </div>

        {rewardTag ? <MonoTag tone={rewardTag.tone}>{rewardTag.label}</MonoTag> : null}

        {card.stampsRequired !== null && card.available ? (
          <ProgressTrack
            current={card.currentStamps}
            total={card.stampsRequired}
            label="Reward progress"
            className="rounded-lg bg-accent p-3"
          />
        ) : (
          <p className="rounded-lg border-2 border-dashed border-ink/20 bg-card p-3 text-sm leading-6 text-muted-foreground">
            {card.unavailableReason ?? "This card is unavailable right now."}
          </p>
        )}
      </ReceiptCard>
    </Link>
  )
}
