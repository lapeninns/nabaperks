import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"

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

const bricolageGrotesque = localFont({
  src: [
    {
      path: "../assets/fonts/BricolageGrotesque-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    // These two faces ship as SUBSET woff2, the other two as .ttf, and that
    // asymmetry is deliberate. `poster-font-assets` SHA-256-pins the four
    // original files and requires the app and the PDF renderer to name the same
    // ones, so Regular and Bold must stay .ttf. Medium and ExtraBold were added
    // by this branch and are NOT pinned, so they ship in the format and the
    // coverage the browser actually wants: 113KB .ttf -> 47KB woff2 -> 39KB
    // subset woff2. The PDF renderer still reads the .ttf.
    //
    // Subset to Latin + Latin-1 + Latin Extended-A/B + combining marks +
    // punctuation/currency/arrows (U+0000-036F and friends), which drops 124 of
    // 527 glyphs — mostly Latin Extended Additional, i.e. Vietnamese. Combining
    // marks (U+0300-036F) and the `mark`/`mkmk` GPOS features are kept
    // deliberately, at a cost of 4.4KB, because venue names are user-generated
    // and may arrive decomposed rather than precomposed. `tnum` is kept because
    // `.numeric-tabular` in globals.css needs it, and `kern` because everything
    // does.
    //
    // Measured on /loyalty-for-pubs, 3 runs each, same machine and build:
    // LCP 5,022/5,009/5,025ms -> 3,770/3,761/3,774ms, FCP 1,658 -> 1,204ms.
    // / and /pricing land at 3,769 and 3,773ms. The Lighthouse budgets are
    // 4,000ms LCP and 2,500ms FCP, so all three routes now pass locally.
    //
    // DESIGN.md typography: body/small are weight 500 and every heading is
    // 800. Without these two faces the browser synthesised both from the 400
    // and 700 files, so `font-medium` fell back to Regular and `font-extrabold`
    // was a faux-bolded 700 — collapsing the bold/extrabold distinction the
    // system relies on to separate card titles from page titles.
    {
      path: "../assets/fonts/BricolageGrotesque-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../assets/fonts/BricolageGrotesque-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../assets/fonts/BricolageGrotesque-ExtraBold.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-bricolage-grotesque",
  display: "swap",
})

const spaceMono = localFont({
  src: [
    {
      path: "../assets/fonts/SpaceMono-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/SpaceMono-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-space-mono",
  display: "swap",
  // This supporting display face should not compete with the primary body and
  // heading face on the critical render path.
  preload: false,
})

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
      className={`${bricolageGrotesque.variable} ${spaceMono.variable} antialiased`}
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
