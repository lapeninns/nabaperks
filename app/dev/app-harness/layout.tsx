import type { Metadata } from "next"
import type { ReactNode } from "react"
import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { MerchantAppShell } from "@/components/layout/merchant-app-shell"
import { REQUEST_PATH_HEADER } from "@/lib/navigation/request-path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "App harness — merchant /app shell",
  robots: { index: false, follow: false },
}

/**
 * Unauthenticated harness shell. Mounts the REAL {@link MerchantAppShell} (the
 * same collapsible sidebar + mobile header the auth-gated /app routes use) so
 * the responsive merchant surface — sidebar collapse, the hamburger drawer,
 * per-page bodies — is screenshot-provable at every breakpoint with NO
 * Supabase login. Additive verification scaffolding only:
 * no /app page, component, or data-fetching path is modified.
 *
 * The shell's `signOutAction` is a no-op server action (the harness never signs
 * anyone out). `activePath` / `variant` / `defaultSidebarOpen` are derived from
 * the current request path + query, read via the same `x-nabaperks-path`
 * request header the proxy already sets for every app route (proxy.ts), so a
 * single layout serves every lane and honours `?sidebar=collapsed`.
 */

// A real (no-op) server action — the shell types signOutAction as a form action
// and both the setup and full shells wrap it in <form action={…}>.
async function noopSignOutAction() {
  "use server"
}

const SETUP_LANES = new Set(["onboarding"])

/** Map a harness lane segment to the activePath the real shell nav highlights. */
const LANE_ACTIVE_PATH: Record<string, string> = {
  dashboard: "/app",
  customers: "/app/customers",
  activity: "/app/activity",
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

/**
 * The inverse of LANE_ACTIVE_PATH: real /app href → the harness page that
 * stands in for it. Derived from the same table so the two cannot drift, and
 * first-wins so a lane that maps several harness pages onto one nav entry
 * (reward-scan and send-reward both point at real sections) does not fight
 * over the destination.
 *
 * The sidebar previously rendered the real hrefs, so one tap on "Customers"
 * left the harness for an auth-gated route and the run was over (ADM 04#71).
 * Anything absent here has no harness page and the nav renders it inert.
 */
const HARNESS_NAV_HREFS: Readonly<Record<string, string>> = Object.freeze(
  Object.entries(LANE_ACTIVE_PATH).reduce<Record<string, string>>(
    (map, [lane, appPath]) => {
      if (!(appPath in map)) {
        map[appPath] = `/dev/app-harness/${lane}`
      }
      return map
    },
    {}
  )
)

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
  // carries both the lane segment and any `?sidebar=` query.
  const requestPath =
    requestHeaders.get(REQUEST_PATH_HEADER) ?? "/dev/app-harness/dashboard"

  let pathname = requestPath
  let search = ""
  const queryIndex = requestPath.indexOf("?")
  if (queryIndex >= 0) {
    pathname = requestPath.slice(0, queryIndex)
    search = requestPath.slice(queryIndex)
  }

  const lane = resolveLaneFromPath(pathname)
  const variant = SETUP_LANES.has(lane) ? "setup" : "full"
  // Aggregate proof pages (skeletons/states) have no single nav home; the
  // dashboard is a stable active item for them.
  const activePath = LANE_ACTIVE_PATH[lane] ?? "/app"
  const sidebarCollapsed =
    new URLSearchParams(search).get("sidebar") === "collapsed"

  return (
    <MerchantAppShell
      signOutAction={noopSignOutAction}
      activePath={activePath}
      variant={variant}
      defaultSidebarOpen={!sidebarCollapsed}
      navHrefOverrides={HARNESS_NAV_HREFS}
    >
      {children}
    </MerchantAppShell>
  )
}
