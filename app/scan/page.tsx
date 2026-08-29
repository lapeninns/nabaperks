import type { Metadata } from "next"

import { signOutCustomerAction } from "@/app/home/actions"
import { CustomerQrScannerLoader } from "@/components/customer/customer-qr-scanner-loader"
import { CustomerAppShell, CustomerShell } from "@/components/layout"
import { getCustomerSession } from "@/lib/customer/session"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
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
        {/* The shell already renders the fixed tab bar, so the scanner draws
            no exits of its own (CUS 02#60). */}
        <CustomerQrScannerLoader hasAppNavigation />
      </CustomerAppShell>
    )
  }

  return (
    <CustomerShell>
      <CustomerQrScannerLoader />
    </CustomerShell>
  )
}
