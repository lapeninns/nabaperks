import Link from "next/link"
import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState, Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center px-6 py-10">
      <section className="grid w-full max-w-sm justify-items-center gap-6">
        <Logo compact />
        <EmptyState
          headingLevel={1}
          icon={AlertDiamondIcon}
          title="Page not found"
          description="That link has gone cold. Head back to Nabaperks and scan from a live venue QR when you are ready."
          actions={
            <Button asChild>
              <Link href="/">Back to Nabaperks</Link>
            </Button>
          }
        />
      </section>
    </main>
  )
}
