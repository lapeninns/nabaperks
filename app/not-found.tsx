import Link from "next/link"
import { connection } from "next/server"
import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState, Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"

export const metadata = { title: "Page not found" }

export default async function NotFound() {
  await connection()

  return (
    <main className="grid min-h-svh place-items-center px-6 py-10">
      <section className="grid w-full max-w-sm justify-items-center gap-6">
        <Logo compact href="/signup" />
        <EmptyState
          headingLevel={1}
          icon={AlertDiamondIcon}
          title="Page not found"
          description="That link has gone cold. Everything else is where you left it."
          actions={
            <div className="grid w-full gap-2">
              <Button asChild>
                <Link href="/signup">Start a free pilot</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/home">{OPEN_MY_CARDS_LABEL}</Link>
              </Button>
            </div>
          }
        />
      </section>
    </main>
  )
}
