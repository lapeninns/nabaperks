import { notFound } from "next/navigation"

import { MerchantAdminPreviewScreen } from "@/app/dev/merchant-admin-preview/screens"
import {
  isMerchantAdminPreviewSurfaceId,
  merchantAdminPreviewSurface,
} from "@/lib/dev/merchant-admin-preview"

type MerchantAdminPreviewPageProps = {
  params: Promise<{
    surface: string
  }>
}

export default async function MerchantAdminPreviewPage({
  params,
}: MerchantAdminPreviewPageProps) {
  const { surface } = await params

  if (!isMerchantAdminPreviewSurfaceId(surface)) {
    notFound()
  }

  const entry = merchantAdminPreviewSurface(surface)

  // Redirect surfaces have no screen to render — their forwarding behaviour is
  // proven by the production route tests, not by a fabricated preview.
  if (entry.kind === "redirect") {
    notFound()
  }

  return <MerchantAdminPreviewScreen surfaceId={entry.id} />
}
