import type { MetadataRoute } from "next"

import { PRIVATE_ROUTE_PREFIXES } from "@/lib/seo/metadata"
import { SITE_URL } from "@/lib/seo/structured-data"

/**
 * Private product surfaces — keep these out of search and AI indexes. Each
 * trailing-slash prefix is also disallowed in its bare form so `/app`,
 * `/admin`, `/home` (etc.) are covered, not just their children.
 */
const disallow = Array.from(
  new Set(
    Array.from(PRIVATE_ROUTE_PREFIXES).flatMap((prefix) => [
      prefix,
      prefix.endsWith("/") ? prefix.slice(0, -1) : prefix,
    ])
  )
)

/**
 * robots.txt — open the public marketing + legal pages to every crawler, keep
 * the authenticated product surfaces private, and explicitly welcome the AI
 * answer-engine crawlers (GEO): being cited in AI answers needs them allowed.
 */
export default function robots(): MetadataRoute.Robots {
  const aiCrawlers = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "anthropic-ai",
    "PerplexityBot",
    "Google-Extended",
    "Applebot-Extended",
    "CCBot",
  ]

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: aiCrawlers, allow: "/", disallow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
