import type { Metadata } from "next"
import Link from "next/link"
import { NoInternetIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

import { OfflineAutoReload } from "./auto-reload"

// A service-worker fallback surface: keep it out of search indexes, and let
// the root template brand the tab ("Offline | Nabaperks").
export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Offline",
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      {/* EmptyState is itself the Wet Ink card — no outer card wrapper, so the
          offline and 404 system pages share one treatment. */}
      <section className="w-full max-w-md">
        <EmptyState
          icon={NoInternetIcon}
          title="You're offline"
          description="Your cards and stamps live safely with us. Reconnect and they will be right here."
          headingLevel={1}
          actions={
            <div className="flex w-full flex-wrap justify-center gap-3">
              {/* A plain same-URL anchor: retries the original navigation even
                  if hydration is unavailable, instead of looping via the
                  service worker's offline fallback. */}
              <Button asChild>
                <a href="">Try again</a>
              </Button>
              <Button asChild variant="outline">
                <Link href="/home">{OPEN_MY_CARDS_LABEL}</Link>
              </Button>
            </div>
          }
        />
      </section>
      <OfflineAutoReload />
    </main>
  )
}
