import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"
import { renderToStaticMarkup } from "react-dom/server"

/**
 * QA BUG-042 (38c42a1..2c45031): with Supabase unreachable the join page
 * waited about 7 seconds (the PostgREST client retries a failed read three
 * times) and then said "This loyalty card is unavailable. Ask a team member
 * for the current loyalty QR." Nothing was wrong with the card or the QR.
 *
 * The join page is rendered with its real loader (`load-join.ts`) and the
 * real experience derivation; only the join-context read, the session and
 * cookie lookups, the funnel capture and the wizard are stubbed. The wizard
 * stub prints the experience it is handed.
 */
const STUBS = {
  "server-only": "",
  "next/headers": `export async function headers() {
    return new Headers({ "x-request-id": "req-join-0123456789" })
  }
  export async function cookies() { return { get() {}, set() {}, delete() {} } }`,
  "next/navigation": `export function redirect(destination) {
    const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error
  }`,
  "@/lib/customer/join": `export async function getMerchantJoinContext(...args) { return globalThis.__join.context(...args) }
    export async function getMembershipForCustomer() { return null }`,
  "@/lib/customer/identity":
    "export async function getCurrentCustomer() { return null }",
  "@/lib/customer/email-sign-in": `export async function readVerifiedEmailHandoff() { return null }
    export async function getPendingEmailSignIn() { return null }`,
  "@/lib/customer/email-fallback":
    "export async function emailFallbackOpenedFor() { return false }",
  "@/lib/customer/session":
    "export async function getPendingPhoneVerification() { return null }",
  "@/lib/customer/stamp":
    "export async function getMerchantStampLocationRequirement() { return { requireGeofence: false, geofenceRadiusMeters: 150 } }",
  "@/lib/customer/pending-join-offer":
    "export async function loadPendingJoinOffer() { return null }",
  "@/lib/customer/join-funnel": `export async function captureJoinFunnelEvent(event) { globalThis.__join.funnel.push(event.eventName) }`,
  "@/components/customer/join-wizard": `import { jsx } from "react/jsx-runtime"
    export function JoinWizard({ experience }) {
      return jsx("p", { children: "wizard:" + experience.kind + ":" + (experience.reason ?? "") })
    }`,
  "@/lib/observability/logger": `export const logger = {
    error(event, fields) { globalThis.__join.logs.push({ event, ...fields }) },
    warn() {}, info() {},
  }`,
}

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
const STUB_FILTER = new RegExp(
  `^(${Object.keys(STUBS).map(escape).join("|")})$`
)

async function loadPage() {
  const result = await build({
    entryPoints: ["app/m/[merchantSlug]/join/page.tsx"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    external: [
      "react",
      "react-dom",
      "next/link",
      "next/image",
      "motion",
      "motion/*",
    ],
    logLevel: "silent",
    plugins: [
      {
        name: "join-page-boundaries",
        setup(build) {
          build.onResolve({ filter: STUB_FILTER }, ({ path }) => ({
            path,
            namespace: "stub",
          }))
          build.onLoad({ filter: /.*/, namespace: "stub" }, ({ path }) => ({
            contents: STUBS[path],
            loader: "js",
            resolveDir: process.cwd(),
          }))
        },
      },
    ],
  })
  const compiled = { exports: {} }
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    createRequire(import.meta.url),
    compiled,
    compiled.exports
  )
  return compiled.exports.default
}

const JoinPage = await loadPage()

async function openJoin(context) {
  globalThis.__join = { context, logs: [], funnel: [] }
  const started = Date.now()
  const element = await JoinPage({
    params: Promise.resolve({ merchantSlug: "old-crown" }),
    searchParams: Promise.resolve({ qr: "old-crown-bar" }),
  })
  const html = renderToStaticMarkup(element)
  return {
    ms: Date.now() - started,
    html,
    text: html
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/\s+/g, " "),
    logs: globalThis.__join.logs,
    funnel: globalThis.__join.funnel,
  }
}

test("Given the database is unreachable When the join page loads Then it asks for a retry instead of calling the card unavailable", async () => {
  const page = await openJoin(async () => {
    throw new TypeError("fetch failed")
  })

  assert.doesNotMatch(page.text, /loyalty card is unavailable/i)
  assert.doesNotMatch(page.text, /wizard:unavailable/)
  assert.doesNotMatch(page.text, /current loyalty QR/)
  assert.match(page.text, /We can't load this right now/)
  assert.match(
    page.text,
    /Your cards and stamps are safe\. Try again in a moment\./
  )
  assert.match(page.html, /href="\/m\/old-crown\/join\?qr=old-crown-bar"/)
  assert.deepEqual(page.logs, [
    {
      event: "customer_join_context_failed",
      requestId: "req-join-0123456789",
      operation: "join_context_load",
      reason: "database_unavailable",
    },
  ])
  assert.deepEqual(page.funnel, [], "no join step was shown")
})

test(
  "Given the join context read hangs When the join page loads Then it answers with the retry state within its time budget",
  { timeout: 10_000 },
  async () => {
    const page = await openJoin(() => new Promise(() => {}))

    assert.ok(page.ms < 5_000, `answered after ${page.ms} ms`)
    assert.match(page.text, /We can't load this right now/)
    assert.equal(page.logs[0]?.reason, "timeout")
  }
)

test("Given an unknown or inactive venue When the join page loads Then it is still reported as unavailable", async () => {
  const page = await openJoin(async () => null)

  assert.match(
    page.text,
    /wizard:unavailable:This loyalty card is unavailable\./
  )
  assert.doesNotMatch(page.text, /We can't load this right now/)
  assert.deepEqual(page.logs, [])
})
