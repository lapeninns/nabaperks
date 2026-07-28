import type { Metadata } from "next"
import { connection } from "next/server"

import { AdminMfaPanel } from "@/components/admin/mfa-panel"
import { Eyebrow } from "@/components/brand"
import { getAdminAccess } from "@/lib/admin/auth"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = PRIVATE_ROUTE_METADATA

export default async function AdminSecurityPage() {
  await connection()
  const access = await getAdminAccess()
  if (access.status !== "allowed" || access.mfaState !== "satisfied") {
    return null
  }

  let factorId: string | null = null
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.mfa.listFactors()
  factorId = data?.totp?.[0]?.id ?? null

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>Security</Eyebrow>
        <h1 className="mt-2 text-3xl leading-tight font-extrabold">
          Two-factor authentication
        </h1>
      </header>
      <AdminMfaPanel enrolled factorId={factorId} />
    </div>
  )
}
