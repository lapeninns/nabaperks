import { redirect } from "next/navigation"

import { Eyebrow, ReceiptCard, VenueMark } from "@/components/brand"
import { WalletLoginForm } from "@/components/customer/wallet-login-form"
import { CustomerShell } from "@/components/layout"
import { getCustomerSession } from "@/lib/customer/session"

export const metadata = {
  title: "Open your wallet — Nabaperks",
}

export default async function WalletLoginPage() {
  const session = await getCustomerSession()

  if (session) {
    redirect("/wallet")
  }

  return (
    <CustomerShell>
      <ReceiptCard edge className="grid gap-6">
        <div className="grid justify-items-center gap-3 text-center">
          <VenueMark size={56} name="Nabaperks" caption="Your wallet" />
          <div className="grid gap-1">
            <Eyebrow>Nabaperks wallet</Eyebrow>
            <h1 className="text-2xl leading-tight font-extrabold text-balance">
              Open your wallet
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Sign in to see every loyalty card you&apos;ve collected, track your
              rewards, and pick up where you left off.
            </p>
          </div>
        </div>

        <WalletLoginForm />

        <p className="border-t-2 border-ink/15 pt-4 text-center text-sm leading-6 text-muted-foreground">
          New here? Scan a venue&apos;s QR code to collect your first stamp — your
          wallet is created automatically.
        </p>
      </ReceiptCard>
    </CustomerShell>
  )
}
