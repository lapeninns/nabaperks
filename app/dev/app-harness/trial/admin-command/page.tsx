import { notFound } from "next/navigation"

import { AdminCommandPalette } from "@/components/admin/command-palette"
import { PageTitle } from "@/components/brand"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * The admin command palette (ADM 04#6), which lives in the admin shell and is
 * therefore auth-gated and unreachable to a browser test.
 *
 * Mounts the REAL component, so what this proves is a fact about what ships.
 * Press Cmd-K (or Ctrl-K) to open it.
 */
export default function AdminCommandHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <main className="mx-auto grid w-full max-w-merchant gap-5 px-4 py-8">
      <PageTitle
        eyebrow="Harness"
        title="Admin command palette"
        description="Press Cmd-K or Ctrl-K. Type to filter the eleven admin routes; a term plus a venue-searchable route carries through as ?venue=."
      />
      <AdminCommandPalette />
    </main>
  )
}
