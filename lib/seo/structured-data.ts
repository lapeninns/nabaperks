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
