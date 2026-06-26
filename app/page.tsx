import type { Metadata } from "next"
import QRCode from "qrcode"

import { MarketingLayout } from "@/components/layout"
import {
  CounterFlow,
  FinalCta,
  LandingFaq,
  LandingHero,
  ProofStrip,
  TrustPricing,
  VenueBenefits,
  VenueProof,
  type QrMatrix,
} from "@/components/marketing/landing"

const title = "Nabaperks — No-app QR loyalty for food & drink venues"
const description =
  "Replace paper loyalty cards with one venue QR. Run no-app loyalty from your counter — customers scan, save a browser card, and collect server-checked stamps."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "Nabaperks",
  },
}

/** The landing page's top nav adds the on-page "How it works" anchor; the
 * shared marketing shell supplies the marquee, sticky header CTA, and footer. */
const navLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/login", label: "Log in" },
]

/** The venue QR is a real code, computed once on the server and handed to the
 * sample card and the reward reveal so the `qrcode` library never ships to the
 * browser. */
function buildQrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" })
  const { size, data } = qr.modules
  const bits = Array.from(
    { length: size * size },
    (_, index) => data[index] === 1
  )
  return { size, bits }
}

const qrMatrix = buildQrMatrix("https://nabaperks.com")

export default function HomePage() {
  return (
    <MarketingLayout navLinks={navLinks}>
      <LandingHero qrMatrix={qrMatrix} />
      <ProofStrip />
      <CounterFlow />
      <VenueBenefits qrMatrix={qrMatrix} />
      <VenueProof />
      <TrustPricing />
      <LandingFaq />
      <FinalCta />
    </MarketingLayout>
  )
}
