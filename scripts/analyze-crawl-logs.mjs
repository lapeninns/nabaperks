import { readFileSync } from "node:fs"

import { parseCsv } from "./seo-csv.mjs"

const REQUIRED_HEADERS = ["timestamp", "path", "status", "user_agent"]
const BOT_PATTERN =
  /(?:googlebot|bingbot|duckduckbot|yandexbot|baiduspider|applebot|gptbot|oai-searchbot|claudebot|perplexitybot|ccbot)/i
const UTILITY_PATH_PATTERN = /(?:^|\/)(?:search|tags?|filters?|cart)(?:\/|$)/i
const PRIVATE_PATH_PATTERN =
  /^\/(?:admin|api|app|auth|card|claim|demo|dev|home|m|merchant|q|r|reward|scan|signup|start)(?:\/|$)/

const inputPath = process.argv[2]
if (!inputPath || inputPath === "--template") {
  console.log([...REQUIRED_HEADERS, "host", "duration_ms"].join(","))
  process.exit(inputPath === "--template" ? 0 : 1)
}

const rows = parseCsv(readFileSync(inputPath, "utf8"))
const requests = rows
  .map(validateRow)
  .filter((row) => BOT_PATTERN.test(row.user_agent))
const variants = queryVariants(requests)

const findings = {
  bot_requests: requests.length,
  smoking_guns: {
    parameter_urls: count(requests, (row) => row.path.includes("?")),
    utility_or_faceted_paths: count(requests, (row) =>
      UTILITY_PATH_PATTERN.test(pathname(row.path))
    ),
    private_paths: count(requests, (row) =>
      PRIVATE_PATH_PATTERN.test(pathname(row.path))
    ),
    not_found_4xx: count(
      requests,
      (row) => row.status >= 400 && row.status < 500
    ),
    server_5xx: count(requests, (row) => row.status >= 500),
  },
  redirect_responses: count(
    requests,
    (row) => row.status >= 300 && row.status < 400
  ),
  repeated_query_variant_groups: variants,
  notes: [
    "Counts are based only on recognised crawler user agents in the supplied export.",
    "Verify Googlebot IPs before treating user-agent matches as genuine Google traffic.",
    "Use findings to justify surgical rules; this script never changes robots.txt or redirects.",
  ],
}

console.log(JSON.stringify(findings, null, 2))

function validateRow(row, index) {
  for (const header of REQUIRED_HEADERS) {
    if (!(header in row)) throw new Error(`CSV is missing the ${header} column`)
  }
  if (!row.path.startsWith("/")) {
    throw new Error(`Row ${index + 2} path must begin with /`)
  }
  if (!/^\d{3}$/.test(row.status)) {
    throw new Error(`Row ${index + 2} has an invalid status`)
  }
  return { ...row, status: Number(row.status) }
}

function pathname(path) {
  return path.split("?", 1)[0]
}

function count(rows, predicate) {
  return rows.reduce((total, row) => total + Number(predicate(row)), 0)
}

function queryVariants(rows) {
  const grouped = new Map()
  for (const row of rows) {
    if (!row.path.includes("?")) continue
    const base = pathname(row.path)
    const values = grouped.get(base) ?? new Set()
    values.add(row.path)
    grouped.set(base, values)
  }

  return [...grouped.entries()]
    .filter(([, values]) => values.size > 1)
    .map(([path, values]) => ({ path, variants: values.size }))
    .sort((left, right) => right.variants - left.variants)
}
