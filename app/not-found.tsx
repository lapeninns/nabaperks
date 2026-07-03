import Link from "next/link"
import { connection } from "next/server"
import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState, Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Page not found" }

export default async function NotFound() {
  await connection()

  return (
    <main className="grid min-h-svh place-items-center px-6 py-10">
      <section className="grid w-full max-w-sm justify-items-center gap-6">
        <Logo compact href="/" />
        <EmptyState
          headingLevel={1}
          icon={AlertDiamondIcon}
          title="Page not found"
          description="That link has gone cold. Everything else is where you left it."
          actions={
            <div className="grid w-full gap-2">
              <Button asChild>
                <Link href="/">Nabaperks home</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/home">Open my cards</Link>
              </Button>
            </div>
          }
        />
      </section>
    </main>
  )
}
