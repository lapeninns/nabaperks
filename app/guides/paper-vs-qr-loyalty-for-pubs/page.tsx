import type { Metadata } from "next"

import { GuidePage, GuideSection } from "@/components/marketing/guides/guide-page"
import { ROUTES } from "@/lib/marketing/facts"
import { OG_IMAGE } from "@/lib/seo/structured-data"

const title = "Paper Loyalty Cards vs QR Loyalty for Pubs"
const description =
  "Paper punch cards or a browser-based QR loyalty card for your pub? A side-by-side on loss, gaming, staff time, the till and the data you get back — so you can pick the right card for your bar."

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

const rows: { feature: string; paper: string; qr: string }[] = [
  {
    feature: "Lost or left at home",
    paper: "Lives in a wallet — easily lost or forgotten",
    qr: "Lives on the customer's phone, always with them",
  },
  {
    feature: "Stamped twice or gamed",
    paper: "A friendly hand can over-stamp it",
    qr: "Each stamp is confirmed at the counter, capped one per UK date",
  },
  {
    feature: "Staff time at the bar",
    paper: "Find the card, find the stamp, stamp it",
    qr: "The customer scans and stamps themselves",
  },
  {
    feature: "What the customer installs",
    paper: "Nothing — but nothing to back it up either",
    qr: "Nothing: it opens in the browser, no app or wallet pass",
  },
  {
    feature: "Visit & redemption data",
    paper: "None — the card tells you nothing",
    qr: "A weekly digest of visits, regulars and redemptions",
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
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Paper loyalty cards compared with a browser-based QR loyalty card
              for pubs, across loss, gaming, staff time, install and data.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-[28%] p-0" />
                <th
                  scope="col"
                  className="border-b-2 border-ink px-3 py-3 align-bottom font-extrabold"
                >
                  Paper card
                </th>
                <th
                  scope="col"
                  className="rounded-t-[var(--radius)] border-b-2 border-ink bg-ink px-3 py-3 align-bottom font-extrabold text-paper"
                >
                  Browser-based QR card
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.feature}>
                  <th
                    scope="row"
                    className={
                      "py-3 pr-3 align-top font-bold text-pretty" +
                      (index > 0
                        ? " border-t border-dashed border-foreground/20"
                        : "")
                    }
                  >
                    {row.feature}
                  </th>
                  <td
                    className={
                      "px-3 py-3 align-top text-muted-foreground" +
                      (index > 0
                        ? " border-t border-dashed border-foreground/20"
                        : "")
                    }
                  >
                    {row.paper}
                  </td>
                  <td
                    className={
                      "bg-ink/[0.04] px-3 py-3 align-top dark:bg-paper/[0.06]" +
                      (index > 0
                        ? " border-t border-dashed border-foreground/20"
                        : "")
                    }
                  >
                    {row.qr}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      </GuideSection>
    </GuidePage>
  )
}
