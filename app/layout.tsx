import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, Space_Mono } from "next/font/google"
import Script from "next/script"

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

// Loaded as the variable font it is (one file instead of five static
// instances) with the optical-size axis on, so display sizes render with
// their drawn-for-size letterforms. Space Mono below is static-only.
const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage-grotesque",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
})

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Nabaperks",
  title: {
    default: "Nabaperks — No-app QR loyalty for UK food & drink venues",
    template: "%s | Nabaperks",
  },
  description:
    "No-app QR loyalty for UK pubs, cafes and takeaways. One venue QR opens a browser card with venue-linked stamps. £49/month after a 30-day free pilot.",
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
      <head>
        {process.env.NODE_ENV === "development" &&
          process.env.PLAYWRIGHT_HARNESS !== "1" && (
            <>
              <Script
                src="https://unpkg.com/react-scan/dist/auto.global.js"
                crossOrigin="anonymous"
                strategy="afterInteractive"
              />
              <Script
                src="//unpkg.com/react-grab/dist/index.global.js"
                crossOrigin="anonymous"
                strategy="beforeInteractive"
              />
            </>
          )}
      </head>
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
