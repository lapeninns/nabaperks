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
          description="That link has gone cold. Your cards and rewards are safe — head back to yours."
          actions={
            <div className="grid w-full gap-2">
              <Button asChild>
                <Link href="/home">Open my cards</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/start">Back to Nabaperks</Link>
              </Button>
            </div>
          }
        />
      </section>
    </main>
  )
}
