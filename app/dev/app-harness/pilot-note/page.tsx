import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { PilotNoteFields } from "@/components/admin/pilot-note-fields"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * DB-free harness for the pilot note-type scaffold: mounts {@link PilotNoteFields}
 * so the reactive notes placeholder can be exercised without an admin session.
 */
export default function PilotNoteHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Harness"
        title="Pilot note"
        description="DB-free pilot note-type scaffold."
      />
      <form className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:p-6">
        <PilotNoteFields />
      </form>
    </div>
  )
}
