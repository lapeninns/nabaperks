import "server-only"

import * as webPush from "web-push"
import type { PushSubscription, SendResult } from "web-push"

import type { NotificationPayload } from "@/lib/notifications/catalog"
import { getWebPushServerConfig } from "@/lib/notifications/push-subscriptions"

type WebPushSender = (
  subscription: PushSubscription,
  payload: string
) => Promise<SendResult | void>

// Keep provider I/O well inside the five-minute notification-event lease.
// Without a socket timeout, a stalled push request can survive the lease,
// allowing a restarted worker to reclaim and deliver the same event again.
export const WEB_PUSH_SOCKET_TIMEOUT_MS = 15_000

export type PushSubscriptionData = {
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendWebPushNotification(
  subscription: PushSubscription,
  payload: Partial<NotificationPayload>,
  sender: WebPushSender = defaultWebPushSender
) {
  const response = await sender(subscription, JSON.stringify(payload))
  return { ok: true as const, statusCode: response?.statusCode ?? 201 }
}

export function isPermanentWebPushFailure(error: unknown) {
  return (
    isRecord(error) && (error.statusCode === 404 || error.statusCode === 410)
  )
}

export function toPushSubscription(
  subscription: PushSubscriptionData
): PushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  }
}

export function webPushStatusCode(error: unknown) {
  return isRecord(error) && typeof error.statusCode === "number"
    ? error.statusCode
    : 0
}

async function defaultWebPushSender(
  subscription: PushSubscription,
  payload: string
) {
  const config = getWebPushServerConfig()
  if (!config) throw new Error("Web Push VAPID configuration is missing")

  return webPush.sendNotification(subscription, payload, {
    vapidDetails: {
      subject: config.subject,
      publicKey: config.publicKey,
      privateKey: config.privateKey,
    },
    timeout: WEB_PUSH_SOCKET_TIMEOUT_MS,
    TTL: 60 * 60,
    urgency: "normal",
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
