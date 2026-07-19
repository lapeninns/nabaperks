import {
  PersonaSpokePage,
  personaPageMetadata,
} from "@/components/marketing/persona-page"
import { getMarketingPersona, OFFER, PRODUCT } from "@/lib/marketing/facts"

const persona = getMarketingPersona("pubs")
const title = "Pub Loyalty Cards Without an App — Buyer’s Guide"
const description = `${OFFER.name}: Lapen Inns launches a no-app browser loyalty card for single-site UK food-led pubs — ${PRODUCT.pilot}, then ${PRODUCT.price}.`

export const metadata = personaPageMetadata({ persona, title, description })

export default function LoyaltyForPubsPage() {
  return (
    <PersonaSpokePage
      persona={persona}
      title={title}
      description={description}
    />
  )
}
