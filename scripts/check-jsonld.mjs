#!/usr/bin/env node
/**
 * check-jsonld — parse every <script type="application/ld+json"> from the
 * prerendered marketing HTML and assert the connected entity graph: stable @id
 * cross-references, Organization-only authorship (no Person), the operator link,
 * Dataset/HowTo/DefinedTermSet nodes, and no banned sameAs (Companies House /
 * personal profiles). Run after `pnpm build`. Exit 1 on any failure.
 */
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const APP = join(process.cwd(), ".next/server/app")

function extractNodes(html) {
  const nodes = []
  const re =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  let m
  while ((m = re.exec(html))) {
    let parsed
    try {
      parsed = JSON.parse(m[1])
    } catch (err) {
      throw new Error(`JSON-LD parse error: ${err.message}`)
    }
    const items = Array.isArray(parsed) ? parsed : [parsed]
    for (const item of items) {
      if (item["@graph"]) nodes.push(...item["@graph"])
      else nodes.push(item)
    }
  }
  return nodes
}

async function load(file) {
  const html = await readFile(join(APP, file), "utf8")
  return extractNodes(html)
}

const failures = []
function check(cond, msg) {
  if (!cond) failures.push(msg)
}

function types(nodes) {
  return new Set(nodes.map((n) => n["@type"]).filter(Boolean))
}
function deepHasPerson(nodes) {
  return JSON.stringify(nodes).includes('"@type":"Person"')
}

// --- Home -----------------------------------------------------------------
const home = await load("index.html")
const homeTypes = types(home)
for (const t of [
  "Organization",
  "WebSite",
  "WebPage",
  "SoftwareApplication",
  "FAQPage",
  "HowTo",
  "Dataset",
  "DefinedTermSet",
  "BreadcrumbList",
]) {
  check(homeTypes.has(t), `home: missing ${t} node`)
}
check(!deepHasPerson(home), "home: a Person node is present (must be Organization-only)")

const orgs = home.filter((n) => n["@type"] === "Organization")
const naba = orgs.find((o) => o.name === "Nabaperks")
const operator = orgs.find((o) => o.name === "Lapen Inns")
check(!!naba, "home: Nabaperks Organization missing")
check(!!operator, "home: Lapen Inns operator Organization missing")
if (naba && operator) {
  check(
    naba.parentOrganization && naba.parentOrganization["@id"] === operator["@id"],
    "home: Nabaperks.parentOrganization does not reference the operator @id"
  )
}
if (operator) {
  const sameAs = JSON.stringify(operator.sameAs || [])
  check(
    !/companieshouse|company-information|linkedin\.com\/in/i.test(sameAs),
    "home: operator sameAs contains a banned URL (Companies House / personal)"
  )
  const locs = Array.isArray(operator.location) ? operator.location : []
  check(locs.length === 9, `home: operator should expose 9 estate places, got ${locs.length}`)
}

const howTo = home.find((n) => n["@type"] === "HowTo")
if (howTo) {
  const stepNames = (howTo.step || []).map((s) => s.name)
  check(
    JSON.stringify(stepNames) === JSON.stringify(["Scan", "Save", "Stamp", "Reward"]),
    `home: HowTo steps != Scan/Save/Stamp/Reward (got ${stepNames.join("/")})`
  )
}
const dataset = home.find((n) => n["@type"] === "Dataset")
if (dataset) {
  check(
    dataset.name === "Nabaperks Counter-Loyalty Index",
    "home: Dataset name is not the Counter-Loyalty Index"
  )
  check(!!dataset["@id"], "home: Dataset has no stable @id")
}
const webpage = home.find((n) => n["@type"] === "WebPage")
if (webpage) {
  check(
    webpage.reviewedBy && operator && webpage.reviewedBy["@id"] === operator["@id"],
    "home: WebPage.reviewedBy should reference the operator Organization @id"
  )
}

// --- Hub ------------------------------------------------------------------
const hub = await load("loyalty-for-pubs.html")
const hubTypes = types(hub)
for (const t of ["WebPage", "BreadcrumbList", "HowTo", "Dataset"]) {
  check(hubTypes.has(t), `hub: missing ${t} node`)
}
check(!deepHasPerson(hub), "hub: a Person node is present")

// --- About ----------------------------------------------------------------
const about = await load("about.html")
const aboutTypes = types(about)
for (const t of ["WebPage", "BreadcrumbList", "Organization"]) {
  check(aboutTypes.has(t), `about: missing ${t} node`)
}
check(!deepHasPerson(about), "about: a Person node is present")

// --- Guide (Article author = Organization) --------------------------------
const guide = await load("guides/best-loyalty-ideas-for-pubs.html")
const guideTypes = types(guide)
check(guideTypes.has("Article"), "guide: missing Article node")
check(guideTypes.has("BreadcrumbList"), "guide: missing BreadcrumbList node")
check(!deepHasPerson(guide), "guide: a Person node is present (author must be Organization)")
const article = guide.find((n) => n["@type"] === "Article")
if (article) {
  check(
    article.author && typeof article.author["@id"] === "string",
    "guide: Article.author is not an @id reference to an Organization"
  )
}

if (failures.length) {
  console.error(`✗ ${failures.length} JSON-LD check(s) failed:\n`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log("✓ JSON-LD graph valid: connected @id, Organization-only, Dataset/HowTo/DefinedTermSet present, no banned sameAs")
