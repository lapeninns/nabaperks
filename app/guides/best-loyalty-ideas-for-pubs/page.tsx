import type { Metadata } from "next"

import { GuidePage, GuideSection } from "@/components/marketing/guides/guide-page"
import { ROUTES } from "@/lib/marketing/facts"
import { OG_IMAGE } from "@/lib/seo/structured-data"

const title = "Best Loyalty Ideas for Pubs"
const description =
  "Loyalty ideas that actually suit a pub: one clear stamp threshold, quieter-day perks, rewards that taste like your bar, and the schemes to skip. A practical guide for landlords and pub operators."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.guides.bestIdeas },
  keywords: [
    "pub loyalty ideas",
    "loyalty ideas for pubs",
    "pub reward scheme ideas",
    "gastropub loyalty",
  ],
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "article",
    siteName: "Nabaperks",
    url: ROUTES.guides.bestIdeas,
    locale: "en_GB",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [OG_IMAGE] },
}

export default function BestLoyaltyIdeasForPubsPage() {
  return (
    <GuidePage
      href={ROUTES.guides.bestIdeas}
      eyebrow="Pub loyalty guide"
      title="Best loyalty ideas for pubs"
      description={description}
      intro="The reward you choose matters more than the technology behind it. Here are the loyalty ideas that suit a pub, bar or gastropub — and the ones to leave behind the bar."
    >
      <GuideSection heading="Pick one clear threshold">
        <p>
          The best pub loyalty scheme is one a regular can hold in their head:
          collect a set number of stamps, unlock one reward. A single, obvious
          goal beats a points scheme nobody tracks. Keep the maths invisible and
          the finish line in sight.
        </p>
      </GuideSection>

      <GuideSection heading="Reward the quieter shifts">
        <p>
          Fridays look after themselves. A perk that lands on a Tuesday or a
          rainy lunchtime gives regulars a reason to choose your pub when they
          might otherwise stay home — and turns your loyalty card into a tool for
          filling the quiet hours, not just thanking the busy ones.
        </p>
      </GuideSection>

      <GuideSection heading="Make the reward taste like your pub">
        <p>
          Generic points feel like a supermarket. A guest ale, a plate from the
          kitchen, a round for a finished card — a reward only your bar can give
          is the one regulars come back to unlock. It should feel like a thank-you
          from the landlord, not a discount engine.
        </p>
      </GuideSection>

      <GuideSection heading="Let regulars stamp themselves — and keep it honest">
        <p>
          A reward only works if a full card means something. With Nabaperks,
          customers scan your venue QR and stamp themselves, and every stamp is
          confirmed at the counter — checked against your QR, their saved card and
          a one-stamp-per-customer-per-UK-date rule. The phone never crosses the
          counter and the bar never slows down.
        </p>
      </GuideSection>

      <GuideSection heading="Ideas to skip">
        <p>
          Skip anything that asks a customer to download an app for a pint. Skip
          anything that turns the bar into a data-entry desk on a busy shift. And
          skip any reward you cannot honour on a packed Friday — a promise you
          break is worse than no scheme at all.
        </p>
      </GuideSection>
    </GuidePage>
  )
}
