import type { MetadataRoute } from "next"

import { PUBLIC_SITE_ROUTES } from "@/lib/marketing/facts"
import { PRIVATE_ROUTE_PREFIXES } from "@/lib/seo/metadata"
import { SITE_URL } from "@/lib/seo/structured-data"

/**
 * Private product surfaces — keep these out of search and AI indexes. Each
 * trailing-slash prefix is also disallowed in its bare form so `/app`,
 * `/admin`, `/home` (etc.) are covered, not just their children.
 *
 * ...except when that bare form would swallow a public page. robots.txt matches
 * by PREFIX, so `"/merchant/"` also emitted `Disallow: /merchant`, which blocks
 * `/merchant-terms` — a legal page this site publishes in its own sitemap. The
 * site was telling crawlers to index it and not to read it.
 *
 * `lib/seo/metadata.ts` already warns that "any future entry short enough to
 * prefix a public route has the same hazard" and keeps `/p/`, `/offer/` and
 * `/pass/` out of this list by hand for exactly that reason. Checking against
 * the sitemap makes the guard automatic instead of a comment someone has to
 * remember: the slashed prefix always ships, and the bare form is dropped when
 * it would collide.
 */
const publicPaths = PUBLIC_SITE_ROUTES.map((route) => route.path)

function blocksAPublicPage(rule: string): boolean {
  return publicPaths.some((path) => path !== rule && path.startsWith(rule))
}

const disallow = Array.from(
  new Set(
    Array.from(PRIVATE_ROUTE_PREFIXES).flatMap((prefix) => {
      const bare = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix

      return blocksAPublicPage(bare) ? [prefix] : [prefix, bare]
    })
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
