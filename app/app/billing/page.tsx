import { redirect } from "next/navigation"

// Billing now lives in the Account hub. Stripe checkout/portal still return to
// `/app/billing?...`, so forward those outcome params onto the Billing tab.
type BillingPageProps = {
  searchParams: Promise<{
    checkout?: string
    portal?: string
  }>
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams
  const query = new URLSearchParams({ tab: "billing" })

  if (params.checkout) query.set("checkout", params.checkout)
  if (params.portal) query.set("portal", params.portal)

  redirect(`/app/account?${query.toString()}`)
}
