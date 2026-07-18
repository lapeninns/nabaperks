#!/usr/bin/env node
/**
 * Validate the shared organisation JSON-LD graph on a surviving public route.
 * Run after `pnpm build`; the checker starts the production server, fetches the
 * merchant sign-up page and exits non-zero when the graph drifts.
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

try {
  const { html } = await startProductionServer()
  const nodes = extractNodes(html)
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
    Array.isArray(operator?.location) && operator.location.length === 9,
    "sign-up: operator should expose nine estate locations"
  )
  check(
    !/companieshouse|company-information|linkedin\.com\/in/i.test(
      JSON.stringify(operator?.sameAs ?? [])
    ),
    "sign-up: operator sameAs contains a banned URL"
  )

  if (failures.length) {
    console.error(`✗ ${failures.length} JSON-LD check(s) failed:\n`)
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exitCode = 1
  } else {
    console.log(
      "✓ shared JSON-LD graph valid on sign-up: connected organisations, WebSite, no Person or banned sameAs"
    )
  }
} finally {
  await stopNextStart()
}
