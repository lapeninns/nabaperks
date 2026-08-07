"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BellOffIcon,
  BellPlusIcon,
  BellRingIcon,
} from "@hugeicons/core-free-icons"

import { Icon, IconRoundel, SectionHeader } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type BrowserPushState =
  | "checking"
  | "unsupported"
  | "installed-required"
  | "denied"
  | "granted"
  | "subscribed"
  | "error"

export type PushPreferences = {
  transactionalEnabled: boolean
  reminderEnabled: boolean
  marketingEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  activeSubscriptionCount: number
}

const defaultPreferences: PushPreferences = {
  transactionalEnabled: true,
  reminderEnabled: true,
  marketingEnabled: false,
  quietHoursStart: "21:00",
  quietHoursEnd: "09:00",
  activeSubscriptionCount: 0,
}

const preferenceRows = [
  {
    key: "transactionalEnabled",
    label: "Stamps and rewards",
    helper: "Card progress, reward readiness, and collection updates.",
  },
  {
    key: "reminderEnabled",
    label: "Reminders",
    helper: "Next stamp windows and reward expiry notices.",
  },
  {
    key: "marketingEnabled",
    label: "Venue offers",
    helper: "Only sent when your venue consent also allows it.",
  },
] satisfies readonly {
  key: keyof Pick<
    PushPreferences,
    "transactionalEnabled" | "reminderEnabled" | "marketingEnabled"
  >
  label: string
  helper: string
}[]

export type PushNotificationSettingsProps = {
  initialPreferences?: PushPreferences
  showHeader?: boolean
  surface?: boolean
}

