import type { Metadata } from "next"

import { LegalDocumentPage } from "@/components/legal/legal-document-page"
import { COOKIE_META, COOKIE_SECTIONS } from "@/lib/legal/content"
import { OG_IMAGE } from "@/lib/seo/structured-data"

const title = "Cookie and browser-storage notice"
const description = COOKIE_META.description

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/cookies" },
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: "/cookies",
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

export default function CookiesPage() {
  return (
    <LegalDocumentPage
      meta={COOKIE_META}
      sections={COOKIE_SECTIONS}
      relatedLinks={[
        { href: "/privacy", label: "Privacy notice" },
        { href: "/terms", label: "Customer terms" },
      ]}
    />
  )
}
