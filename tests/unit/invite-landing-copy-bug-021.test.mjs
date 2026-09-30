import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"
import { renderToStaticMarkup } from "react-dom/server"

/**
 * QA BUG-021 (38c42a1..2c45031): the loyalty-invitation landing promised every
 * visitor "You'll verify your phone, then you're in". Since #395 an invitation
 * can be claimed by a verified email, and a signed-in wallet goes straight to
 * the terms step, so an email-only wallet never meets a phone step.
 *
 * The page is rendered for real (server component + shared panel); only the
 * invitation lookup, the claim action and `after()` are stubbed. `/invite` is
 * outside the proxy matcher, so the landing cannot see a customer session:
 * the same copy reaches a phone wallet, an email-only wallet and a signed-out
 * guest, and it must be true for all three.
 */
async function loadPage() {
  const stubs = {
    "next/server": "export function after() {}",
    "@/lib/loyalty-invites/claim-context": `
      export async function resolveInviteClaimContext() {
        return { status: "available", businessName: "The Old Crown", claimTokenHash: "hash", merchantSlug: "old-crown" }
      }
      export async function markInviteOpened() {}`,
    "./actions": "export async function startInviteClaimAction() {}",
    "server-only": "",
  }
  const result = await build({
    entryPoints: ["app/invite/[token]/page.tsx"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    external: ["react", "react-dom", "next/link", "next/navigation"],
    plugins: [
      {
        name: "invite-page-boundaries",
        setup(build) {
          build.onResolve(
            {
              filter:
                /^(next\/server|server-only|\.\/actions|@\/lib\/loyalty-invites\/claim-context)$/,
            },
            ({ path }) => ({ path, namespace: "stub" })
          )
          build.onLoad({ filter: /.*/, namespace: "stub" }, ({ path }) => ({
            contents: stubs[path],
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

async function renderLanding(mode) {
  const previous = process.env.CUSTOMER_EMAIL_AUTH_MODE
  if (mode === undefined) delete process.env.CUSTOMER_EMAIL_AUTH_MODE
  else process.env.CUSTOMER_EMAIL_AUTH_MODE = mode
  try {
    const InviteClaimPage = await loadPage()
    const element = await InviteClaimPage({
      params: Promise.resolve({ token: "invite-token" }),
    })
    return renderToStaticMarkup(element)
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/\s+/g, " ")
  } finally {
    if (previous === undefined) delete process.env.CUSTOMER_EMAIL_AUTH_MODE
    else process.env.CUSTOMER_EMAIL_AUTH_MODE = previous
  }
}

for (const mode of ["full", "existing"]) {
  test(`Given email sign-in is ${mode} When the invitation landing renders Then no visitor is promised a phone step and the email route is named`, async () => {
    const text = await renderLanding(mode)
    assert.match(text, /Two stamps to start your card/)
    assert.doesNotMatch(text, /You'll verify your phone, then you're in/)
    assert.match(
      text,
      /If you're not already signed in, you'll confirm your phone number or email, then you're in\./
    )
    // One landing serves every visitor; a signed-in wallet skips the
    // confirmation, which the conditional wording allows.
    assert.doesNotMatch(text, /!/)
  })
}

test("Given email sign-in is off When the invitation landing renders Then only a signed-out guest is told about the phone step", async () => {
  for (const mode of ["off", undefined]) {
    const text = await renderLanding(mode)
    assert.doesNotMatch(text, /You'll verify your phone, then you're in/)
    assert.match(
      text,
      /If you're not already signed in, you'll verify your phone number, then you're in\./
    )
    assert.doesNotMatch(text, /or email/)
  }
})
