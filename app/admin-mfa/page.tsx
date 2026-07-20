import { redirect } from "next/navigation"

import { AUTH_SECTION_MIN_H } from "@/app/(auth)/viewport"
import { AdminMfaForm } from "@/components/admin/admin-mfa-form"
import { Eyebrow, ReceiptCard } from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import { getAdminGate } from "@/lib/admin/auth"
import { safeAdminNextPath } from "@/lib/navigation/safe-next-path"
import { cn } from "@/lib/utils"

type AdminMfaPageProps = {
  searchParams: Promise<{
    next?: string | string[]
  }>
}

export default async function AdminMfaPage({
  searchParams,
}: AdminMfaPageProps) {
  const params = await searchParams
  const next = safeAdminNextPath(firstSearchParam(params.next) ?? "/admin")
  const gate = await getAdminGate()

  if (gate.status === "anonymous") {
    redirect(`/login?next=${encodeURIComponent("/admin-mfa")}`)
  }

  if (gate.status === "denied") {
    return (
      <MarketingLayout focused>
        <section
          className={cn(
            "mx-auto flex w-full max-w-md items-center justify-center px-6 py-10",
            AUTH_SECTION_MIN_H
          )}
        >
          <ReceiptCard edge className="w-full p-6 text-center">
            <Eyebrow>Internal admin</Eyebrow>
            <h1 className="mt-2 text-2xl font-extrabold">Access denied</h1>
            <p className="mt-3 text-sm text-muted-foreground">{gate.reason}</p>
          </ReceiptCard>
        </section>
      </MarketingLayout>
    )
  }

  if (gate.status === "allowed") {
    redirect(next)
  }

  return (
    <MarketingLayout focused>
      <section
        className={cn(
          "mx-auto flex w-full max-w-md items-center justify-center px-6 py-10",
          AUTH_SECTION_MIN_H
        )}
      >
        <ReceiptCard edge className="w-full p-6">
          <AdminMfaForm email={gate.email} next={next} />
        </ReceiptCard>
      </section>
    </MarketingLayout>
  )
}

function firstSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
