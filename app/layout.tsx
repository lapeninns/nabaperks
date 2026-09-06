import type { Metadata, Viewport } from "next"
import { BRAND_FONT_CLASSES, BRAND_FONT_VARIABLES } from "@/lib/brand-fonts"

import "./globals.css"
import { PlaywrightHydrationSignal } from "@/components/dev-tools/playwright-hydration-signal"
import { AppPwa } from "@/components/pwa/app-pwa"
import { JsonLd } from "@/components/seo/json-ld"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { BRAND } from "@/lib/marketing/facts"
import {
  OG_IMAGE,
  organizationSchema,
  SITE_URL,
  websiteSchema,
} from "@/lib/seo/structured-data"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Nabaperks",
  title: {
    default: "Nabaperks — No-app loyalty cards for UK food-led pubs",
    template: "%s | Nabaperks",
  },
  description:
    "Done-for-you, no-app QR loyalty made for independent UK food-led pubs. One venue QR opens a browser card with measurable return visits.",
  // Root social defaults. The keyword-bearing `title` above stays the SERP and
  // browser-tab line; the motto leads only on shared cards. Routes with their
  // own `openGraph` object override this — and must then restate `images`,
  // because a child `openGraph` drops the root opengraph-image (see OG_IMAGE).
  // Deliberately no `url`: the routes that inherit this object are the shared
  // private ones (/q/, /r/), and a root og:url would canonicalise every venue
  // share to the homepage object. Absent og:url, crawlers keep the fetched URL.
  openGraph: {
    title: `${BRAND.name} — ${BRAND.motto}`,
    type: "website",
    siteName: BRAND.name,
    locale: "en_GB",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.motto}`,
    images: [OG_IMAGE],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Nabaperks",
    statusBarStyle: "default",
  },
}

export const viewport: Viewport = {
  // Vermillion chrome on light paper; dark scheme matches the dark paper so
  // the browser chrome does not stay vermillion against #1b1712.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#cf330a" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1712" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const isPlaywrightHarness =
    process.env.NODE_ENV === "development" &&
    process.env.PLAYWRIGHT_HARNESS === "1"

  return (
    <html
      lang="en-GB"
      suppressHydrationWarning
      data-playwright-harness={isPlaywrightHarness ? "true" : undefined}
      data-scroll-behavior="smooth"
      className={`${BRAND_FONT_CLASSES} antialiased`}
      style={BRAND_FONT_VARIABLES}
    >
      <body className="font-sans" inert={isPlaywrightHarness}>
        <ThemeProvider>
          {children}
          <AppPwa />
          <Toaster closeButton />
          {isPlaywrightHarness && <PlaywrightHydrationSignal />}
        </ThemeProvider>
        <JsonLd
          id="ld-site"
          data={{
            "@context": "https://schema.org",
            "@graph": [organizationSchema(), websiteSchema()],
          }}
        />
      </body>
    </html>
  )
}
