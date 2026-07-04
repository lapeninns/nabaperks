#!/usr/bin/env node
/**
 * check-jsonld — parse every <script type="application/ld+json"> from built
 * marketing HTML and assert the connected entity graph: stable @id
 * cross-references, Organization-only authorship (no Person), the operator
 * link, Dataset/HowTo/DefinedTermSet nodes, and no banned sameAs (Companies
 * House / personal profiles). Static builds are read from .next/server/app; if
 * strict CSP nonces make routes dynamic, the script starts `next start` and
 * fetches the rendered HTML. Run after `pnpm build`. Exit 1 on any failure.
 */
import { spawn } from "node:child_process"
import { once } from "node:events"
import { access, readFile } from "node:fs/promises"
import { createServer } from "node:net"
import { join } from "node:path"
import { setTimeout as delay } from "node:timers/promises"

const APP = join(process.cwd(), ".next/server/app")
let nextStart
let nextStartBaseUrl

async function exists(file) {
  try {
    await access(file)
    return true
  } catch (error) {
    if (error && error.code === "ENOENT") return false
    throw error
  }
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to allocate a port")))
        return
      }
      server.close(() => resolve(address.port))
    })
  })
}

async function stopNextStart() {
  if (!nextStart || nextStart.exitCode !== null) return
  nextStart.kill("SIGTERM")
  await Promise.race([
    once(nextStart, "exit"),
    delay(1500).then(() => {
      if (nextStart && nextStart.exitCode === null) {
        nextStart.kill("SIGKILL")
      }
    }),
  ])
}

process.once("exit", () => {
  if (nextStart && nextStart.exitCode === null) nextStart.kill("SIGTERM")
})

async function ensureNextStart() {
  if (nextStartBaseUrl) return nextStartBaseUrl

  const port = await getFreePort()
  const logs = []
  nextStart = spawn(
    "pnpm",
    ["exec", "next", "start", "--hostname", "127.0.0.1", "--port", `${port}`],
    {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    }
  )

  nextStart.stdout.setEncoding("utf8")
  nextStart.stderr.setEncoding("utf8")
  nextStart.stdout.on("data", (chunk) => logs.push(chunk))
  nextStart.stderr.on("data", (chunk) => logs.push(chunk))

  const baseUrl = `http://127.0.0.1:${port}`
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (nextStart.exitCode !== null) {
      throw new Error(`next start exited early:\n${logs.join("")}`)
    }

    try {
      const response = await fetch(baseUrl, { redirect: "manual" })
      if (response.status < 500) {
        nextStartBaseUrl = baseUrl
        return baseUrl
      }
    } catch {
      // Retry until next start is listening.
    }

    await delay(100)
  }

  await stopNextStart()
  throw new Error(`Timed out waiting for next start:\n${logs.join("")}`)
}

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

async function load(file, route) {
  const builtHtml = join(APP, file)
  const html = (await exists(builtHtml))
    ? await readFile(builtHtml, "utf8")
    : await fetchRenderedHtml(route)
  return extractNodes(html)
}

