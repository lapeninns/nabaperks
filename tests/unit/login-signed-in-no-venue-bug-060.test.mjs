import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-060 follow-up (defence in depth for /login): a signed-in user who owns
 * no venue must not be sent back into a console page that sends them to
 * /login, or the two redirect to each other endlessly. The real page and the
 * real safe-next-path rules run; the session reads and the page's components
 * are stand-ins.
 */

const STUBS = {
  "fixture-state": `export const state = { user: null, merchant: null, merchantError: null, merchantReads: 0 };`,
  "server-only": "",
  "next/navigation": `export function redirect(destination) {
    const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error
  }`,
  "@hugeicons/core-free-icons": "export const Tick02Icon = {}",
  "@/app/(auth)/viewport": 'export const AUTH_SECTION_MIN_H = ""',
  "@/components/brand": `export function Eyebrow() { return null }
    export function Icon() { return null }
    export function PageTitle() { return null }
    export function ReceiptCard() { return null }`,
  "@/components/auth/reset-password-form":
    "export function ResetPasswordForm() { return null }",
  "@/components/layout": "export function MarketingLayout() { return null }",
  "@/components/ui/alert": `export function Alert() { return null }
    export function AlertDescription() { return null }
    export function AlertTitle() { return null }`,
  "@/lib/auth/session": `import { state } from "fixture-state";
    export async function getCurrentUser() { return state.user }
    export async function getCurrentMerchant() {
      state.merchantReads += 1;
      if (state.merchantError) throw state.merchantError;
      return state.merchant
    }`,
  "@/lib/auth/merchant-email-otp-alias":
    "export function merchantEmailOtpAliasLength() { return 6 }",
  "@/lib/seo/metadata": "export const PRIVATE_ROUTE_METADATA = {}",
  "@/lib/utils":
    "export function cn(...values) { return values.filter(Boolean).join(' ') }",
}

async function loadLoginPage() {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents:
        'export { default } from "./app/(auth)/login/page.tsx"; export { state } from "fixture-state";',
      resolveDir: root,
      loader: "tsx",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    write: false,
    logLevel: "silent",
    plugins: [
      {
        name: "login-page-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/|@hugeicons\/|@\/)/ },
            ({ path: specifier }) => {
              if (specifier in STUBS) {
                return { path: specifier, namespace: "fixture" }
              }
              // Navigation rules and any new auth decision helper run for real.
              const base = path.join(root, specifier.slice(2))
              const file = [".ts", ".tsx"]
                .map((extension) => base + extension)
                .find(existsSync)
              assert.ok(
                file &&
                  (specifier.startsWith("@/lib/navigation/") ||
                    specifier.startsWith("@/lib/auth/")),
                `Unrecognised boundary: ${specifier}`
              )
              return { path: file }
            }
          )
          build.onLoad(
            { filter: /.*/, namespace: "fixture" },
            ({ path: id }) => ({ contents: STUBS[id], resolveDir: root })
          )
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${randomUUID()}`
  )
}

async function visitLogin(page, searchParams) {
  try {
    await page({ searchParams: Promise.resolve(searchParams) })
    return { rendered: true }
  } catch (error) {
    if (error?.destination) return { redirect: error.destination }
    throw error
  }
}

const SIGNED_IN = { id: "user-1", email: "owner@venue.example" }
const VENUE = { id: "merchant-1", business_name: "The Old Crown" }

test("Given a signed-in user with no venue When /login is asked to return to a console scan page Then onboarding is the destination", async () => {
  const { default: page, state } = await loadLoginPage()
  state.user = SIGNED_IN

  for (const next of [
    "/app/rewards/scan/7d9d4c4e-1f6b-4b8f-8d0a-4b0e1c2a3f11",
    "/app/offers/scan/0c9f5b1e-2a3d-4e5f-8a7b-9c0d1e2f3a4b",
    "/app",
    "/app/customers?view=recent",
  ]) {
    assert.deepEqual(await visitLogin(page, { next }), {
      redirect: "/app/onboarding",
    })
  }
})

test("Given a signed-in user with no venue When next is already onboarding Then it is kept", async () => {
  const { default: page, state } = await loadLoginPage()
  state.user = SIGNED_IN

  assert.deepEqual(
    await visitLogin(page, { next: "/app/onboarding?step=location" }),
    { redirect: "/app/onboarding?step=location" }
  )
})

test("Given a signed-in venue owner When /login has a console next Then they return to it as before", async () => {
  const { default: page, state } = await loadLoginPage()
  state.user = SIGNED_IN
  state.merchant = VENUE

  const next = "/app/rewards/scan/7d9d4c4e-1f6b-4b8f-8d0a-4b0e1c2a3f11"
  assert.deepEqual(await visitLogin(page, { next }), { redirect: next })
  assert.deepEqual(await visitLogin(page, {}), { redirect: "/app" })
})

test("Given a signed-in user When next is outside the console Then no venue read is needed", async () => {
  const { default: page, state } = await loadLoginPage()
  state.user = SIGNED_IN

  assert.deepEqual(await visitLogin(page, { next: "/pricing" }), {
    redirect: "/pricing",
  })
  assert.equal(state.merchantReads, 0)
})

test("Given the venue read fails When a signed-in user reaches /login Then today's destination is kept", async () => {
  const { default: page, state } = await loadLoginPage()
  state.user = SIGNED_IN
  state.merchantError = new Error("Unable to load merchant profile")

  const next = "/app/rewards/scan/7d9d4c4e-1f6b-4b8f-8d0a-4b0e1c2a3f11"
  assert.deepEqual(await visitLogin(page, { next }), { redirect: next })
})

test("Given a signed-out visitor When /login opens Then the page renders", async () => {
  const { default: page, state } = await loadLoginPage()
  state.user = null

  assert.deepEqual(await visitLogin(page, { next: "/app/rewards/scan/abc" }), {
    rendered: true,
  })
  assert.equal(state.merchantReads, 0)
})
