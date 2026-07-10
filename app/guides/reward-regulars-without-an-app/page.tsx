import type { Metadata } from "next"

import { GuidePage, GuideSection } from "@/components/marketing/guides/guide-page"
import { PRODUCT, ROUTES } from "@/lib/marketing/facts"
import { OG_IMAGE } from "@/lib/seo/structured-data"

const title = "How to Reward Pub Regulars Without an App"
const description =
  "Your regulars won't download an app for a pint — and you don't want a CRM. How a browser-based loyalty card rewards pub regulars with nothing to install."

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
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [OG_IMAGE] },
}

export default function RewardRegularsWithoutAnAppPage() {
  return (
    <GuidePage
      href={ROUTES.guides.rewardRegulars}
      eyebrow="Pub loyalty guide"
      title="How to reward regulars without an app"
      description={description}
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
          Customers stamp themselves, with each claim linked to your venue QR
          and their saved membership and capped at one per customer per UK date.
          Optional location checks flag unusual claims. Venue staff scan the
          customer&apos;s live reward code and confirm collection in the merchant app.
        </p>
        <p>
          Your dashboard records visits and returning members, so you can judge
          the pilot from your venue&apos;s own results.
        </p>
      </GuideSection>

      <GuideSection heading="Nothing new at the till">
        <p>
          {PRODUCT.posLine} It runs on any phone, tablet or till you already have,
          and your permanent venue QR handles joins, stamps, and rewards. Your
          team keeps pouring; the loyalty card looks after itself.
        </p>
      </GuideSection>
    </GuidePage>
  )
}
