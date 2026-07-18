import {
  PersonaSpokePage,
  personaPageMetadata,
} from "@/components/marketing/persona-page"
import { getMarketingPersona, OFFER, PRODUCT } from "@/lib/marketing/facts"

const persona = getMarketingPersona("takeaways")
const title = "Takeaway Loyalty Cards Without an App"
const description = `${OFFER.nameSafe} for takeaways: a browser loyalty card launched for you — no customer app, no POS work. ${PRODUCT.pilot}, then ${PRODUCT.price}.`

export const metadata = personaPageMetadata({ persona, title, description })

export default function LoyaltyForTakeawaysPage() {
  return (
    <PersonaSpokePage
      persona={persona}
      title={title}
      description={description}
    />
  )
}
