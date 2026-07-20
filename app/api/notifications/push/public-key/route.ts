import { noStoreJson } from "@/lib/http/no-store-json"
import { getWebPushPublicKey } from "@/lib/notifications/push-subscriptions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const publicKey = getWebPushPublicKey()

  return noStoreJson({ enabled: Boolean(publicKey), publicKey })
}
