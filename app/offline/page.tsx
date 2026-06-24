import Link from "next/link"
import { NoInternetIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Offline - Nabaperks",
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-lg border-2 border-ink bg-card p-6 text-center shadow-xs">
        <EmptyState
          icon={NoInternetIcon}
          title="You're offline"
          description="Cards, stamps, rewards, merchant tools, and admin tools need a connection because Nabaperks keeps the server as the source of truth."
          headingLevel={1}
        />
        <div className="mt-5 flex justify-center">
          <Button asChild>
            <Link href="/home">Open my cards</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
