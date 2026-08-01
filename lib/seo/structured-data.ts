/**
 * Structured-data primitives for the Nabaperks entity graph. Stable @id values
 * let every page cross-reference the same Organization/WebSite nodes, so answer
 * engines resolve "Nabaperks" to one real entity (the Trust pillar of E-E-A-T).
 *
 * Nabaperks is modelled as the single public product/brand organization.
 * Organization-only — no parent-brand relationship, Person nodes, unsupported
 * venue counts, company-registry identifiers or personal profiles. Keep every
 * value byte-aligned with the visible copy it describes.
 */
import { BRAND, PRODUCT, type MarketingFaq } from "@/lib/marketing/facts"

export const SITE_URL = "https://nabaperks.com"

export const ORG_ID = `${SITE_URL}/#organization`
const WEBSITE_ID = `${SITE_URL}/#website`

/** Resolve a site-relative path to an absolute URL for schema/canonicals. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString()
}

/**
 * The static Wet Ink social image (app/opengraph-image.tsx). Referenced by child
 * routes' metadata because a root-segment opengraph-image is not inherited once a
 * child route defines its own `openGraph` object.
 */
export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${BRAND.name} — ${BRAND.motto.toLowerCase()}. No-app loyalty cards for food-led pubs.`,
} as const

export function organizationSchema(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: BRAND.name,
    url: SITE_URL,
    logo: absoluteUrl("/icons/nabaperks-icon-512.png"),
    description: `${BRAND.positioning}. Done-for-you, no-app QR loyalty built around how independent food-led pubs actually work.`,
    areaServed: { "@type": "Country", name: "United Kingdom" },
    sameAs: [] as string[],
  }
}

export function websiteSchema(): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: "Nabaperks",
    publisher: { "@id": ORG_ID },
    inLanguage: "en-GB",
  }
}

// --- Per-page builders (marketing rebuild, offer v3) ------------------------
// Every value must stay byte-aligned with visible page copy; builders read the
// shared marketing facts rather than accepting free-text claims.

/** A WebPage node keyed off its canonical URL, tied to the shared WebSite. */
export function webPageSchema({
  path,
  title,
  description,
}: {
  path: string
  title: string
  description: string
}): Record<string, unknown> {
  return {
    "@type": "WebPage",
    "@id": `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name: title,
    description,
    isPartOf: { "@id": WEBSITE_ID },
    inLanguage: "en-GB",
  }
}

/** BreadcrumbList for spoke/guide pages; items run root → current page. */
export function breadcrumbSchema(
  items: readonly { name: string; path: string }[]
): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

/** FAQPage mirroring the visible FAQ copy (same shared constants). */
export function faqPageSchema(
  path: string,
  faqs: readonly MarketingFaq[]
): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl(path)}#faq`,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  }
}

/** HowTo for the done-for-you launch steps on /how-it-works. */
export function howToSchema({
  path,
  name,
  description,
  steps,
}: {
  path: string
  name: string
  description: string
  steps: readonly { title: string; detail: string }[]
}): Record<string, unknown> {
  return {
    "@type": "HowTo",
    "@id": `${absoluteUrl(path)}#howto`,
    name,
    description,
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.detail,
    })),
  }
}

/**
 * The Growth Plan as a Product with its two self-serve recurring offers. The
 * one-time physical launch is disclosed in the offer description.
 */
export function growthPlanSchema(): Record<string, unknown> {
  return {
    "@type": "Product",
    "@id": `${SITE_URL}/#growth-plan`,
    name: `Nabaperks ${PRODUCT.planName}`,
    description: `${PRODUCT.cardLine} ${PRODUCT.posLine}`,
    brand: { "@id": ORG_ID },
    offers: [
      {
        "@type": "Offer",
        name: `${PRODUCT.planName} — 28-day billing`,
        price: PRODUCT.priceAmount,
        priceCurrency: "GBP",
        description: `${PRODUCT.launchFee} done-for-you launch, then a ${PRODUCT.pilot} followed by ${PRODUCT.price}. ${PRODUCT.billingDisclosure} ${PRODUCT.cancelLine}`,
        url: absoluteUrl("/pricing"),
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: `${PRODUCT.planName} — annual prepay`,
        price: PRODUCT.annualPriceAmount,
        priceCurrency: "GBP",
        description: `${PRODUCT.launchFee} done-for-you launch, then a ${PRODUCT.pilot} followed by ${PRODUCT.annualPrice}. ${PRODUCT.annualSaving} ${PRODUCT.cancelLine}`,
        url: absoluteUrl("/pricing"),
        availability: "https://schema.org/InStock",
      },
    ],
  }
}

export function articleSchema({
  path,
  headline,
  description,
  datePublished,
  dateModified,
}: {
  path: string
  headline: string
  description: string
  datePublished: string
  dateModified: string
}): Record<string, unknown> {
  return {
    "@type": "Article",
    "@id": `${absoluteUrl(path)}#article`,
    headline,
    description,
    datePublished,
    dateModified,
    mainEntityOfPage: absoluteUrl(path),
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    inLanguage: "en-GB",
  }
}
