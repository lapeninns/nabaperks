import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"

import "./globals.css"
import { PlaywrightHydrationSignal } from "@/components/dev-tools/playwright-hydration-signal"
import { AppPwa } from "@/components/pwa/app-pwa"
import { JsonLd } from "@/components/seo/json-ld"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import {
  operatorSchema,
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
    {
      path: "../assets/fonts/BricolageGrotesque-Bold.ttf",
      weight: "700",
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
    "Done-for-you, no-app QR loyalty for single-site UK food-led pubs. One venue QR opens a browser card with measurable return visits. No setup fee.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/icons/nabaperks-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/nabaperks-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/nabaperks-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
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
            "@graph": [operatorSchema(), organizationSchema(), websiteSchema()],
          }}
        />
      </body>
    </html>
  )
}
