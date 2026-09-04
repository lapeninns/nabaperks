import { activityCategory, type ActivitySummary } from "./activity-display"

/** Add one aggregated product-event bucket to the merchant's weekly pulse. */
export function applyActivityEventCount(
  summary: ActivitySummary,
  eventName: string,
  count: number
) {
  if (count <= 0) return

  switch (eventName) {
    case "customer_joined":
      summary.joins += count
      break
    case "stamp_issued":
    case "referral_bonus_awarded":
      summary.stamps += count
      break
    case "reward_redeemed":
      summary.rewards += count
      break
    case "qr_downloaded":
    case "qr_scanned":
      summary.qrEvents += count
      break
    default:
      if (activityCategory(eventName) === "account") {
        summary.accountEvents += count
        break
      }
      return
  }

  summary.total += count
}
