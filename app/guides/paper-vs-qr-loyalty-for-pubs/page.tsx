import type { Metadata } from "next"

import {
  GuideComparisonTable,
  type GuideComparisonRow,
} from "@/components/marketing/guides/comparison-table"
import { GuidePage, GuideSection } from "@/components/marketing/guides/guide-page"
import { PROOF, PROOF_DISPLAY, ROUTES } from "@/lib/marketing/facts"
import { OG_IMAGE } from "@/lib/seo/structured-data"

const title = "Paper Loyalty Cards vs QR Loyalty for Pubs"
const description =
  "Paper punch cards or a browser-based QR loyalty card for your pub? A side-by-side on loss, faking, staff time, the till and the data you get back."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.guides.paperVsQr },
  keywords: [
    "paper loyalty cards vs QR",
    "pub loyalty card comparison",
    "paper stamp card vs digital",
    "QR loyalty for pubs",
  ],
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "article",
    siteName: "Nabaperks",
    url: ROUTES.guides.paperVsQr,
    locale: "en_GB",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [OG_IMAGE] },
}

const rows: GuideComparisonRow[] = [
  {
    feature: "Lost or left at home",
    cells: [
      "Lives in a wallet — easily lost or forgotten",
      "Lives on the customer's phone, always with them",
    ],
  },
  {
    feature: "Stamped twice or gamed",
    cells: [
      "A friendly hand can over-stamp it",
      "Each stamp is confirmed at the counter, capped one per UK date",
    ],
  },
  {
    feature: "Staff time at the bar",
    cells: [
      "Find the card, find the stamp, stamp it",
      "The customer scans and stamps themselves",
    ],
  },
  {
    feature: "What the customer installs",
    cells: [
      "Nothing — but nothing to back it up either",
      "Nothing: it opens in the browser, no app or wallet pass",
    ],
  },
  {
    feature: "Visit & redemption data",
    cells: [
      "None — the card tells you nothing",
      "A weekly digest of visits, regulars and redemptions",
    ],
  },
]

export default function PaperVsQrLoyaltyForPubsPage() {
  return (
    <GuidePage
      href={ROUTES.guides.paperVsQr}
      eyebrow="Pub loyalty guide"
      title="Paper loyalty cards vs QR loyalty for pubs"
      description={description}
      intro="Paper punch cards are simple and familiar. A browser-based QR loyalty card keeps that simplicity but fixes the parts that cost a pub money. Here is the honest side-by-side."
    >
      <GuideSection heading="Side by side">
        <GuideComparisonTable
          ariaLabel="Paper loyalty cards versus QR loyalty comparison"
          caption="Paper loyalty cards compared with a browser-based QR loyalty card for pubs, across loss, gaming, staff time, install and data."
          columns={["Paper card", "Browser-based QR card"]}
          rows={rows}
        />
      </GuideSection>

      <GuideSection heading="Where paper still feels right">
        <p>
          A paper card costs pennies and needs no explanation. For a pop-up, a
          one-off promotion or a pub that wants nothing on a screen, it is a fair
          choice. The trade is that a lost card is a lost regular, and you never
          learn who came back.
        </p>
      </GuideSection>

      <GuideSection heading="Where a QR card wins">
        <p>
          A browser-based QR loyalty card keeps the scan-and-collect simplicity
          but cannot be lost, double-stamped or faked. Customers stamp themselves
          in a second, the bar never slows, and there is still no app to install —
          the card just opens in the browser.
        </p>
      </GuideSection>

      <GuideSection heading="The data a paper card can't give you">
        <p>
          The biggest difference is what comes back. A paper card tells you
          nothing; a QR card gives you a weekly digest of visits, regulars and
          redemptions — the quiet signal of who is coming back, which a punch card
          could never show.
        </p>
        <p>
          It shows up in the numbers: in the {PROOF.indexName} ({PROOF.asOf}{" "}
          snapshot), {PROOF_DISPLAY.repeatRate} of {PROOF_DISPLAY.members} loyalty
          members returned.
        </p>
      </GuideSection>
    </GuidePage>
  )
}
