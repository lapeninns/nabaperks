import { redirect } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { ScannerPanel } from "@/components/merchant/redeem/scanner-panel"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { getCurrentMerchant } from "@/lib/auth/session"
import { lookupRedemptionToken } from "@/lib/merchant/redeem"

type MerchantRedeemPageProps = {
  searchParams: Promise<{
    token?: string
  }>
}

export default async function MerchantRedeemPage({
  searchParams,
}: MerchantRedeemPageProps) {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const params = await searchParams
  const initialToken = typeof params.token === "string" ? params.token : ""
  const initialLookup = initialToken
    ? await lookupRedemptionToken(initialToken)
    : null

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Reward redemption"
        title="Scan a customer reward QR"
        description="Preview the reward, check it belongs to this merchant, then confirm redemption at the counter."
        actions={
          <span className="rounded-full border bg-secondary px-4 py-2 font-mono text-xs font-bold text-muted-foreground uppercase">
            {merchant.business_name}
          </span>
        }
      />

      <StatusBanner tone="neutral" title="Merchant verification required.">
        Customer reward pages only display a short-lived QR. A signed-in
        merchant must scan or paste that QR before the reward is marked
        redeemed.
      </StatusBanner>

      <ReceiptCard className="grid gap-5">
        <ScannerPanel
          initialToken={initialToken}
          initialLookup={initialLookup}
        />
      </ReceiptCard>
    </div>
  )
}
