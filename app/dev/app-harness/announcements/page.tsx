import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"

import { AnnouncementsHarnessClient } from "./harness-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default function AnnouncementsHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Harness"
        title="Announcement compose"
        description="DB-free compose states for the merchant announcement surface."
      />

      <AnnouncementsHarnessClient />
    </div>
  )
}