async function fetchRenderedHtml(route) {
  const baseUrl = await ensureNextStart()
  const response = await fetch(new URL(route, baseUrl))
  if (!response.ok) {
    throw new Error(`GET ${route} returned ${response.status}`)
  }
  return response.text()
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
const home = await load("index.html", "/")
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
check(
  !deepHasPerson(home),
  "home: a Person node is present (must be Organization-only)"
)

const orgs = home.filter((n) => n["@type"] === "Organization")
const naba = orgs.find((o) => o.name === "Nabaperks")
const operator = orgs.find((o) => o.name === "Lapen Inns")
check(!!naba, "home: Nabaperks Organization missing")
check(!!operator, "home: Lapen Inns operator Organization missing")
if (naba && operator) {
  check(
    naba.parentOrganization &&
      naba.parentOrganization["@id"] === operator["@id"],
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
  check(
    locs.length === 9,
    `home: operator should expose 9 estate places, got ${locs.length}`
  )
}

const howTo = home.find((n) => n["@type"] === "HowTo")
if (howTo) {
  const stepNames = (howTo.step || []).map((s) => s.name)
  check(
    JSON.stringify(stepNames) ===
      JSON.stringify(["Scan", "Save", "Stamp", "Reward"]),
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
    webpage.reviewedBy &&
      operator &&
      webpage.reviewedBy["@id"] === operator["@id"],
    "home: WebPage.reviewedBy should reference the operator Organization @id"
  )
}

// --- How it works (the standalone mechanism page) ---------------------------
// Renders the same single-source sections as `/`, so it emits its own HowTo +
// FAQPage — with route-distinct @ids so they never collide with home's graph.
const mechanism = await load("how-it-works.html", "/how-it-works")
const mechanismTypes = types(mechanism)
for (const t of ["WebPage", "BreadcrumbList", "HowTo", "FAQPage"]) {
  check(mechanismTypes.has(t), `how-it-works: missing ${t} node`)
}
check(!deepHasPerson(mechanism), "how-it-works: a Person node is present")

const mechanismHowTo = mechanism.find((n) => n["@type"] === "HowTo")
if (mechanismHowTo) {
  const stepNames = (mechanismHowTo.step || []).map((s) => s.name)
  check(
    JSON.stringify(stepNames) ===
      JSON.stringify(["Scan", "Save", "Stamp", "Reward"]),
    `how-it-works: HowTo steps != Scan/Save/Stamp/Reward (got ${stepNames.join("/")})`
  )
  check(
    mechanismHowTo["@id"] === "https://nabaperks.com/how-it-works#howto",
    "how-it-works: HowTo @id must be route-distinct (/how-it-works#howto)"
  )
}
const mechanismFaq = mechanism.find((n) => n["@type"] === "FAQPage")
if (mechanismFaq) {
  const questions = Array.isArray(mechanismFaq.mainEntity)
    ? mechanismFaq.mainEntity
    : []
  check(
    questions.length === 8,
    `how-it-works: FAQ should expose 8 questions, got ${questions.length}`
  )
}

// --- Hub ------------------------------------------------------------------
const hub = await load("loyalty-for-pubs.html", "/loyalty-for-pubs")
const hubTypes = types(hub)
for (const t of ["WebPage", "BreadcrumbList", "HowTo", "Dataset"]) {
  check(hubTypes.has(t), `hub: missing ${t} node`)
}
check(!deepHasPerson(hub), "hub: a Person node is present")

const pricing = await load("pricing.html", "/pricing")
const pricingTypes = types(pricing)
for (const t of ["WebPage", "BreadcrumbList", "Offer", "FAQPage"]) {
  check(pricingTypes.has(t), `pricing: missing ${t} node`)
}
check(!deepHasPerson(pricing), "pricing: a Person node is present")
const pricingOffer = pricing.find((n) => n["@type"] === "Offer")
if (pricingOffer) {
  check(pricingOffer.price === "29.00", "pricing: Offer price should be 29.00")
  check(
    pricingOffer.priceCurrency === "GBP",
    "pricing: Offer currency should be GBP"
  )
  check(
    pricingOffer.url === "https://nabaperks.com/pricing",
    "pricing: Offer URL should point at /pricing"
  )
}
const pricingFaq = pricing.find((n) => n["@type"] === "FAQPage")
if (pricingFaq) {
  const questions = Array.isArray(pricingFaq.mainEntity)
    ? pricingFaq.mainEntity
    : []
  check(
    questions.length === 5,
    `pricing: FAQ should expose 5 questions, got ${questions.length}`
  )
}

// --- About ----------------------------------------------------------------
const about = await load("about.html", "/about")
const aboutTypes = types(about)
for (const t of ["WebPage", "BreadcrumbList", "Organization"]) {
  check(aboutTypes.has(t), `about: missing ${t} node`)
}
check(!deepHasPerson(about), "about: a Person node is present")

// --- Guide (Article author = Organization) --------------------------------
const guide = await load(
  "guides/best-loyalty-ideas-for-pubs.html",
  "/guides/best-loyalty-ideas-for-pubs"
)
const guideTypes = types(guide)
check(guideTypes.has("Article"), "guide: missing Article node")
check(guideTypes.has("BreadcrumbList"), "guide: missing BreadcrumbList node")
check(
  !deepHasPerson(guide),
  "guide: a Person node is present (author must be Organization)"
)
const article = guide.find((n) => n["@type"] === "Article")
if (article) {
  check(
    article.author && typeof article.author["@id"] === "string",
    "guide: Article.author is not an @id reference to an Organization"
  )
}

if (failures.length) {
  await stopNextStart()
  console.error(`✗ ${failures.length} JSON-LD check(s) failed:\n`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
await stopNextStart()
console.log(
  "✓ JSON-LD graph valid: connected @id, Organization-only, Dataset/HowTo/DefinedTermSet present, no banned sameAs"
)
