import Link from "next/link"
import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import { Button } from "@/components/ui/button"

// Tent-scoped 404. Renders under the shell's chromeless poster wrapper, so the
// section carries its own gutters instead of printing edge-to-edge.
export default function TentDesignNotFound() {
  return (
    <section className="mx-auto grid w-full max-w-xl gap-6 px-6 py-10">
      <EmptyState
        headingLevel={1}
        icon={AlertDiamondIcon}
        title="Table tent not found"
        description="This tent link is stale — the design or QR it points at does not exist any more. Open the Poster page to pick a fresh design."
        actions={
          <Button asChild>
            <Link href="/app/qr">Back to Poster</Link>
          </Button>
        }
      />
    </section>
  )
}
