import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ReceiptCard, VenueMark } from "@/components/brand"
import { CustomerAccessRecoveryForm } from "@/components/customer/customer-access-recovery-form"
import { CustomerShell } from "@/components/layout"
import { getPendingAccessRecovery } from "@/lib/customer/session"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Confirm wallet access",
}

export default async function CustomerAccessRecoveryPage() {
  const recovery = await getPendingAccessRecovery()
  if (!recovery) redirect("/home/login")

  return (
    <CustomerShell>
      <ReceiptCard edge className="grid gap-6">
        <div className="grid justify-items-center gap-3 text-center">
          <VenueMark size={56} name="Nabaperks" caption="My Nabaperks" />
          <div className="grid gap-1">
            <h1 className="text-2xl leading-tight font-extrabold text-balance">
              Confirm this is your wallet
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              This phone is linked to an existing Nabaperks wallet, but this
              browser has not opened it before.
            </p>
          </div>
        </div>
        <CustomerAccessRecoveryForm
          canUseEmail={Boolean(recovery.emailHmac && recovery.codeHmac)}
        />
      </ReceiptCard>
    </CustomerShell>
  )
}
