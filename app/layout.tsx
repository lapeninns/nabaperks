import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, Space_Mono } from "next/font/google"

import "./globals.css"
import { AppPwa } from "@/components/pwa/app-pwa"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

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
  applicationName: "Nabaperks",
  title: "Nabaperks",
  description: "No-app digital loyalty cards for local businesses.",
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
      </body>
    </html>
  )
}
