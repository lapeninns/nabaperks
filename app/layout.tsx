import type { Metadata } from "next"
import { Bricolage_Grotesque, Space_Mono } from "next/font/google"

import "./globals.css"
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
  title: "Nabaperks",
  description: "No-app digital loyalty cards for local businesses.",
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
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
