import type { Metadata } from "next"

import { signOutCustomerAction } from "@/app/home/actions"
import { CustomerQrScannerLoader } from "@/components/customer/customer-qr-scanner-loader"
import { CustomerAppShell, CustomerShell } from "@/components/layout"
import { getCustomerSession } from "@/lib/customer/session"

export const metadata: Metadata = {
  title: "Scan venue QR",
}

export default async function ScanPage() {
  const sessionSecretConfigured = Boolean(
    process.env.CUSTOMER_SESSION_SECRET?.trim()
  )
  const session = sessionSecretConfigured ? await getCustomerSession() : null

  if (session) {
    return (
      <CustomerAppShell signOutAction={signOutCustomerAction}>
        <CustomerQrScannerLoader />
      </CustomerAppShell>
    )
  }

  return (
    <CustomerShell>
      <CustomerQrScannerLoader />
    </CustomerShell>
  )
}
