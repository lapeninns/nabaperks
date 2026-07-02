import type { ProductEventName } from "@/lib/analytics/events"

/**
 * The curated pilot funnel: the eight product events that actually form the
 * merchant-setup-to-redemption journey, with human labels for the console.
 * Pure module (type-only import) so the admin landing, the pilot report, and
 * the unit runner all share one definition instead of the full 39-event
 * stream.
 */
export type PilotFunnelStage = {
  readonly event: ProductEventName
  readonly label: string
}

export const PILOT_FUNNEL_STAGES: readonly PilotFunnelStage[] = [
  { event: "merchant_signed_up", label: "Merchant signed up" },
  { event: "loyalty_card_created", label: "Loyalty card created" },
  { event: "qr_created", label: "QR code created" },
  { event: "qr_scanned", label: "QR scanned" },
  { event: "customer_joined", label: "Customer joined" },
  { event: "stamp_issued", label: "Stamp issued" },
  { event: "reward_unlocked", label: "Reward unlocked" },
  { event: "reward_redeemed", label: "Reward redeemed" },
]

export const pilotFunnelEventNames: readonly ProductEventName[] =
  PILOT_FUNNEL_STAGES.map((stage) => stage.event)

/** Chart items in stage order; events missing from `counts` read as zero. */
export function toPilotFunnelItems(counts: Record<string, number>) {
  return PILOT_FUNNEL_STAGES.map(({ event, label }) => ({
    label,
    value: counts[event] ?? 0,
  }))
}
