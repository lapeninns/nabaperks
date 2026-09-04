import type { Metadata } from "next"
import { connection } from "next/server"

import { Eyebrow } from "@/components/brand"
import { requireAdminRead } from "@/lib/admin/auth"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = PRIVATE_ROUTE_METADATA

export default async function AdminSecurityPage() {
  await connection()
  await requireAdminRead()

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>Security</Eyebrow>
        <h1 className="mt-2 text-3xl leading-tight font-extrabold">
          Two-factor authentication
        </h1>
      </header>
      <section className="surface-card max-w-xl p-6">
        <h2 className="text-xl font-extrabold">Single-factor access</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Additional verification is not required under the current
          administrator authentication policy.
        </p>
      </section>
    </div>
  )
}
