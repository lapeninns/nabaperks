import type { MetadataRoute } from "next"

import { PUBLIC_SITE_ROUTES } from "@/lib/marketing/facts"
import { absoluteUrl } from "@/lib/seo/structured-data"

// No last-modified stamp: a build-time `new Date()` would mark every URL with
// the deploy time, misreporting freshness to crawlers. Omitting it is honest;
// per-route real dates can be added if the routes ever carry them.
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SITE_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
