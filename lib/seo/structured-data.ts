/**
 * Structured-data primitives for the Nabaperks entity graph. Stable @id values
 * let every page cross-reference the same Organization/WebSite nodes, so answer
 * engines resolve "Nabaperks" to one real entity (the Trust pillar of E-E-A-T).
 *
 * Two organizations are modelled: Nabaperks (the product/brand) and its
 * operator, Lapen Inns (a hospitality operator running 9 pubs across England).
 * Nabaperks links to Lapen Inns via `parentOrganization`, and Lapen Inns carries
 * the verifiable estate as machine-readable places. Organization-only — no
 * Person nodes, no company-registry identifiers, no personal profiles. Keep
 * every value byte-aligned with the visible copy it describes.
 */
import { OPERATOR, OPERATOR_ESTATE } from "@/lib/marketing/facts"

export const SITE_URL = "https://nabaperks.com"

export const ORG_ID = `${SITE_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`
/** The operator (Lapen Inns) entity id, keyed off its own public website. */
export const OPERATOR_ID = `${OPERATOR.website}/#organization`

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
  alt: "Nabaperks — loyalty cards for pubs, cafes and takeaways.",
} as const

/**
 * Lapen Inns — the operator Organization. `sameAs` carries only the operator's
 * own public website (no registry identifiers, no personal profiles); the estate
 * is exposed as verifiable `BarOrPub` places to strengthen the entity.
 */
export function operatorSchema(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": OPERATOR_ID,
    name: OPERATOR.name,
    url: OPERATOR.website,
    description: `${OPERATOR.name} is a ${OPERATOR.role} running ${OPERATOR.estateShort}. It builds and runs Nabaperks.`,
    areaServed: { "@type": "Country", name: OPERATOR.country },
    email: OPERATOR.supportEmail,
    sameAs: [OPERATOR.website],
    location: OPERATOR_ESTATE.map((pub) => ({
      "@type": "BarOrPub",
      name: pub.name,
      address: {
        "@type": "PostalAddress",
        postalCode: pub.postcode,
        addressRegion: OPERATOR.region,
        addressCountry: "GB",
      },
    })),
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
      "No-app QR loyalty for UK food and drink venues. Each stamp claim is linked to the venue QR and saved membership, with one claim per customer per UK date.",
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

type WebPageInput = {
  path: string
  name: string
  description: string
  /** Article-style pages set this to attribute authorship to the operator org. */
  isArticle?: boolean
  /** Attach reviewedBy/author = Lapen Inns (operator) for proof/experience pages. */
  reviewedByOperator?: boolean
  /** ISO dates (YYYY-MM-DD). Emitted on Article nodes so answer engines can
   * weight freshness; real dates only — never a build-time `new Date()`. */
  datePublished?: string
  dateModified?: string
}

/** A WebPage (or Article) node wired into the WebSite + Organization graph. */
export function webPageSchema({
  path,
  name,
  description,
  isArticle = false,
  reviewedByOperator = false,
  datePublished,
  dateModified,
}: WebPageInput): Record<string, unknown> {
  const url = absoluteUrl(path)
  return {
    "@type": isArticle ? "Article" : "WebPage",
    "@id": `${url}#webpage`,
    url,
    name,
    headline: name,
    description,
    isPartOf: { "@id": WEBSITE_ID },
    inLanguage: "en-GB",
    about: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    ...(isArticle ? { author: { "@id": OPERATOR_ID } } : {}),
    ...(reviewedByOperator
      ? { reviewedBy: { "@id": OPERATOR_ID }, author: { "@id": OPERATOR_ID } }
      : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
  }
}

export function breadcrumbSchema(
  items: { name: string; path: string }[]
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

export type HowToStepInput = { title: string; body: string }

/**
 * HowTo for the Scan/Save/Stamp/Reward flow. Steps are passed in from the page
 * that renders them, so the schema step labels stay byte-aligned with the
 * visible steps (the PDF's HowTo-parity rule). Pages that are not the hub pass
 * a route-distinct `id` so their HowTo never collides with another page's
 * `@graph` (MS-marketing-multipage).
 */
export function howToSchema(
  steps: readonly HowToStepInput[],
  { id = `${SITE_URL}/#how-it-works` }: { id?: string } = {}
): Record<string, unknown> {
  return {
    "@type": "HowTo",
    "@id": id,
    name: "How Nabaperks loyalty works",
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.body,
    })),
  }
}

/** The defined-term glossary for the product's core terms (AI disambiguation). */
export function glossarySchema(): Record<string, unknown> {
  const glossaryId = `${SITE_URL}/#glossary`
  const terms = [
    {
      name: "Browser-based loyalty card",
      description:
        "A loyalty card customers open from a venue QR code in their phone browser and save in one tap — no app to download and no Apple or Google Wallet pass.",
    },
    {
      name: "QR loyalty card",
      description:
        "A loyalty stamp card reached by scanning a venue's permanent QR code rather than installing an app.",
    },
    {
      name: "No app download",
      description:
        "Customers join and collect stamps with nothing to install; the card runs in the phone browser.",
    },
    {
      name: "Venue-linked stamps",
      description:
        "Each stamp claim is linked to the venue QR and saved membership on the live programme, with one claim per customer per UK date.",
    },
  ]
  return {
    "@type": "DefinedTermSet",
    "@id": glossaryId,
    name: "Nabaperks loyalty glossary",
    hasDefinedTerm: terms.map((term) => ({
      "@type": "DefinedTerm",
      name: term.name,
      description: term.description,
      inDefinedTermSet: glossaryId,
    })),
  }
}

/**
 * Build a connected page graph for a marketing route: a WebPage/Article + a
 * BreadcrumbList, plus any page-specific nodes (Dataset, HowTo, DefinedTermSet).
 * The shared Organization/WebSite nodes are emitted once in the root layout, so
 * pages only reference them by @id.
 */
export function marketingPageGraph({
  page,
  breadcrumbs,
  extraNodes = [],
}: {
  page: WebPageInput
  breadcrumbs: { name: string; path: string }[]
  extraNodes?: Record<string, unknown>[]
}): { "@context": string; "@graph": Record<string, unknown>[] } {
  return {
    "@context": "https://schema.org",
    "@graph": [
      webPageSchema(page),
      breadcrumbSchema(breadcrumbs),
      ...extraNodes,
    ],
  }
}
