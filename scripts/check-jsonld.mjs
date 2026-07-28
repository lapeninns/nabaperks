#!/usr/bin/env node
/**
 * Validate the JSON-LD graphs on the public routes. Run after `pnpm build`;
 * the checker starts the production server and validates the shared entity
 * graph plus the canonical, offer, FAQ, HowTo, persona and guide Article
 * graphs. Rich-result copy is compared with rendered text after JSON-LD and
 * hydration scripts are removed, so a schema block cannot validate itself.
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
  const baseUrl = `http://127.0.0.1:${port}`
  nextStart = spawn(
    "pnpm",
    ["exec", "next", "start", "--hostname", "127.0.0.1", "--port", `${port}`],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "production",
        // Public marketing pages do not call these providers. Fill only
        // missing values with loopback/test placeholders so this post-build
        // check exercises the production server without requiring secrets or
        // a developer-specific .env file.
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? baseUrl,
        NEXT_PUBLIC_SUPABASE_URL:
          process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY:
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "jsonld-check-anon",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
          "pk_test_jsonld_check",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  )
  nextStart.stdout.setEncoding("utf8")
  nextStart.stderr.setEncoding("utf8")
  nextStart.stdout.on("data", (chunk) => logs.push(chunk))
  nextStart.stderr.on("data", (chunk) => logs.push(chunk))

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

function decodeHtmlEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  }

  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi,
    (entity, decimal, hexadecimal, name) => {
      if (decimal) return String.fromCodePoint(Number(decimal))
      if (hexadecimal)
        return String.fromCodePoint(Number.parseInt(hexadecimal, 16))
      return named[name.toLowerCase()] ?? entity
    }
  )
}

function normalizeText(value) {
  return decodeHtmlEntities(String(value)).replace(/\s+/g, " ").trim()
}

function extractVisibleText(html) {
  return normalizeText(
    html
      .replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
  )
}

function pageFromHtml(html) {
  return {
    html,
    nodes: extractNodes(html),
    visibleText: extractVisibleText(html),
  }
}

const failures = []
function check(condition, message) {
  if (!condition) failures.push(message)
}

async function fetchPage(baseUrl, path) {
  const response = await fetch(new URL(path, baseUrl))
  if (!response.ok) {
    throw new Error(`${path} responded ${response.status}`)
  }
  return pageFromHtml(await response.text())
}

const SITE_URL = "https://nabaperks.com"

function absolutePageUrl(path) {
  return new URL(path, SITE_URL).toString()
}

function nodesOfType(page, type) {
  return page.nodes.filter((node) => node["@type"] === type)
}

function oneNode(page, type, label) {
  const nodes = nodesOfType(page, type)
  check(nodes.length === 1, `${label}: expected one ${type} node`)
  return nodes[0]
}

function checkVisible(page, value, label) {
  check(
    typeof value === "string" &&
      page.visibleText.includes(normalizeText(value)),
    `${label}: structured-data text is not visible on the page`
  )
}

function checkCanonicalGraph(page, path, label) {
  const expectedUrl = absolutePageUrl(path)
  const webPage = oneNode(page, "WebPage", label)

  check(webPage?.url === expectedUrl, `${label}: WebPage URL is not canonical`)
  check(
    webPage?.["@id"] === `${expectedUrl}#webpage`,
    `${label}: WebPage @id is not canonical`
  )
  check(
    webPage?.isPartOf?.["@id"] === `${SITE_URL}/#website`,
    `${label}: WebPage isPartOf does not reference the shared WebSite`
  )
  return webPage
}

function checkBreadcrumb(page, path, label) {
  const breadcrumb = oneNode(page, "BreadcrumbList", label)
  const items = Array.isArray(breadcrumb?.itemListElement)
    ? breadcrumb.itemListElement
    : []

  check(items.length >= 2, `${label}: breadcrumb needs root and current items`)
  check(
    items.every((item, index) => item.position === index + 1),
    `${label}: breadcrumb positions are not sequential`
  )
  check(
    items[0]?.item === absolutePageUrl("/"),
    `${label}: breadcrumb root is not canonical`
  )
  check(
    items.at(-1)?.item === absolutePageUrl(path),
    `${label}: breadcrumb current item is not canonical`
  )
  checkVisible(page, items.at(-1)?.name, `${label}: breadcrumb current item`)
}

function checkFaqParity(page, label, expectedCount) {
  const faq = oneNode(page, "FAQPage", label)
  const questions = Array.isArray(faq?.mainEntity) ? faq.mainEntity : []

  check(
    questions.length === expectedCount,
    `${label}: FAQPage must contain exactly ${expectedCount} questions`
  )
  for (const [index, question] of questions.entries()) {
    check(
      question?.["@type"] === "Question",
      `${label}: FAQ item ${index + 1} is not a Question`
    )
    check(
      question?.acceptedAnswer?.["@type"] === "Answer",
      `${label}: FAQ item ${index + 1} has no Answer`
    )
    checkVisible(page, question?.name, `${label}: FAQ question ${index + 1}`)
    checkVisible(
      page,
      question?.acceptedAnswer?.text,
      `${label}: FAQ answer ${index + 1}`
    )
  }
}

function checkProductOffers(page, label) {
  const product = oneNode(page, "Product", label)
  const offers = Array.isArray(product?.offers) ? product.offers : []
  const expectedOffers = [
    { price: "49", visiblePrice: "£49/month" },
    { price: "490", visiblePrice: "£490/year" },
  ]

  check(offers.length === 2, `${label}: Product must contain two offers`)
  for (const expected of expectedOffers) {
    const offer = offers.find((candidate) => candidate.price === expected.price)
    check(Boolean(offer), `${label}: £${expected.price} offer is missing`)
    check(
      offer?.priceCurrency === "GBP",
      `${label}: £${expected.price} offer currency is not GBP`
    )
    check(
      offer?.url === absolutePageUrl("/pricing"),
      `${label}: £${expected.price} offer URL is not canonical`
    )
    check(
      offer?.availability === "https://schema.org/InStock",
      `${label}: £${expected.price} offer availability drifted`
    )
    checkVisible(
      page,
      expected.visiblePrice,
      `${label}: £${expected.price} offer`
    )
  }
}

function checkHowToParity(page, label) {
  const howTo = oneNode(page, "HowTo", label)
  const steps = Array.isArray(howTo?.step) ? howTo.step : []

  check(steps.length === 5, `${label}: HowTo must contain five steps`)
  for (const [index, step] of steps.entries()) {
    check(
      step?.position === index + 1,
      `${label}: HowTo step positions are not sequential`
    )
    checkVisible(page, step?.name, `${label}: HowTo step ${index + 1} name`)
    checkVisible(page, step?.text, `${label}: HowTo step ${index + 1} text`)
  }
}

function checkArticle(page, path, label) {
  const article = oneNode(page, "Article", label)
  const expectedUrl = absolutePageUrl(path)

  check(
    article?.["@id"] === `${expectedUrl}#article`,
    `${label}: Article @id is not canonical`
  )
  check(
    article?.mainEntityOfPage === expectedUrl,
    `${label}: Article mainEntityOfPage is not canonical`
  )
  check(
    article?.author?.["@id"] === `${SITE_URL}/#organization`,
    `${label}: Article author is not the shared Organization`
  )
  check(
    article?.publisher?.["@id"] === `${SITE_URL}/#organization`,
    `${label}: Article publisher is not the shared Organization`
  )
  checkVisible(page, article?.headline, `${label}: Article headline`)
  check(
    /^\d{4}-\d{2}-\d{2}$/.test(article?.datePublished ?? ""),
    `${label}: Article datePublished is not an ISO date`
  )
  check(
    /^\d{4}-\d{2}-\d{2}$/.test(article?.dateModified ?? ""),
    `${label}: Article dateModified is not an ISO date`
  )
  check(
    new RegExp(`datetime="${article?.dateModified}"`, "i").test(page.html),
    `${label}: Article dateModified does not match the visible time element`
  )
}

try {
  const { baseUrl, html } = await startProductionServer()
  const signupPage = pageFromHtml(html)
  const nodes = signupPage.nodes
  const types = new Set(nodes.map((node) => node["@type"]).filter(Boolean))
  const organisations = nodes.filter((node) => node["@type"] === "Organization")
  const nabaperks = organisations.find((node) => node.name === "Nabaperks")
  const operator = organisations.find((node) => node.name === "Lapen Inns")

  check(types.has("Organization"), "sign-up: Organization node missing")
  check(types.has("WebSite"), "sign-up: WebSite node missing")
  check(
    !JSON.stringify(nodes).includes('"@type":"Person"'),
    "sign-up: Person node present"
  )
  check(Boolean(nabaperks), "sign-up: Nabaperks Organization missing")
  check(Boolean(operator), "sign-up: Lapen Inns Organization missing")
  check(
    nabaperks?.parentOrganization?.["@id"] === operator?.["@id"],
    "sign-up: parentOrganization does not reference Lapen Inns"
  )
  check(
    operator?.location === undefined,
    "sign-up: operator must not expose unsupported estate locations"
  )
  check(
    !/companieshouse|company-information|linkedin\.com\/in/i.test(
      JSON.stringify(operator?.sameAs ?? [])
    ),
    "sign-up: operator sameAs contains a banned URL"
  )

  const guidePaths = [
    "/guides/reward-regulars-without-an-app",
    "/guides/best-loyalty-ideas-for-pubs",
    "/guides/paper-vs-qr-loyalty-for-pubs",
  ]
  const [homePage, howItWorksPage, pricingPage, personaPage, ...guidePages] =
    await Promise.all([
      fetchPage(baseUrl, "/"),
      fetchPage(baseUrl, "/how-it-works"),
      fetchPage(baseUrl, "/pricing"),
      fetchPage(baseUrl, "/loyalty-for-pubs"),
      ...guidePaths.map((path) => fetchPage(baseUrl, path)),
    ])

  const homeNodes = homePage.nodes
  const homeTypes = new Set(
    homeNodes.map((node) => node["@type"]).filter(Boolean)
  )

  check(homeTypes.has("WebPage"), "home: WebPage node missing")
  check(homeTypes.has("Organization"), "home: Organization node missing")
  check(
    !JSON.stringify(homeNodes).includes('"@type":"Person"'),
    "home: Person node present"
  )
  checkCanonicalGraph(homePage, "/", "home")
  checkProductOffers(homePage, "home")

  checkCanonicalGraph(howItWorksPage, "/how-it-works", "how-it-works")
  checkBreadcrumb(howItWorksPage, "/how-it-works", "how-it-works")
  checkHowToParity(howItWorksPage, "how-it-works")
  checkFaqParity(howItWorksPage, "how-it-works", 9)

  checkCanonicalGraph(pricingPage, "/pricing", "pricing")
  checkBreadcrumb(pricingPage, "/pricing", "pricing")
  checkProductOffers(pricingPage, "pricing")
  checkFaqParity(pricingPage, "pricing", 5)

  checkCanonicalGraph(personaPage, "/loyalty-for-pubs", "loyalty-for-pubs")
  checkBreadcrumb(personaPage, "/loyalty-for-pubs", "loyalty-for-pubs")

  for (const [index, path] of guidePaths.entries()) {
    const label = path.slice(1)
    const page = guidePages[index]
    checkCanonicalGraph(page, path, label)
    checkBreadcrumb(page, path, label)
    checkArticle(page, path, label)
  }

  if (failures.length) {
    console.error(`✗ ${failures.length} JSON-LD check(s) failed:\n`)
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exitCode = 1
  } else {
    console.log(
      "✓ JSON-LD valid: shared organisations; canonical WebPage/Breadcrumb graphs; visible Product offers and FAQ/HowTo copy; pub persona; and three guide Article graphs"
    )
  }
} finally {
  await stopNextStart()
}
