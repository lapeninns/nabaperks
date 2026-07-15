import type { Metadata } from "next"

import { LegalDocumentPage } from "@/components/legal/legal-document-page"
import {
  MERCHANT_TERMS_META,
  MERCHANT_TERMS_SECTIONS,
} from "@/lib/legal/content"
import { OG_IMAGE } from "@/lib/seo/structured-data"

const title = "Merchant subscription terms"
const description = MERCHANT_TERMS_META.description

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/merchant-terms" },
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: "/merchant-terms",
    locale: "en_GB",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | Nabaperks`,
    description,
    images: [OG_IMAGE],
  },
}

export default function MerchantTermsPage() {
  return (
    <LegalDocumentPage
      meta={MERCHANT_TERMS_META}
      sections={MERCHANT_TERMS_SECTIONS}
      relatedLinks={[
        { href: "/data-processing", label: "Data-processing schedule" },
        { href: "/privacy", label: "Privacy notice" },
      ]}
    />
  )
}
