import { createRequire } from "node:module"
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
  "@/lib/customer/join": `import { RateLimitError } from "@/lib/security/rate-limit";
    export async function resolveQrForJoin(...args) { if (globalThis.__qr.rateLimited) throw new RateLimitError(); return globalThis.__qr.resolve(...args) }
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

export async function scan(boundaries) {
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
    return {
      html: renderToStaticMarkup(element),
      text,
      logs: globalThis.__qr.logs,
    }
  } catch (error) {
    if (error?.message === "NEXT_REDIRECT") {
      return { redirect: error.destination, logs: globalThis.__qr.logs }
    }
    throw error
  }
}
