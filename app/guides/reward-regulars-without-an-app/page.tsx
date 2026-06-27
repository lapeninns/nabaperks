import type { Metadata } from "next"

import { GuidePage, GuideSection } from "@/components/marketing/guides/guide-page"
import { PRODUCT, ROUTES } from "@/lib/marketing/facts"

const title = "How to Reward Pub Regulars Without an App"
const description =
  "Your regulars won't download an app for a pint — and you don't want another CRM. Here's how a browser-based loyalty card rewards pub regulars with nothing to install and no POS or EPOS integration."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.guides.rewardRegulars },
  keywords: [
    "reward regulars without an app",
    "pub loyalty no app",
    "loyalty card without an app for pubs",
    "no-app loyalty pub",
  ],
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "article",
    siteName: "Nabaperks",
    url: ROUTES.guides.rewardRegulars,
    locale: "en_GB",
  },
}

export default function RewardRegularsWithoutAnAppPage() {
  return (
    <GuidePage
      href={ROUTES.guides.rewardRegulars}
      eyebrow="Pub loyalty guide"
      title="How to reward regulars without an app"
      intro="A regular will not install an app to collect a stamp, and you should not have to run a CRM to thank them. There is a simpler way — and it lives in the phone they already have open."
    >
      <GuideSection heading="Why an app is the wrong ask for a pint">
        <p>
          Asking someone to find, download and sign in to an app — at the bar,
          mid-round — loses most of them before the first stamp. Even cards that
          say &ldquo;no app&rdquo; often still need an Apple or Google Wallet pass
          installed. For a pub, every install step is a regular you never
          enrolled.
        </p>
      </GuideSection>

      <GuideSection heading="What a browser-based loyalty card is">
        <p>
          {PRODUCT.cardLine} There is nothing to download and no wallet pass to
          install — it opens in the phone browser and saves in one tap, on any
          iPhone or Android. &ldquo;Saved&rdquo; and &ldquo;usable&rdquo; are the
          same moment.
        </p>
      </GuideSection>

      <GuideSection heading="How a regular actually uses it">
        <p>
          They scan the permanent QR on the bar, the card opens, and they save it
          in one tap. Next visit they tap to claim a stamp; a full card unlocks a
          reward redeemed at the bar. No password, no plastic, nothing to lose
          between rounds.
        </p>
      </GuideSection>

      <GuideSection heading="Keeping it fair behind the bar">
        <p>
          Customers stamp themselves, but they cannot game it: every stamp is
          confirmed at the counter against your QR and their saved card, capped at
          one per customer per UK date. Rewards are checked when they are
          redeemed, never from a screenshot — so a finished card always means a
          real regular.
        </p>
      </GuideSection>

      <GuideSection heading="Nothing new at the till">
        <p>
          {PRODUCT.posLine} It runs on any phone, tablet or till you already have,
          and a printed QR kit is posted to the venue. Your team keeps pouring;
          the loyalty card looks after itself.
        </p>
      </GuideSection>
    </GuidePage>
  )
}
