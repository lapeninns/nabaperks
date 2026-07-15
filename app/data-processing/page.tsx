import type { Metadata } from "next"

import { LegalDocumentPage } from "@/components/legal/legal-document-page"
import {
  DATA_PROCESSING_META,
  DATA_PROCESSING_SECTIONS,
} from "@/lib/legal/content"
import { OG_IMAGE } from "@/lib/seo/structured-data"

const title = "Merchant data-processing schedule"
const description = DATA_PROCESSING_META.description

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/data-processing" },
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: "/data-processing",
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

export default function DataProcessingPage() {
  return (
    <LegalDocumentPage
      meta={DATA_PROCESSING_META}
      sections={DATA_PROCESSING_SECTIONS}
      relatedLinks={[
        { href: "/merchant-terms", label: "Merchant terms" },
        { href: "/privacy", label: "Privacy notice" },
        { href: "/cookies", label: "Cookie notice" },
      ]}
    />
  )
}
