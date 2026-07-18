import {
  PersonaSpokePage,
  personaPageMetadata,
} from "@/components/marketing/persona-page"
import { getMarketingPersona, OFFER, PRODUCT } from "@/lib/marketing/facts"

const persona = getMarketingPersona("bars")
const title = "Bar Loyalty Cards Without an App"
const description = `${OFFER.nameSafe} for bars: a browser loyalty card launched for you — no customer app, no POS work. ${PRODUCT.pilot}, then ${PRODUCT.price}.`

export const metadata = personaPageMetadata({ persona, title, description })

export default function LoyaltyForBarsPage() {
  return (
    <PersonaSpokePage
      persona={persona}
      title={title}
      description={description}
    />
  )
}
