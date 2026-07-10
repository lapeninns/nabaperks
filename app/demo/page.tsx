import type { Metadata } from "next"
import Link from "next/link"

import { Eyebrow } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { OG_IMAGE, absoluteUrl } from "@/lib/seo/structured-data"

import { DemoCard } from "./demo-card"

const title = "Try a live loyalty card demo"
const description =
  "See the browser-based loyalty card flow your customers get. No app, no wallet pass, no sign-up. Tap through a demo stamp and reward unlock."

export const metadata: Metadata = {
  title: { absolute: `${title} | Nabaperks` },
  description,
  alternates: { canonical: "/demo" },
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: absoluteUrl("/demo"),
    locale: "en_GB",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | Nabaperks`,
    description,
    images: [OG_IMAGE],
  },
}

/**
 * The scan-target for the hero QR and the "try it yourself" link: a real,
 * interactive customer card a prospect can stamp with their thumb, before they
 * sign up. Wrapped in the customer shell so it reads like the genuine card, not
 * a marketing mock. No auth, no DB — see {@link DemoCard}.
 */
export default function DemoPage() {
  return (
    <CustomerShell>
      <div className="grid gap-6">
        <header className="grid justify-items-center gap-2 text-center">
          <Eyebrow>Live demo · nothing saved</Eyebrow>
          <h1 className="text-2xl leading-tight font-extrabold text-balance sm:text-3xl">
            The card your customers get.
          </h1>
          <p className="max-w-[42ch] text-sm leading-6 text-pretty text-muted-foreground">
            No app, no wallet pass, no sign-up. Tap the card to walk through a demo
            stamp and reward unlock.
          </p>
        </header>

        <DemoCard />

        <div className="grid justify-items-center gap-3 border-t-2 border-dashed border-foreground/25 pt-5 text-center">
          <p className="max-w-[40ch] text-sm leading-6 text-pretty text-muted-foreground">
            This is what your regulars see at your counter. Build your card,
            then activate billing when you are ready to go live.
          </p>
          <Button asChild size="lg">
            <Link href="/signup">Start free pilot</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground underline underline-offset-4"
          >
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </CustomerShell>
  )
}
