"use client"

import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"
import type {
  ConsumeRedemptionResult,
  RedemptionLookup,
} from "@/lib/merchant/redeem"

type LookupPanelProps = {
  lookup: RedemptionLookup | null
  consumeResult: ConsumeRedemptionResult | null
  pending: boolean
  onConsume: () => void
}

export function LookupPanel({
  lookup,
  consumeResult,
  pending,
  onConsume,
}: LookupPanelProps) {
  if (consumeResult?.status === "redeemed") {
    return (
      <StatusBanner
        tone="success"
        title={`${consumeResult.rewardName} redeemed.`}
      >
        Stamp balance is now {consumeResult.newStampCount}. This reward cannot
        be redeemed again.
      </StatusBanner>
    )
  }

  if (consumeResult?.status === "blocked") {
    return (
      <StatusBanner tone="error" title="Redemption blocked.">
        {consumeResult.reason}
      </StatusBanner>
    )
  }

  if (!lookup) {
    return (
      <div className="rounded-lg border bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground">
        Scan a customer reward QR or paste its code to preview it here.
      </div>
    )
  }

  if (lookup.status !== "ready") {
    return (
      <StatusBanner tone="error" title="Reward QR cannot be used.">
        {lookup.reason}
      </StatusBanner>
    )
  }

  return (
    <div className="grid gap-4 rounded-lg border bg-background p-5">
      <div className="grid gap-1">
        <p className="font-mono text-xs font-bold text-muted-foreground uppercase">
          Ready to redeem
        </p>
        <h2 className="text-2xl font-extrabold">{lookup.rewardName}</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {lookup.rewardTerms}
        </p>
      </div>

      <dl className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3 border-t pt-2">
          <dt className="font-bold">Customer</dt>
          <dd className="text-right text-muted-foreground">
            {lookup.customerLabel}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t pt-2">
          <dt className="font-bold">Code</dt>
          <dd className="font-mono text-xs text-muted-foreground">
            {lookup.publicToken}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t pt-2">
          <dt className="font-bold">Expires</dt>
          <dd className="text-right text-muted-foreground">
            {formatTime(lookup.expiresAt)}
          </dd>
        </div>
      </dl>

      <Button onClick={onConsume} disabled={pending}>
        {pending ? "Redeeming..." : "Confirm redemption"}
      </Button>
    </div>
  )
}

function formatTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date)
}
