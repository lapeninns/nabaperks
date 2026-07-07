import "server-only"

import { revalidatePath } from "next/cache"

import { revalidateMerchantCacheTags } from "@/lib/cache/tags"

/** Keep launch hub, dashboard, and tagged merchant caches aligned after writes. */
export function revalidateMerchantLaunchSurfaces(merchantId: string) {
  revalidateMerchantCacheTags(merchantId)
  revalidatePath("/app/launch")
  revalidatePath("/app")
}
