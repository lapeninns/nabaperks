import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { afterEach, test } from "node:test"

import { CUSTOMER_LEGAL_VERSION } from "@/lib/legal/content"
import { readCustomerLegalVersion } from "../../scripts/check-staging-release.mjs"

// QA BUG-006 (38c42a1..2c45031): a build that records CUSTOMER_LEGAL_VERSION
// on a database without that version's snapshot trigger stores the older
// built-in snapshot on every join. Readiness must report it (and BUG-016: a
// missing email HMAC secret while email sign-in is on).

// The route imports package.json and the SLO config as Next.js does, without
// an import attribute; give JSON modules the attribute Node requires.
registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".json")) {
      return nextLoad(url, {
        ...context,
        importAttributes: { ...context.importAttributes, type: "json" },
      })
    }
    return nextLoad(url, context)
  },
})

const MONITOR_SECRET = "monitor-test-secret"
const SUPABASE_URL = "https://project.supabase.co"
const ENV_KEYS = [
  "PRODUCTION_MONITOR_SECRET",
  "PRODUCTION_MONITOR_SECRET_NEXT",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VERCEL_ENV",
  "VERCEL_TARGET_ENV",
  "STAGING_MODE",
  "CUSTOMER_EMAIL_AUTH_MODE",
  "CUSTOMER_EMAIL_HMAC_SECRET",
]
const savedEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
)
const realFetch = globalThis.fetch

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
  globalThis.fetch = realFetch
})

function healthySignals() {
  return {
    notificationQueueAgeMinutes: 0,
    loyaltyInviteQueueAgeMinutes: 0,
    providerDeliveryAttempts24h: 0,
    providerDeliveryFailures24h: 0,
    providerDeliveryFailureRate24h: 0,
    cronJobs: [
      "notifications",
      "privacy-retention",
      "merchant-digest",
      "birthday-rewards",
      "referral-bonus-drain",
      "loyalty-invite-drain",
      "billing-trial-sync",
      "qr-status-email-drain",
    ].map((name) => ({
      name,
      state: "ok",
      consecutiveFailures: 0,
      lastCompletedAt: "2026-09-30T00:00:00.000Z",
    })),
  }
}

async function readiness({ snapshotInstalled, env = {} }) {
  Object.assign(process.env, {
    PRODUCTION_MONITOR_SECRET: MONITOR_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    VERCEL_ENV: "preview",
    VERCEL_TARGET_ENV: "staging",
    CUSTOMER_EMAIL_AUTH_MODE: "off",
    ...env,
  })
  delete process.env.PRODUCTION_MONITOR_SECRET_NEXT
  delete process.env.STAGING_MODE
  const calls = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, body: init?.body })
    if (url.endsWith("/rpc/production_readiness_probe")) {
      return new Response("[]", { status: 200 })
    }
    if (url.endsWith("/rpc/production_operational_signals_v2")) {
      return Response.json(healthySignals())
    }
    if (url.endsWith("/rpc/customer_legal_terms_snapshot_installed")) {
      return snapshotInstalled === "absent"
        ? new Response("{}", { status: 404 })
        : Response.json(snapshotInstalled)
    }
    throw new Error(`unexpected fetch ${url}`)
  }

  const { GET } = await import("../../app/api/readiness/route.ts")
  const response = await GET(
    new Request("https://example.test/api/readiness", {
      headers: { authorization: `Bearer ${MONITOR_SECRET}` },
    })
  )
  return { response, body: await response.json(), calls }
}

test("readiness is ready when the snapshot trigger for the build's terms version is installed", async () => {
  const { response, body, calls } = await readiness({ snapshotInstalled: true })

  assert.equal(response.status, 200)
  assert.equal(body.status, "ready")
  assert.equal(body.checks.legalTerms, "ok")
  const probe = calls.find((call) =>
    call.url.endsWith("/rpc/customer_legal_terms_snapshot_installed")
  )
  assert.deepEqual(JSON.parse(probe.body), {
    p_version: CUSTOMER_LEGAL_VERSION,
  })
})

test("readiness is not ready when the database lacks the build's terms snapshot", async () => {
  const { response, body } = await readiness({ snapshotInstalled: false })

  assert.equal(response.status, 503)
  assert.equal(body.status, "not_ready")
  assert.equal(body.checks.database, "ok")
  assert.equal(body.checks.operational, "ok")
  assert.equal(body.checks.legalTerms, "snapshot_missing")
})

test("readiness fails closed when the snapshot probe itself is missing", async () => {
  const { response, body } = await readiness({ snapshotInstalled: "absent" })

  assert.equal(response.status, 503)
  assert.equal(body.checks.legalTerms, "error")
})

test("readiness reports email sign-in without its HMAC secret", async () => {
  for (const mode of ["existing", "full"]) {
    const { response, body } = await readiness({
      snapshotInstalled: true,
      env: { CUSTOMER_EMAIL_AUTH_MODE: mode, CUSTOMER_EMAIL_HMAC_SECRET: " " },
    })
    assert.equal(response.status, 503, mode)
    assert.equal(body.checks.configuration, "customer_email_hmac_missing")
    assert.equal(JSON.stringify(body).includes("service-role"), false)
  }

  const off = await readiness({
    snapshotInstalled: true,
    env: { CUSTOMER_EMAIL_AUTH_MODE: "off", CUSTOMER_EMAIL_HMAC_SECRET: "" },
  })
  assert.equal(off.response.status, 200)
  assert.equal(off.body.checks.configuration, "ok")

  const configured = await readiness({
    snapshotInstalled: true,
    env: {
      CUSTOMER_EMAIL_AUTH_MODE: "full",
      CUSTOMER_EMAIL_HMAC_SECRET: "x".repeat(32),
    },
  })
  assert.equal(configured.response.status, 200)
  assert.equal(configured.body.checks.configuration, "ok")
})

test("the staging proof reads the same terms version the build records", () => {
  assert.equal(readCustomerLegalVersion(), CUSTOMER_LEGAL_VERSION)
  assert.throws(() => readCustomerLegalVersion('export const OTHER = "x"\n'))
})
