/**
 * Structured-data primitives for the Nabaperks entity graph. Stable @id values
 * let every page cross-reference the same Organization/WebSite nodes, so answer
 * engines resolve "Nabaperks" to one real entity (the Trust pillar of E-E-A-T).
 *
 * Two organizations are modelled: Nabaperks (the product/brand) and its
 * operator, Lapen Inns. Nabaperks links to Lapen Inns via
 * `parentOrganization`. Organization-only — no Person nodes, unsupported venue
 * counts, company-registry identifiers or personal profiles. Keep every value
 * byte-aligned with the visible copy it describes.
 */
import { OPERATOR, PRODUCT, type MarketingFaq } from "@/lib/marketing/facts"

export const SITE_URL = "https://nabaperks.com"

export const ORG_ID = `${SITE_URL}/#organization`
const WEBSITE_ID = `${SITE_URL}/#website`
/** The operator (Lapen Inns) entity id, keyed off its own public website. */
const OPERATOR_ID = `${OPERATOR.website}/#organization`

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
  alt: "Nabaperks — no-app loyalty cards for food-led pubs.",
} as const

/**
 * Lapen Inns — the operator Organization. `sameAs` carries only the operator's
 * own public website (no registry identifiers or personal profiles).
 */
export function operatorSchema(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": OPERATOR_ID,
    name: OPERATOR.name,
    url: OPERATOR.website,
    description: `${OPERATOR.name} is the ${OPERATOR.role} behind Nabaperks. It builds and runs the product.`,
    areaServed: { "@type": "Country", name: OPERATOR.country },
    email: OPERATOR.supportEmail,
    sameAs: [OPERATOR.website],
  }
}

export function organizationSchema(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Nabaperks",
    url: SITE_URL,
    logo: absoluteUrl("/icons/nabaperks-icon-512.png"),
    description:
      "Done-for-you, no-app QR loyalty for single-site UK food-led pubs. Each stamp claim is linked to the venue QR and saved membership, with one claim per customer per UK date.",
    areaServed: { "@type": "Country", name: "United Kingdom" },
    email: OPERATOR.supportEmail,
    parentOrganization: { "@id": OPERATOR_ID },
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
 * The Growth Plan as a Product with its two real subscription offers. There is
 * no setup fee — the done-for-you launch is included in the subscription.
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
        name: `${PRODUCT.planName} — monthly`,
        price: "49",
        priceCurrency: "GBP",
        description: `${PRODUCT.price} after a ${PRODUCT.pilot}. ${PRODUCT.cancelLine}`,
        url: absoluteUrl("/pricing"),
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: `${PRODUCT.planName} — annual`,
        price: "490",
        priceCurrency: "GBP",
        description: `${PRODUCT.priceAnnual} up front — ${PRODUCT.annualSaving}.`,
        url: absoluteUrl("/pricing"),
        availability: "https://schema.org/InStock",
      },
    ],
  }
}

/** Article node for the guides; published by the Nabaperks Organization. */
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
