import type { MetadataRoute } from "next"

import { PUBLIC_SITE_ROUTES } from "@/lib/marketing/facts"
import { absoluteUrl } from "@/lib/seo/structured-data"

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return PUBLIC_SITE_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
