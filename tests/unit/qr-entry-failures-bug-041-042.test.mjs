import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"
import { renderToStaticMarkup } from "react-dom/server"

/**
 * QA BUG-041 / BUG-042 (38c42a1..2c45031): the venue QR page (`/q/[qrId]`)
 * caught every failure that was not a rate limit and rendered "This loyalty
 * card is unavailable", without logging anything:
 *
 *  - a signed-in member whose membership lookup failed was told the card was
 *    unavailable instead of carrying on to the join flow (which re-reads the
 *    membership and sends a member to the stamp screen);
 *  - a scan that could not be resolved because the database was unreachable
 *    blamed the QR instead of asking for a retry.
 *
 * The page is rendered for real; only the QR resolver, the membership lookup,
 * the stamp loader, the logger and request headers are stubbed.
 */
const STUBS = {
  "server-only": "",
  "next/headers": `export async function headers() {
    return new Headers({ "x-request-id": "req-0123456789abcdef", "x-forwarded-for": "198.51.100.9" })
  }`,
  "next/navigation": `export function redirect(destination) {
    const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error
  }
  export function useRouter() { return { refresh() {}, push() {}, replace() {} } }
  export function usePathname() { return "/" }
  export function useSearchParams() { return new URLSearchParams() }`,
  "@/lib/security/rate-limit": `export class RateLimitError extends Error {}
    export function customerRateLimitIdentityFromHeaders() { return "identity" }`,
  "@/lib/customer/join": `export async function resolveQrForJoin(...args) { return globalThis.__qr.resolve(...args) }
    export async function getExistingMembershipForCurrentUser(...args) { return globalThis.__qr.membership(...args) }`,
  "@/lib/customer/experience/load-stamp": `export async function loadStampExperienceContext() { return globalThis.__qr.stampContext() }`,
  // The member branch (stamp screen) is not rendered by these cases.
  "@/components/customer/customer-card-experience":
    "export function CustomerCardExperience() { return null }",
  "@/components/customer/canonical-url":
    "export function CanonicalUrl() { return null }",
  "@/lib/customer/experience/derive":
    "export function deriveCustomerExperience() { return { kind: 'unavailable', reason: '' } }",
  "@/lib/observability/logger": `export const logger = {
    error(event, fields) { globalThis.__qr.logs.push({ level: "error", event, fields }) },
    warn(event, fields) { globalThis.__qr.logs.push({ level: "warn", event, fields }) },
    info() {},
  }`,
}

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
const STUB_FILTER = new RegExp(
  `^(${Object.keys(STUBS).map(escape).join("|")})$`
)

async function loadPage() {
  const result = await build({
    entryPoints: ["app/q/[qrId]/page.tsx"],
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
        name: "qr-page-boundaries",
        setup(build) {
          build.onResolve({ filter: STUB_FILTER }, ({ path }) => ({
            path,
            namespace: "stub",
          }))
          build.onLoad({ filter: /.*/, namespace: "stub" }, ({ path }) => ({
            contents: STUBS[path],
            loader: "js",
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

const PublicQrPage = await loadPage()

const LIVE_QR = {
  available: true,
  qrId: "old-crown-bar",
  merchant: { id: "merchant-1", business_slug: "old-crown" },
}

async function scan(boundaries) {
  globalThis.__qr = {
    logs: [],
    stampContext: () => {
      throw new Error("the stamp screen is not expected here")
    },
    ...boundaries,
  }
  try {
    const element = await PublicQrPage({
      params: Promise.resolve({ qrId: "old-crown-bar" }),
      searchParams: Promise.resolve({}),
    })
    const text = renderToStaticMarkup(element)
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/\s+/g, " ")
    return { text, logs: globalThis.__qr.logs }
  } catch (error) {
    if (error?.message === "NEXT_REDIRECT") {
      return { redirect: error.destination, logs: globalThis.__qr.logs }
    }
    throw error
  }
}

test("Given a signed-in member When the membership lookup fails Then the scan carries on to the join flow and the failure is logged", async () => {
  const answer = await scan({
    resolve: async () => LIVE_QR,
    membership: async () => {
      throw new Error("Unable to load membership: connection reset")
    },
  })

  assert.match(answer.redirect ?? "", /^\/m\/old-crown\/join\?/)
  assert.equal(answer.logs.length, 1)
  assert.equal(answer.logs[0].level, "error")
  assert.equal(answer.logs[0].fields.stage, "membership_lookup")
  assert.equal(answer.logs[0].fields.requestId, "req-0123456789abcdef")
  assert.doesNotMatch(
    JSON.stringify(answer.logs[0]),
    /connection reset|198\.51\.100\.9/,
    "the log line carries no error message or client address"
  )
})

test("Given the database is unreachable When the QR is scanned Then the page asks for a retry instead of blaming the QR", async () => {
  const answer = await scan({
    resolve: async () => {
      throw new TypeError("fetch failed")
    },
    membership: async () => null,
  })

  assert.equal(answer.redirect, undefined)
  assert.doesNotMatch(answer.text, /This QR isn't working/)
  assert.doesNotMatch(answer.text, /current loyalty QR/)
  assert.match(answer.text, /We couldn't load this card/)
  assert.match(answer.text, /Check your signal or Wi-Fi, then try again\./)
  assert.match(answer.text, /Try again/)
  assert.deepEqual(
    answer.logs.map(({ event, fields }) => ({
      event,
      stage: fields.stage,
      reason: fields.reason,
    })),
    [
      {
        event: "customer_qr_entry_failed",
        stage: "resolve",
        reason: "TypeError",
      },
    ]
  )
})

test("Given an inactive QR When it is scanned Then it is still reported as unavailable", async () => {
  const answer = await scan({
    resolve: async () => ({ ...LIVE_QR, available: false }),
    membership: async () => null,
  })

  assert.match(answer.text, /This QR isn't working/)
  assert.match(
    answer.text,
    /Ask a member of staff for the current loyalty QR\./
  )
  assert.deepEqual(answer.logs, [])
})

test("Given a signed-out visitor When a live QR is scanned Then they go to the join flow", async () => {
  const answer = await scan({
    resolve: async () => LIVE_QR,
    membership: async () => null,
  })

  assert.match(answer.redirect ?? "", /^\/m\/old-crown\/join\?/)
  assert.deepEqual(answer.logs, [])
})
