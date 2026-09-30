import type { Metadata } from "next"

import { CustomerQrScannerLoader } from "@/components/customer/customer-qr-scanner-loader"
import { CustomerAppShell, CustomerShell } from "@/components/layout"
import { getCustomerSession } from "@/lib/customer/session"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Scan the venue QR",
}

export default async function ScanPage() {
  const session = await getCustomerSession()

  if (session) {
    return (
      <CustomerAppShell>
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
