import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, Space_Mono } from "next/font/google"

import "./globals.css"
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

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage-grotesque",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    "No-app QR loyalty cards for UK pubs, cafes and takeaways. Customers scan a venue QR and save a browser-based loyalty card — nothing to install — then collect counter-verified stamps. £29/month, 30-day free pilot.",
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
  themeColor: "#e8430f",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en-GB"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${bricolageGrotesque.variable} ${spaceMono.variable} antialiased`}
    >
      <body className="font-sans">
        <ThemeProvider>
          {children}
          <AppPwa />
          <Toaster richColors closeButton />
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
