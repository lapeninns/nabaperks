/**
 * Structured-data primitives for the Nabaperks entity graph. Stable @id values
 * let every page cross-reference the same Organization/WebSite nodes, so answer
 * engines resolve "Nabaperks" to one real entity (the Trust pillar of E-E-A-T).
 * Keep every value byte-aligned with the visible copy it describes.
 */
export const SITE_URL = "https://nabaperks.com"

export const ORG_ID = `${SITE_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`

/** Resolve a site-relative path to an absolute URL for schema/canonicals. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString()
}

export function organizationSchema(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Nabaperks",
    url: SITE_URL,
    logo: absoluteUrl("/icons/nabaperks-icon-512.png"),
    description:
      "No-app QR loyalty for UK food & drink venues. Customers scan a venue QR, save a browser loyalty card with nothing to install, and collect server-checked stamps.",
    areaServed: { "@type": "Country", name: "United Kingdom" },
    // TODO(real-data): add real off-site nodes (LinkedIn, Companies House, X)
    // to sameAs[] to strengthen the entity graph, and a postal address once one
    // is published on a public About/Contact page.
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
