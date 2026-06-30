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
  "/scan",
  "/start",
  "/m/",
  "/merchant/",
] as const
