import type { MetadataRoute } from "next"

import { PRIVATE_ROUTE_PREFIXES } from "@/lib/seo/metadata"
import { SITE_URL } from "@/lib/seo/structured-data"

/** Private product surfaces — keep these out of search and AI indexes. */
const disallow = Array.from(PRIVATE_ROUTE_PREFIXES)

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
