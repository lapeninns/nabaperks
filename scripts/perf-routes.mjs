#!/usr/bin/env node
import { performance } from "node:perf_hooks"

const DEFAULT_ROUTES = ["/", "/pricing", "/start", "/app", "/q/demo", "/m/demo"]
const DEFAULT_RUNS = 3
const DEFAULT_TIMEOUT_MS = 5000

const helpText = `Usage: pnpm perf:routes -- [options]

Measures median TTFB for key Nabaperks read routes. Requests follow no redirects,
so auth redirects and missing seeded QR/merchant slugs are reported as statuses.

Options:
  --base-url <url>      Base URL to measure (default: http://127.0.0.1:3000)
  --routes <list>       Comma-separated routes (default: ${DEFAULT_ROUTES.join(",")})
  --runs <count>        Measured requests per route after one warm request (default: ${DEFAULT_RUNS})
  --timeout-ms <ms>     Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})
  -h, --help            Show this help

Examples:
  pnpm perf:routes -- --base-url http://127.0.0.1:3000
  pnpm perf:routes -- --base-url https://example.com --routes /,/pricing,/app
`

class UsageError extends Error {
  constructor(message) {
    super(message)
    this.name = "UsageError"
  }
}

async function main(argv) {
  const options = parseArgs(argv)

  if (options.help) {
    console.log(helpText)
    return
  }

  console.log(
    `base_url=${options.baseUrl} runs=${options.runs} timeout_ms=${options.timeoutMs}`
  )
  printHeader()

  let hadFailure = false

  for (const route of options.routes) {
    const url = toRouteUrl(options.baseUrl, route)
    await measureOnce(url, options.timeoutMs)

    const samples = []
    for (let index = 0; index < options.runs; index += 1) {
      samples.push(await measureOnce(url, options.timeoutMs))
    }

    if (samples.some((sample) => sample.kind === "error")) {
      hadFailure = true
    }

    printRouteResult(route, samples)
  }

  if (hadFailure) {
    process.exitCode = 1
  }
}

function parseArgs(argv) {
  const options = {
    baseUrl: "http://127.0.0.1:3000",
    routes: DEFAULT_ROUTES,
    runs: DEFAULT_RUNS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--") {
      continue
    }

    if (arg === "-h" || arg === "--help") {
      return { ...options, help: true }
    }

    if (arg === "--base-url") {
      options.baseUrl = readValue(argv, index, arg)
      index += 1
      continue
    }

    if (arg === "--routes") {
      options.routes = parseRoutes(readValue(argv, index, arg))
      index += 1
      continue
    }

    if (arg === "--runs") {
      options.runs = parsePositiveInteger(readValue(argv, index, arg), arg)
      index += 1
      continue
    }

    if (arg === "--timeout-ms") {
      options.timeoutMs = parsePositiveInteger(readValue(argv, index, arg), arg)
      index += 1
      continue
    }

    throw new UsageError(`Unknown option: ${arg}`)
  }

  return {
    ...options,
    baseUrl: normalizeBaseUrl(options.baseUrl),
  }
}

function readValue(argv, index, optionName) {
  const value = argv[index + 1]

  if (!value || value.startsWith("-")) {
    throw new UsageError(`${optionName} requires a value`)
  }

  return value
}

function parseRoutes(value) {
  const routes = value
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean)

  if (routes.length === 0) {
    throw new UsageError("--routes requires at least one route")
  }

  return routes
}

function parsePositiveInteger(value, optionName) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new UsageError(`${optionName} must be a positive integer`)
  }

  return parsed
}

function normalizeBaseUrl(value) {
  try {
    const url = new URL(value)
    return url.toString().replace(/\/$/, "")
  } catch (error) {
    if (error instanceof TypeError) {
      throw new UsageError(`--base-url must be a valid URL: ${value}`)
    }

    throw error
  }
}

function toRouteUrl(baseUrl, route) {
  return new URL(route, `${baseUrl}/`).toString()
}

async function measureOnce(url, timeoutMs) {
  const startedAt = performance.now()

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": "NabaperksPerfRoutes/1.0",
      },
    })
    const ttfbMs = performance.now() - startedAt
    const cancelBody = response.body?.cancel()
    cancelBody?.catch(() => undefined)

    return {
      kind: "response",
      status: response.status,
      location: response.headers.get("location"),
      ttfbMs,
    }
  } catch (error) {
    return {
      kind: "error",
      error: formatError(error),
      ttfbMs: performance.now() - startedAt,
    }
  }
}

function printHeader() {
  console.log(
    `${pad("route", 18)} ${pad("status", 24)} ${pad("median_ttfb", 13)} samples`
  )
}

function printRouteResult(route, samples) {
  const successfulSamples = samples.filter(
    (sample) => sample.kind === "response"
  )
  const median = medianTtfb(successfulSamples)
  const status = statusLabel(samples)
  const sampleText = samples.map(sampleLabel).join(", ")

  console.log(
    `${pad(route, 18)} ${pad(status, 24)} ${pad(median, 13)} ${sampleText}`
  )
}

function medianTtfb(samples) {
  if (samples.length === 0) {
    return "-"
  }

  const sorted = samples.map((sample) => sample.ttfbMs).sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 1) {
    return `${roundMs(sorted[middle])}ms`
  }

  return `${roundMs((sorted[middle - 1] + sorted[middle]) / 2)}ms`
}

function statusLabel(samples) {
  const response = samples.find((sample) => sample.kind === "response")

  if (!response) {
    return "ERROR"
  }

  if (response.status >= 300 && response.status < 400 && response.location) {
    return `${response.status} -> ${response.location}`
  }

  return String(response.status)
}

function sampleLabel(sample) {
  if (sample.kind === "error") {
    return `error:${sample.error}`
  }

  return `${sample.status}:${roundMs(sample.ttfbMs)}ms`
}

function roundMs(ms) {
  return Math.round(ms * 10) / 10
}

function pad(value, width) {
  const text = String(value)

  if (text.length >= width) {
    return text
  }

  return `${text}${" ".repeat(width - text.length)}`
}

function formatError(error) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") {
      return "timeout"
    }

    return error.message.replace(/\s+/g, " ")
  }

  return String(error)
}

main(process.argv.slice(2)).catch((error) => {
  if (error instanceof UsageError) {
    console.error(error.message)
    console.error("Run with --help for usage.")
    process.exitCode = 2
    return
  }

  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
