import { redirect } from "next/navigation"

import { getCurrentMerchant } from "@/lib/auth/session"

type RedeemTokenPageProps = {
  params: Promise<{
    token: string
  }>
}

export default async function RedeemTokenPage({
  params,
}: RedeemTokenPageProps) {
  const { token } = await params
  const redeemPath = `/app/redeem?token=${encodeURIComponent(token)}`
  const merchant = await getCurrentMerchant()

  if (merchant) {
    redirect(redeemPath)
  }

  redirect(`/login?next=${encodeURIComponent(redeemPath)}`)
}
