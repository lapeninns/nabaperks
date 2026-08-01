#!/usr/bin/env node
/**
 * Validate the JSON-LD graphs on the public routes. Run after `pnpm build`;
 * the checker starts the production server, fetches the merchant sign-up page
 * (shared organisation graph) and the marketing landing page (WebPage +
 * Product + HowTo + FAQPage graph) and exits non-zero when either graph drifts.
 */
import { spawn } from "node:child_process"
import { once } from "node:events"
import { createServer } from "node:net"
import { setTimeout as delay } from "node:timers/promises"

let nextStart

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
      if (nextStart && nextStart.exitCode === null) nextStart.kill("SIGKILL")
    }),
  ])
}

process.once("exit", () => {
  if (nextStart && nextStart.exitCode === null) nextStart.kill("SIGTERM")
})

async function startProductionServer() {
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
      const response = await fetch(new URL("/signup", baseUrl))
      if (response.ok) return { baseUrl, html: await response.text() }
    } catch {
      // Retry until the production server is listening.
    }
    await delay(100)
  }

  await stopNextStart()
  throw new Error(`Timed out waiting for next start:\n${logs.join("")}`)
}

function extractNodes(html) {
  const nodes = []
  const scriptPattern =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  let match
  while ((match = scriptPattern.exec(html))) {
    const parsed = JSON.parse(match[1])
    const items = Array.isArray(parsed) ? parsed : [parsed]
    for (const item of items) {
      if (item["@graph"]) nodes.push(...item["@graph"])
      else nodes.push(item)
    }
  }
  return nodes
}

const failures = []
function check(condition, message) {
  if (!condition) failures.push(message)
}

async function fetchNodes(baseUrl, path) {
  const response = await fetch(new URL(path, baseUrl))
  if (!response.ok) {
    throw new Error(`${path} responded ${response.status}`)
  }
  return extractNodes(await response.text())
}

try {
  const { baseUrl, html } = await startProductionServer()
  const nodes = extractNodes(html)
  const types = new Set(nodes.map((node) => node["@type"]).filter(Boolean))
  const organisations = nodes.filter((node) => node["@type"] === "Organization")
  const nabaperks = organisations.find((node) => node.name === "Nabaperks")

  check(types.has("Organization"), "sign-up: Organization node missing")
  check(types.has("WebSite"), "sign-up: WebSite node missing")
  check(
    !JSON.stringify(nodes).includes('"@type":"Person"'),
    "sign-up: Person node present"
  )
  check(Boolean(nabaperks), "sign-up: Nabaperks Organization missing")
  check(
    organisations.length === 1,
    "sign-up: Nabaperks must be the only public Organization"
  )
  check(
    nabaperks?.parentOrganization === undefined,
    "sign-up: Nabaperks must not expose a parent-brand relationship"
  )
  check(
    !/Lapen Inns/i.test(JSON.stringify(nodes)),
    "sign-up: retired operator entity is present"
  )

  const homeNodes = await fetchNodes(baseUrl, "/")
  const homeTypes = new Set(
    homeNodes.map((node) => node["@type"]).filter(Boolean)
  )
  const product = homeNodes.find((node) => node["@type"] === "Product")
  const productOffers = Array.isArray(product?.offers)
    ? product.offers
    : product?.offers
      ? [product.offers]
      : []

  check(homeTypes.has("WebPage"), "home: WebPage node missing")
  check(homeTypes.has("Organization"), "home: Organization node missing")
  check(Boolean(product), "home: Growth Plan Product node missing")
  check(
    productOffers.map((offer) => offer.price).join(",") === "69.99,699.90",
    "home: Product offers must be exactly £69.99 every 28 days and £699.90 annually"
  )
  check(
    !JSON.stringify(homeNodes).includes('"@type":"Person"'),
    "home: Person node present"
  )

  // The HowTo and FAQPage nodes moved off `/` with their visible mirrors when
  // the landing was re-roled to a conversion page (2026-07-24). Each now sits
  // on the route that owns its visible mirror — the HowTo on how-it-works, the
  // FAQPage on /faq — so assert them where they live, not where they passed
  // through. One node per owning route: two FAQPage graphs would compete.
  const howItWorksNodes = await fetchNodes(baseUrl, "/how-it-works")
  const howItWorksHowTo = howItWorksNodes.find(
    (node) => node["@type"] === "HowTo"
  )
  check(
    Boolean(howItWorksHowTo) &&
      Array.isArray(howItWorksHowTo.step) &&
      howItWorksHowTo.step.length === 5,
    "how-it-works: five-step done-for-you HowTo missing"
  )
  check(
    !howItWorksNodes.some((node) => node["@type"] === "FAQPage"),
    "how-it-works: FAQPage must not linger here — /faq owns it"
  )

  const faqNodes = await fetchNodes(baseUrl, "/faq")
  const faqPage = faqNodes.find((node) => node["@type"] === "FAQPage")
  check(
    Boolean(faqPage) &&
      Array.isArray(faqPage.mainEntity) &&
      faqPage.mainEntity.length >= 5,
    "faq: FAQPage with the shared FAQ facts missing"
  )

  // The pub hub is a buyer's guide, so it carries an Article node — and must
  // not fork the FAQPage that /faq owns.
  const pubNodes = await fetchNodes(baseUrl, "/loyalty-for-pubs")
  check(
    pubNodes.some(
      (node) => node["@type"] === "Article" && Boolean(node.headline)
    ),
    "loyalty-for-pubs: Article node with a headline missing"
  )
  check(
    !pubNodes.some((node) => node["@type"] === "FAQPage"),
    "loyalty-for-pubs: FAQPage must not compete with /faq"
  )

  if (failures.length) {
    console.error(`✗ ${failures.length} JSON-LD check(s) failed:\n`)
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exitCode = 1
  } else {
    console.log(
      "✓ JSON-LD valid: sign-up Nabaperks organisation graph (single Organization, WebSite, no parent/Person), home marketing graph (WebPage, Product £69.99/£699.90), how-it-works HowTo (five steps), /faq FAQPage and the pub-hub Article — each node on its owning route"
    )
  }
} finally {
  await stopNextStart()
}