export function PushNotificationSettings({
  initialPreferences = defaultPreferences,
  showHeader = true,
  surface = true,
}: PushNotificationSettingsProps) {
  const [browserState, setBrowserState] = useState<BrowserPushState>("checking")
  const [preferences, setPreferences] =
    useState<PushPreferences>(initialPreferences)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let ignore = false

    async function init() {
      const nextState = await resolveBrowserPushState()
      if (!ignore) setBrowserState(nextState)

      const response = await fetch("/api/notifications/push/preferences", {
        cache: "no-store",
      })
      if (ignore || !response.ok) return
      const body = (await response.json().catch(() => null)) as {
        preferences?: PushPreferences
      } | null
      if (body?.preferences && !ignore) setPreferences(body.preferences)
    }

    void init()
    return () => {
      ignore = true
    }
  }, [])

  const status = useMemo(() => statusFor(browserState), [browserState])
  const canEnable = browserState === "granted" || browserState === "error"
  const isSubscribed = browserState === "subscribed"

  async function handleEnable() {
    setPending(true)
    setMessage(null)
    try {
      const publicKey = await loadPublicKey()
      if (!publicKey) {
        setBrowserState("unsupported")
        return
      }

      await fetch("/api/notifications/push/prompt-viewed", {
        method: "POST",
      }).catch(() => null)

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission()

      if (permission === "denied") {
        setBrowserState("denied")
        return
      }
      if (permission !== "granted") {
        setBrowserState("granted")
        return
      }

      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }))

      const response = await fetch("/api/notifications/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          permissionState: permission,
        }),
      })
      if (!response.ok) throw new Error("subscribe_failed")

      setBrowserState("subscribed")
      setPreferences((current) => ({
        ...current,
        activeSubscriptionCount: Math.max(1, current.activeSubscriptionCount),
      }))
      setMessage("Push is on for this browser.")
    } catch {
      setBrowserState("error")
      setMessage("Push could not be enabled here.")
    } finally {
      setPending(false)
    }
  }

  async function handleDisable() {
    setPending(true)
    setMessage(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const response = await fetch("/api/notifications/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        }).catch(() => null)
        if (!response?.ok) {
          // The server record is still active, so stay in the subscribed
          // state: flipping to "error" here would offer "Enable push" while
          // the subscription is live and hide the retryable disable action.
          setMessage("Push could not be turned off here. Try again.")
          return
        }
        await subscription.unsubscribe()
      }
      setBrowserState("granted")
      setPreferences((current) => ({
        ...current,
        activeSubscriptionCount: 0,
      }))
      setMessage("Push is off for this browser.")
    } catch {
      setBrowserState("error")
      setMessage("Push could not be changed here.")
    } finally {
      setPending(false)
    }
  }

  async function updatePreference(
    key: (typeof preferenceRows)[number]["key"],
    value: boolean
  ) {
    const next = { ...preferences, [key]: value }
    setPreferences(next)
    setMessage(null)
    const response = await fetch("/api/notifications/push/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    })
    if (!response.ok) {
      setPreferences(preferences)
      setMessage("Preference was not saved.")
      return
    }
    const body = (await response.json().catch(() => null)) as {
      preferences?: PushPreferences
    } | null
    if (body?.preferences) setPreferences(body.preferences)
  }

  return (
    <section
      className={cn("grid gap-4", surface && "surface-card p-5")}
      data-notification-state={browserState}
    >
      {showHeader ? (
        <SectionHeader eyebrow="Push" title="Browser notifications" />
      ) : null}

      <div className="flex items-start gap-3 rounded-lg border-2 border-ink bg-secondary/60 p-3">
        <IconRoundel
          icon={status.icon}
          iconSize={20}
          size="md"
          className="bg-background"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-foreground">
            {status.title}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {status.body}
          </p>
          {message ? (
            <p className="pt-1 text-sm font-bold text-foreground">{message}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isSubscribed ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDisable}
            disabled={pending}
          >
            <Icon icon={BellOffIcon} size={16} />
            Turn off push
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={handleEnable}
            disabled={pending || !canEnable}
          >
            <Icon icon={BellPlusIcon} size={16} />
            Enable push
          </Button>
        )}
      </div>

      <ul className="grid gap-3">
        {preferenceRows.map((row) => (
          <li key={row.key} className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <p className="eyebrow">{row.label}</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {row.helper}
              </p>
            </div>
            <label className="-m-3 mt-0.5 inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center p-3">
              <span className="sr-only">{row.label}</span>
              <input
                type="checkbox"
                checked={preferences[row.key]}
                onChange={(event) =>
                  void updatePreference(row.key, event.currentTarget.checked)
                }
                className="size-5 shrink-0 accent-primary disabled:opacity-60"
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}

async function resolveBrowserPushState(): Promise<BrowserPushState> {
  if (typeof window === "undefined") return "unsupported"

  const hasServiceWorker = "serviceWorker" in navigator
  const hasNotification = "Notification" in window
  const hasPushManager = "PushManager" in window
  if (!hasServiceWorker || !hasNotification || !hasPushManager) {
    return needsInstallSurface() ? "installed-required" : "unsupported"
  }

  if (Notification.permission === "denied") return "denied"

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) return "subscribed"
  } catch {
    return "error"
  }

  return "granted"
}

function statusFor(state: BrowserPushState) {
  switch (state) {
    case "checking":
      return {
        icon: BellRingIcon,
        title: "Checking this browser",
        body: "Push status will appear here.",
      }
    case "unsupported":
      return {
        icon: BellOffIcon,
        title: "Push is not available",
        body: "This browser cannot receive Nabaperks push.",
      }
    case "installed-required":
      return {
        icon: BellOffIcon,
        title: "Install needed",
        body: "Add Nabaperks to your home screen to enable push.",
      }
    case "denied":
      return {
        icon: BellOffIcon,
        title: "Push is blocked",
        body: "Change browser permission before enabling push here.",
      }
    case "subscribed":
      return {
        icon: BellRingIcon,
        title: "Push is on",
        body: "This browser can receive loyalty updates.",
      }
    case "error":
      return {
        icon: BellOffIcon,
        title: "Push needs attention",
        body: "Try again or use this page from another browser.",
      }
    case "granted":
      return {
        icon: BellPlusIcon,
        title: "Push is ready",
        body: "Enable this browser for loyalty updates.",
      }
  }
}

async function loadPublicKey() {
  const response = await fetch("/api/notifications/push/public-key", {
    cache: "no-store",
  })
  if (!response.ok) return null
  const body = (await response.json().catch(() => null)) as {
    enabled?: boolean
    publicKey?: string | null
  } | null
  return body?.enabled && body.publicKey ? body.publicKey : null
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }
  return output
}

function needsInstallSurface() {
  const nav = navigator as Navigator & { standalone?: boolean }
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(nav.standalone)
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !installed
}
