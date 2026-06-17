import { notFound, redirect } from "next/navigation"

type RewardScanHandoffPageProps = {
  params: Promise<{
    token: string
  }>
}

const SCAN_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function RewardScanHandoffPage({
  params,
}: RewardScanHandoffPageProps) {
  const { token } = await params

  if (!SCAN_TOKEN_PATTERN.test(token)) {
    notFound()
  }

  redirect(`/app/rewards/scan/${encodeURIComponent(token)}`)
}
