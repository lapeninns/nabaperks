import type { Metadata } from "next"

export const PRIVATE_ROUTE_METADATA = {
  robots: {
    index: false,
    follow: false,
  },
} satisfies Pick<Metadata, "robots">

export const PRIVATE_ROUTE_PREFIXES = [
  "/app/",
  "/admin/",
  "/dev/",
  "/api/",
  "/home/",
  "/card/",
  "/reward/",
  "/q/",
  "/r/",
  // The pass-scan handoff mirrors "/r/": it is a staff-facing redirect shim, so
  // disallowing it costs nothing. "/offer/" and "/pass/" are deliberately
  // absent — listing a confidential, unlisted path in robots.txt advertises it,
  // so those carry per-route metadata.robots instead.
  "/p/",
  "/scan",
  "/start",
  "/m/",
  "/merchant/",
  // The interactive demo card is an app-like surface, not indexable content —
  // disallow it rather than leave it a crawlable-but-unlisted grey zone
  // (2026-07-05 GEO audit). Reverse + add to PUBLIC_SITE_ROUTES to index it.
  "/demo",
] as const
