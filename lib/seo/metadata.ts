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
  // "/p/" (the pass-scan handoff), "/offer/" and "/pass/" are deliberately
  // absent. Two separate reasons, both load-bearing:
  //
  //  1. app/robots.ts expands every entry here into its bare form as well, so
  //     "/p/" would also emit `Disallow: /p` — and robots.txt matches by
  //     prefix, which silently de-indexes /pricing and /privacy. Any future
  //     entry short enough to prefix a public route has the same hazard.
  //  2. Listing a confidential, unlisted path in robots.txt advertises it.
  //
  // All three routes carry PRIVATE_ROUTE_METADATA per route instead, which
  // keeps them out of search without publishing their existence.
  "/scan",
  "/start",
  "/m/",
  "/merchant/",
  // The interactive demo card is an app-like surface, not indexable content —
  // disallow it rather than leave it a crawlable-but-unlisted grey zone
  // (2026-07-05 GEO audit). Reverse + add to PUBLIC_SITE_ROUTES to index it.
  "/demo",
] as const
