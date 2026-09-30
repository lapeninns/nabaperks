import type { Metadata } from "next"
import type { ReactNode } from "react"
import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { MerchantAppShell } from "@/components/layout/merchant-app-shell"
import { MerchantBillingStripView } from "@/components/merchant/merchant-billing-strip"
import { REQUEST_PATH_HEADER } from "@/lib/navigation/request-path"

import { HARNESS_MERCHANT, HARNESS_TODAY_LABEL } from "./fixtures"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "App harness — merchant /app shell",
  robots: { index: false, follow: false },
}

/**
 * Unauthenticated harness shell. Mounts the REAL {@link MerchantAppShell} (the
 * same top bar, bottom tab bar and 900px rail the auth-gated /app routes use)
 * so the responsive merchant surface — tab bar, rail, per-page bodies — is
 * screenshot-provable at every breakpoint with NO Supabase login. Additive verification scaffolding only:
 * no /app page, component, or data-fetching path is modified.
 *
 * The shell's `signOutAction` is a no-op server action (the harness never signs
 * anyone out). `activePath` / `variant` are derived from the current request
 * path, read via the same `x-nabaperks-path` request header the proxy already
 * sets for every app route (proxy.ts), so a single layout serves every lane.
 * The date label is a literal so screenshots stay byte-stable.
 */

// A real (no-op) server action — the shell types signOutAction as a form action
// and both the setup and full shells wrap it in <form action={…}>.
async function noopSignOutAction() {
  "use server"
  if (process.env.NODE_ENV === "production") notFound()
}

const SETUP_LANES = new Set(["onboarding"])

/** Map a harness lane segment to the activePath the real shell nav highlights. */
const LANE_ACTIVE_PATH: Record<string, string> = {
  dashboard: "/app",
  customers: "/app/customers",
  activity: "/app/activity",
  numbers: "/app/numbers",
  more: "/app/more",
  announcements: "/app/announcements",
  offers: "/app/offers",
  account: "/app/account",
  qr: "/app/qr",
  scan: "/app/scan",
  "reward-scan": "/app/activity",
  "send-reward": "/app/customers",
  launch: "/app/launch",
  onboarding: "/app/onboarding",
}

function resolveLaneFromPath(pathname: string): string {
  // /dev/app-harness/<lane>(/...)? → <lane>
  const match = pathname.match(/\/dev\/app-harness\/([^/?#]+)/)
  return match?.[1] ?? "dashboard"
}

export default async function AppHarnessLayout({
  children,
}: {
  children: ReactNode
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const requestHeaders = await headers()
  // proxy.ts sets this to `${pathname}${search}` on every app route, so it
  // carries the lane segment (and any query, which the lane pages read).
  const requestPath =
    requestHeaders.get(REQUEST_PATH_HEADER) ?? "/dev/app-harness/dashboard"

  const queryIndex = requestPath.indexOf("?")
  const pathname =
    queryIndex >= 0 ? requestPath.slice(0, queryIndex) : requestPath
  const search =
    queryIndex >= 0 ? new URLSearchParams(requestPath.slice(queryIndex)) : null
  const forceOffline = search?.get("offline") === "1"
  // `?billing=past_due|cancelled|suspended` mounts the persistent billing
  // strip the real layout streams on every tab.
  const billing = search?.get("billing")
  const billingNotice =
    billing === "past_due" ||
    billing === "cancelled" ||
    billing === "suspended" ? (
      <MerchantBillingStripView status={billing} />
    ) : null

  const lane = resolveLaneFromPath(pathname)
  const variant = SETUP_LANES.has(lane) ? "setup" : "full"
  // Aggregate proof pages (skeletons/states) have no single nav home; the
  // dashboard is a stable active item for them.
  const activePath = LANE_ACTIVE_PATH[lane] ?? "/app"
  return (
    <MerchantAppShell
      signOutAction={noopSignOutAction}
      activePath={activePath}
      variant={variant}
      venueName={HARNESS_MERCHANT.business_name}
      todayLabel={HARNESS_TODAY_LABEL}
      forceOffline={forceOffline}
      billingNotice={billingNotice}
    >
      {children}
    </MerchantAppShell>
  )
}
