import {
  PersonaSpokePage,
  personaPageMetadata,
} from "@/components/marketing/persona-page"
import { getMarketingPersona, OFFER, PRODUCT } from "@/lib/marketing/facts"

const persona = getMarketingPersona("cafes")
const title = "Café Loyalty Cards Without an App"
const description = `${OFFER.nameSafe} for cafés: a browser loyalty card launched for you — no customer app or POS work. Pay ${PRODUCT.launchFee} for the launch, then use a ${PRODUCT.pilot} before ${PRODUCT.price}.`

export const metadata = personaPageMetadata({ persona, title, description })

export default function LoyaltyForCafesPage() {
  return (
    <PersonaSpokePage
      persona={persona}
      title={title}
      description={description}
    />
  )
}
