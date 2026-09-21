import { getCurrentMerchant } from "@/lib/auth/session"
import { getVenueCodeToday } from "@/lib/merchant/venue-code"

import { TeamCodePanelView } from "./team-code-panel-view"

/**
 * Today's team code — the fallback a team member reads out when a
 * customer's phone cannot confirm they are at the venue. Streamed in its own
 * boundary; the view is mounted DB-free by the harness with fixture props.
 */
export async function TeamCodePanel() {
  const merchant = await getCurrentMerchant()
  if (!merchant) return null

  const today = await getVenueCodeToday(merchant.id)

  return (
    <TeamCodePanelView
      code={today?.code ?? null}
      rotatesAt={today?.rotatesAt ?? null}
      nowIso={new Date().toISOString()}
      rotationAvailable={today !== null}
    />
  )
}
