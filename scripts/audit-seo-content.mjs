import { readFileSync } from "node:fs"

import { parseCsv, toCsv } from "./seo-csv.mjs"

const TEMPLATE_HEADERS = [
  "url",
  "pageviews",
  "conversions",
  "backlinks",
  "internal_links",
  "target_intent",
  "preferred_url",
]
const OUTPUT_HEADERS = [...TEMPLATE_HEADERS, "bucket", "destination", "reason"]

const inputPath = process.argv[2]

if (!inputPath || inputPath === "--template") {
  console.log(toCsv([], TEMPLATE_HEADERS))
  process.exit(inputPath === "--template" ? 0 : 1)
}

const rows = parseCsv(readFileSync(inputPath, "utf8"))
const records = rows.map(validateRecord)
const groups = Map.groupBy(records, (record) => record.target_intent)
const results = records.map((record) => classify(record, groups))

console.log(toCsv(results, OUTPUT_HEADERS))

function validateRecord(row, index) {
  for (const header of TEMPLATE_HEADERS) {
    if (!(header in row)) throw new Error(`CSV is missing the ${header} column`)
  }
  if (!row.url) throw new Error(`Row ${index + 2} has no URL`)
  if (!row.target_intent) {
    throw new Error(
      `Row ${index + 2} has no target_intent; intent is required to detect cannibalisation`
    )
  }

  return {
    ...row,
    pageviews: metric(row.pageviews, "pageviews", index),
    conversions: metric(row.conversions, "conversions", index),
    backlinks: metric(row.backlinks, "backlinks", index),
    internal_links: metric(row.internal_links, "internal_links", index),
  }
}

function metric(value, name, index) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Row ${index + 2} has an invalid ${name} value`)
  }
  return Number(value)
}

function classify(record, groups) {
  const intentGroup = groups.get(record.target_intent) ?? []
  if (intentGroup.length > 1) return classifyCannibal(record, intentGroup)

  const hasAudienceValue = record.pageviews > 0 || record.conversions > 0
  if (hasAudienceValue) {
    return result(record, "KEEP", "", "Traffic or conversions recorded")
  }
  if (record.backlinks > 0) {
    return result(
      record,
      "KILL_REVIEW_301",
      record.preferred_url,
      "No traffic or conversions; backlinks require an evidence-backed redirect review"
    )
  }
  if (record.internal_links > 0) {
    return result(
      record,
      "KILL_REVIEW",
      record.preferred_url,
      "No external value; update internal links before removal"
    )
  }
  return result(
    record,
    "KILL_REVIEW_410",
    "",
    "Zero traffic, conversions, backlinks, and internal links"
  )
}

function classifyCannibal(record, intentGroup) {
  const explicitDestinations = new Set(
    intentGroup.map((item) => item.preferred_url).filter(Boolean)
  )
  if (explicitDestinations.size > 1) {
    throw new Error(
      `Intent ${record.target_intent} has conflicting preferred_url values`
    )
  }

  const destination =
    [...explicitDestinations][0] ??
    [...intentGroup].sort(compareEvidence)[0].url

  return record.url === destination
    ? result(
        record,
        "KEEP",
        "",
        "Preferred destination for a duplicated search intent"
      )
    : result(
        record,
        "CONSOLIDATE_301",
        destination,
        "Duplicates another URL's target intent"
      )
}

function compareEvidence(left, right) {
  return (
    right.conversions - left.conversions ||
    right.backlinks - left.backlinks ||
    right.pageviews - left.pageviews ||
    right.internal_links - left.internal_links ||
    left.url.localeCompare(right.url)
  )
}

function result(record, bucket, destination, reason) {
  return { ...record, bucket, destination, reason }
}
