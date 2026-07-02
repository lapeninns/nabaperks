import Link from "next/link"
import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import { Button } from "@/components/ui/button"

// Poster-scoped 404. This path renders under the shell's chromeless poster
// wrapper (hideMobileChrome strips all content padding), so the section
// carries its own gutters instead of printing edge-to-edge.
export default function PosterTemplateNotFound() {
  return (
    <section className="mx-auto grid w-full max-w-xl gap-6 px-6 py-10">
      <EmptyState
        headingLevel={1}
        icon={AlertDiamondIcon}
        title="Poster not found"
        description="This poster link is stale — the template or QR it points at does not exist any more. Open the Poster page to pick a fresh template."
        actions={
          <Button asChild>
            <Link href="/app/qr">Back to Poster</Link>
          </Button>
        }
      />
    </section>
  )
}
