/**
 * Stress-data performance probe for local dev.
 *
 * Benchmarks the same Supabase reads the merchant app uses, then (when the dev
 * server is up) measures authenticated page loads via Playwright.
 *
 * Usage:
 *   pnpm perf:stress
 *   PERF_STRESS_RUNS=5 pnpm perf:stress
 *   node scripts/perf-stress.mjs --browser-only --app-url http://127.0.0.1:3000
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { performance } from "node:perf_hooks"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "@playwright/test"
import postgres from "postgres"

import {
  isDatabaseConnectionRefused,
  printDatabaseConnectionHelp,
} from "./db-connection-help.mjs"

// allow: SIZE_OK — this task owns one executable harness and cannot add production modules.
const projectDir = process.cwd()
const MERCHANT_ID = "10000000-0000-0000-0000-000000000001"
const MERCHANT_EMAIL = "amanshresthaaaaa+32@gmail.com"
const MERCHANT_PASSWORD = "NabaperksDemo1!"
const CUSTOMERS_PAGE_SIZE = 15
const DEFAULT_QUERY_MEDIAN_BUDGET_MS = 1_000
const DEFAULT_BROWSER_MEDIAN_BUDGET_MS = 5_000
const DEFAULT_RESOURCE_COUNT_BUDGET = 200
const DEFAULT_TRANSFER_BYTES_BUDGET = 5_000_000
const options = parseCliSafely(process.argv.slice(2), process.env)
const RUNS = options?.runs ?? 0
const APP_URL = options?.appUrl ?? ""

const env = {
  ...readEnvFile(join(projectDir, ".env.local")),
  ...readEnvFile(join(projectDir, ".env")),
  ...process.env,
}

async function main() {
  console.log(`Stress performance probe (${RUNS} run(s) per benchmark)\n`)

  if (options.browserOnly) {
    await runAndReportBrowserBenchmarks()
    return
  }

  const dbUrl = env.SUPABASE_DB_URL?.trim()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!dbUrl || !supabaseUrl || !anonKey) {
    console.error(
      "SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL, and NEXT_PUBLIC_SUPABASE_ANON_KEY are required."
    )
    process.exit(1)
  }

  const sql = postgres(dbUrl, { max: 1 })
  try {
    await verifyStressFixture(sql)
  } catch (error) {
    if (isDatabaseConnectionRefused(error)) {
      printDatabaseConnectionHelp(
        dbUrl,
        "pnpm db:supabase:start && pnpm db:reseed:stress"
      )
    }
    throw error
  } finally {
    await sql.end({ timeout: 5 })
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: signInError } = await authClient.auth.signInWithPassword({
    email: MERCHANT_EMAIL,
    password: MERCHANT_PASSWORD,
  })
  if (signInError) {
    throw new Error(`Merchant sign-in failed: ${signInError.message}`)
  }

  const queryResults = await runQueryBenchmarks(authClient)
  printResults("Supabase query benchmarks (RLS as +32)", queryResults)
  enforceTimingBudget(
    "Supabase query",
    queryResults,
    options.queryMedianBudgetMs
  )

  await runAndReportBrowserBenchmarks()
}

async function verifyStressFixture(sql) {
  const [row] = await sql`
    select
      m.business_name,
      u.email as owner_email,
      (select count(*)::int from customer_memberships cm where cm.merchant_id = m.id) as members,
      (select count(*)::int from product_events pe where pe.merchant_id = m.id) as events
    from merchants m
    join auth.users u on u.id = m.owner_user_id
    where m.id = ${MERCHANT_ID}
  `

  if (!row) {
    throw new Error(
      "Old Crown Girton merchant fixture not found. Run pnpm db:setup first."
    )
  }

  if (row.owner_email !== MERCHANT_EMAIL) {
    throw new Error(
      `Expected ${MERCHANT_EMAIL} to own Old Crown Girton (found ${row.owner_email}). Run seed-user-aman-plus32.sql.`
    )
  }

  if (row.members < 1000) {
    throw new Error(
      `Only ${row.members} members found. Run pnpm db:reseed:stress before perf:stress.`
    )
  }

  console.log(
    `Fixture: ${row.business_name} · owner ${row.owner_email} · ${row.members.toLocaleString()} members · ${row.events.toLocaleString()} product events\n`
  )
}

async function runQueryBenchmarks(client) {
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  return [
    await bench("Member count (exact)", RUNS, async () => {
      const { count, error } = await client
        .from("customer_memberships")
        .select("*", { count: "exact", head: true })
        .eq("merchant_id", MERCHANT_ID)
      if (error) throw error
      if ((count ?? 0) < 1000)
        throw new Error(`Unexpected member count: ${count}`)
      return count
    }),
    await bench("Members page 1 (15 rows)", RUNS, async () => {
      const { data, error } = await client
        .from("customer_memberships")
        .select(
          "id, customer_id, current_stamp_count, total_stamps_earned, total_rewards_redeemed, last_visit_at, created_at"
        )
        .eq("merchant_id", MERCHANT_ID)
        .order("created_at", { ascending: false })
        .range(0, CUSTOMERS_PAGE_SIZE - 1)
      if (error) throw error
      return data?.length ?? 0
    }),
    await bench("Members page 100 (offset 1485)", RUNS, async () => {
      const offset = (100 - 1) * CUSTOMERS_PAGE_SIZE
      const { data, error } = await client
        .from("customer_memberships")
        .select("id, created_at")
        .eq("merchant_id", MERCHANT_ID)
        .order("created_at", { ascending: false })
        .range(offset, offset + CUSTOMERS_PAGE_SIZE - 1)
      if (error) throw error
      return data?.length ?? 0
    }),
    await bench("Members page 667 (last page)", RUNS, async () => {
      const offset = (667 - 1) * CUSTOMERS_PAGE_SIZE
      const { data, error } = await client
        .from("customer_memberships")
        .select("id, created_at")
        .eq("merchant_id", MERCHANT_ID)
        .order("created_at", { ascending: false })
        .range(offset, offset + CUSTOMERS_PAGE_SIZE - 1)
      if (error) throw error
      return data?.length ?? 0
    }),
    await bench("Dashboard 7d join rows", RUNS, async () => {
      const { data, error } = await client
        .from("customer_memberships")
        .select("created_at")
        .eq("merchant_id", MERCHANT_ID)
        .gte("created_at", sinceIso)
      if (error) throw error
      return data?.length ?? 0
    }),
    await bench("Dashboard 7d stamp rows", RUNS, async () => {
      const { data, error } = await client
        .from("stamp_events")
        .select("created_at")
        .eq("merchant_id", MERCHANT_ID)
        .eq("event_type", "earned")
        .gte("created_at", sinceIso)
      if (error) throw error
      return data?.length ?? 0
    }),
    await bench("Activity feed (40 events)", RUNS, async () => {
      const { data, error } = await client
        .from("product_events")
        .select("id, event_name, created_at")
        .eq("merchant_id", MERCHANT_ID)
        .order("created_at", { ascending: false })
        .limit(40)
      if (error) throw error
      return data?.length ?? 0
    }),
    await bench("Push marketing prefs count", RUNS, async () => {
      const { count, error } = await client
        .from("notification_preferences")
        .select("*", { count: "exact", head: true })
        .eq("marketing_enabled", true)
      if (error) throw error
      return count ?? 0
    }),
  ]
}

async function runAndReportBrowserBenchmarks() {
  const { readiness, journeys } = await runBrowserBenchmarks()
  console.log(
    `HTTP readiness probe: status=${readiness.status} duration=${readiness.duration.toFixed(1)}ms`
  )
  printResults(`Authenticated browser journeys (${APP_URL})`, journeys)
  printResourceResults(journeys)
  enforceTimingBudget(
    "Browser journey",
    journeys,
    options.browserMedianBudgetMs
  )
  enforceResourceBudgets(journeys)
  console.log("Performance budgets: PASS\n")
}

async function runBrowserBenchmarks() {
  const readiness = await measureAppReadiness()
  if (!readiness.ok) {
    throw new Error(
      `Application readiness check failed for ${APP_URL}/login: ${readiness.reason}. Start the app with: pnpm dev`
    )
  }

  let browser
  try {
    browser = await chromium.launch({ headless: true, timeout: 30_000 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("Executable doesn't exist")) {
      throw new Error(
        "Playwright browser executable is required. Run: pnpm e2e:install"
      )
    }
    throw error
  }

  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${APP_URL}/login?next=${encodeURIComponent("/app")}`, {
      waitUntil: "domcontentloaded",
    })
    await page.locator("#email").fill(MERCHANT_EMAIL)
    await page.locator("#password").fill(MERCHANT_PASSWORD)
    await page.getByRole("button", { name: "Log in" }).click()
    await page.waitForURL((url) => url.pathname === "/app", { timeout: 30_000 })

    const routes = [
      {
        name: "Dashboard /app",
        path: "/app",
        ready: /Your venue|Old Crown Girton/i,
      },
      {
        name: "Members /app/customers",
        path: "/app/customers",
        ready: /Loyalty members/i,
      },
      {
        name: "Members page 100",
        path: "/app/customers?page=100",
        ready: /Loyalty members/i,
      },
      {
        name: "Activity /app/activity",
        path: "/app/activity",
        ready: /Activity/i,
      },
      {
        name: "Announcements /app/announcements",
        path: "/app/announcements",
        ready: /Announce/i,
      },
    ]

    const journeys = []
    for (const route of routes) {
      journeys.push(await benchmarkBrowserJourney(page, route))
    }

    return { readiness, journeys }
  } finally {
    await browser.close()
  }
}

async function benchmarkBrowserJourney(page, route) {
  const samples = []
  const resources = []
  for (let index = 0; index < RUNS; index += 1) {
    const started = performance.now()
    await page.goto(`${APP_URL}${route.path}`, {
      waitUntil: "domcontentloaded",
    })
    await page.getByText(route.ready).first().waitFor({ timeout: 30_000 })
    samples.push(performance.now() - started)
    resources.push(
      await page.evaluate(() => {
        const entries = performance.getEntriesByType("resource")
        return {
          requestCount: entries.length,
          transferBytes: entries.reduce(
            (sum, entry) => sum + entry.transferSize,
            0
          ),
        }
      })
    )
  }

  return {
    ...summarize(
      route.name,
      samples,
      "browser navigation + ready-content wait"
    ),
    resourceRequests: Math.max(
      ...resources.map((sample) => sample.requestCount)
    ),
    transferBytes: Math.max(...resources.map((sample) => sample.transferBytes)),
  }
}

async function measureAppReadiness() {
  const started = performance.now()
  try {
    const response = await fetch(`${APP_URL}/login`, {
      signal: AbortSignal.timeout(3000),
    })
    return {
      ok: response.ok,
      status: response.status,
      duration: performance.now() - started,
      reason: response.ok ? "ok" : `HTTP ${response.status}`,
    }
  } catch (error) {
    return {
      ok: false,
      status: "unreachable",
      duration: performance.now() - started,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

async function bench(label, runs, fn) {
  const samples = []
  let note = ""

  for (let index = 0; index < runs; index += 1) {
    const started = performance.now()
    const result = await fn()
    samples.push(performance.now() - started)
    if (index === 0 && result !== undefined && result !== null) {
      note = typeof result === "number" ? `rows=${result}` : String(result)
    }
  }

  return summarize(label, samples, note)
}

function summarize(label, samples, note) {
  const sorted = [...samples].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  return {
    label,
    median: round(median),
    mean: round(mean),
    min: round(min),
    max: round(max),
    runs: sorted.length,
    note,
  }
}

function printResults(title, rows) {
  console.log(title)
  console.log("-".repeat(title.length))
  const header = `${"Benchmark".padEnd(34)} ${"median".padStart(8)} ${"mean".padStart(8)} ${"min".padStart(8)} ${"max".padStart(8)}  note`
  console.log(header)
  console.log("-".repeat(header.length))
  for (const row of rows) {
    console.log(
      `${row.label.padEnd(34)} ${fmtMs(row.median)} ${fmtMs(row.mean)} ${fmtMs(row.min)} ${fmtMs(row.max)}  ${row.note}`
    )
  }
  console.log("")
}

function printResourceResults(rows) {
  console.log("Resource usage (maximum observed per journey)")
  console.log("---------------------------------------------")
  for (const row of rows) {
    console.log(
      `${row.label}: requests=${row.resourceRequests} transfer=${row.transferBytes} bytes`
    )
  }
  console.log("")
}

function enforceTimingBudget(kind, rows, budgetMs) {
  const failures = rows.filter((row) => row.median > budgetMs)
  if (failures.length > 0) {
    throw new Error(
      `Performance budget exceeded: ${kind} median must be <= ${budgetMs}ms; ${failures
        .map((row) => `${row.label}=${row.median}ms`)
        .join(", ")}`
    )
  }
}

function enforceResourceBudgets(rows) {
  const failures = rows.flatMap((row) => {
    const violations = []
    if (row.resourceRequests > options.resourceCountBudget) {
      violations.push(
        `${row.label} requests=${row.resourceRequests} > ${options.resourceCountBudget}`
      )
    }
    if (row.transferBytes > options.transferBytesBudget) {
      violations.push(
        `${row.label} transfer=${row.transferBytes} > ${options.transferBytesBudget} bytes`
      )
    }
    return violations
  })
  if (failures.length > 0) {
    throw new Error(`Performance budget exceeded: ${failures.join(", ")}`)
  }
}

function fmtMs(value) {
  return `${value.toFixed(1)}ms`.padStart(8)
}

function round(value) {
  return Math.round(value * 10) / 10
}

function parseCli(args, environment) {
  let browserOnly = false
  let appUrl = environment.PERF_STRESS_APP_URL ?? "http://localhost:3000"
  let runsValue = environment.PERF_STRESS_RUNS ?? "3"

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--browser-only") {
      browserOnly = true
    } else if (argument === "--app-url") {
      appUrl = requireOptionValue(args, ++index, "--app-url")
    } else if (argument === "--runs") {
      runsValue = requireOptionValue(args, ++index, "--runs")
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }

  const runs = parsePositiveInteger(runsValue, "--runs")
  let parsedAppUrl
  try {
    parsedAppUrl = new URL(appUrl)
  } catch {
    throw new Error("--app-url must be a valid http or https URL")
  }
  if (!["http:", "https:"].includes(parsedAppUrl.protocol)) {
    throw new Error("--app-url must be a valid http or https URL")
  }
  if (parsedAppUrl.username || parsedAppUrl.password) {
    throw new Error("--app-url must not contain credentials")
  }

  return {
    browserOnly,
    appUrl: parsedAppUrl.href.replace(/\/$/, ""),
    runs,
    queryMedianBudgetMs: parseNonNegativeNumber(
      environment.PERF_STRESS_QUERY_MEDIAN_BUDGET_MS ??
        DEFAULT_QUERY_MEDIAN_BUDGET_MS,
      "PERF_STRESS_QUERY_MEDIAN_BUDGET_MS"
    ),
    browserMedianBudgetMs: parseNonNegativeNumber(
      environment.PERF_STRESS_BROWSER_MEDIAN_BUDGET_MS ??
        DEFAULT_BROWSER_MEDIAN_BUDGET_MS,
      "PERF_STRESS_BROWSER_MEDIAN_BUDGET_MS"
    ),
    resourceCountBudget: parseNonNegativeNumber(
      environment.PERF_STRESS_RESOURCE_COUNT_BUDGET ??
        DEFAULT_RESOURCE_COUNT_BUDGET,
      "PERF_STRESS_RESOURCE_COUNT_BUDGET"
    ),
    transferBytesBudget: parseNonNegativeNumber(
      environment.PERF_STRESS_TRANSFER_BYTES_BUDGET ??
        DEFAULT_TRANSFER_BYTES_BUDGET,
      "PERF_STRESS_TRANSFER_BYTES_BUDGET"
    ),
  }
}

function parseCliSafely(args, environment) {
  try {
    return parseCli(args, environment)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
    return null
  }
}

function requireOptionValue(args, index, name) {
  const value = args[index]
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`)
  }
  return value
}

function parsePositiveInteger(value, name) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
  return Number(value)
}

function parseNonNegativeNumber(value, name) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number`)
  }
  return parsed
}

function readEnvFile(path) {
  if (!existsSync(path)) return {}

  const parsed = {}
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const equalsIndex = trimmed.indexOf("=")
    if (equalsIndex === -1) continue
    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    parsed[key] = value
  }
  return parsed
}

if (options) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
