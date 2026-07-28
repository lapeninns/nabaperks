import { buildQrMatrix } from "@/components/marketing/landing"
import { personaPageMetadata } from "@/components/marketing/persona-page"
import { PubsPage } from "@/components/marketing/pubs"
import { getMarketingPersona, ROUTES } from "@/lib/marketing/facts"
import { absoluteUrl } from "@/lib/seo/structured-data"

const persona = getMarketingPersona("pubs")
const title = "Pub Loyalty Cards Without an App — Buyer’s Guide"
/**
 * The hub's description sells the *guide*, not the offer — the route ranks on
 * the buying question, and `/` already owns the offer pitch in search.
 */
const description =
  "An honest guide to loyalty schemes for UK food-led pubs: paper cards, your own app, wallet passes and QR browser cards compared — what each costs your staff, and how they fail."

export const metadata = personaPageMetadata({ persona, title, description })

export default function LoyaltyForPubsPage() {
  const demoQr = buildQrMatrix(absoluteUrl(ROUTES.demo))

  return (
    <PubsPage
      persona={persona}
      demoQr={demoQr}
      title={title}
      description={description}
    />
  )
}
