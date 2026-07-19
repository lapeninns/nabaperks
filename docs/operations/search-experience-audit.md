# Search experience audit operations

This runbook implements the content, real-world speed, and crawl-budget phases.
Digital-footprint and E-E-A-T work is deliberately out of scope.

## Content: keep, consolidate, or kill

Export at least one complete, representative reporting period to CSV with:

- `url`
- `pageviews`
- `conversions`
- `backlinks`
- `internal_links`
- `target_intent`
- `preferred_url` (optional unless a consolidation destination is already approved)

Generate the exact header with `pnpm seo:content-audit -- --template`, then run
`pnpm seo:content-audit -- path/to/export.csv`. The command emits an enriched
CSV and does not change a route, redirect, or response status.

`KEEP` requires recorded audience or conversion value. Duplicate intents are
ranked by conversions, backlinks, pageviews, and internal links, in that order.
`CONSOLIDATE_301`, `KILL_REVIEW_301`, and `KILL_REVIEW_410` are review queues,
not deployment instructions: confirm the data range, destination relevance,
and backlinks before changing HTTP behaviour.

The current source already removes `/signup` and the café, bar, and takeaway
spokes from the sitemap. The three non-pub spokes are `noindex, follow` while
they await the evidence above. No destructive redirect or 410 has been added.

## Real-user performance

Indexable marketing pages report CLS, INP, LCP, FCP, and TTFB to
`/api/analytics/web-vitals`. Only a closed page category is stored: no raw URL,
IP address, contact detail, or browser identity is persisted. The daily privacy
retention job removes samples after 90 days.

Use the 75th percentile by metric and page category. The primary success gates
are LCP at or below 2,500 ms, INP at or below 200 ms, and CLS at or below 0.1.
Track the percentage of page categories passing all three and the sample count
alongside each percentile; do not act on an under-sampled route.

Public brochure routes bypass the stateful auth Proxy and receive a fixed CSP
from `next.config.ts`. This allows the framework and CDN to cache their HTML.
The supporting Space Mono font is no longer preloaded, leaving the primary font
and above-the-fold content ahead of it on the critical render path.

## Crawl budget and bot herding

Export request logs to CSV with `timestamp,path,status,user_agent` and optional
`host,duration_ms`. Generate a header using
`pnpm seo:crawl-audit -- --template`, then run
`pnpm seo:crawl-audit -- path/to/logs.csv`.

The report covers five smoking guns: parameter URLs, utility/faceted paths,
private paths, 4xx responses, and 5xx responses. It also reports redirects and
repeated query variants. Verify Googlebot IPs at the log source before treating
a matching user agent as genuine.

Authenticated and app-like route families are disallowed in `robots.txt`; the
canonical public pages remain crawlable. No speculative query-parameter block
or `rel="nofollow"` sculpting is added because the current public site has no
faceted navigation or crawlable filter/cart links. Add a surgical rule only
when the log report shows a repeated waste pattern. The `www` host has an
application-level permanent redirect to the canonical apex host.

## KPIs

- Index quality: indexable sitemap URLs with self-canonicals; target 100%.
- Content quality: zero unsupported vertical spokes in the sitemap; target 0.
- Conversion: marketing view → sign-up click → sign-up start → verified email.
- Field speed: p75 LCP, INP, and CLS by page category plus sample count.
- Cacheability: public HTML responses without `Set-Cookie` and with a shared
  cache policy; target 100% of approved brochure routes.
- Crawl waste: bot requests to parameters, private paths, 4xx, and 5xx divided
  by recognised bot requests; trend each category down from its measured
  baseline rather than inventing a baseline.
