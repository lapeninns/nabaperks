import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * Phase C customer production-polish structural contract
 * (ux-ui-production-polish-fixes rows CUS-P1-01, CUS-P1-02, VCU-P1-01).
 *
 * Runtime behaviour is covered by tests/e2e/ux-polish-boundaries.spec.ts
 * (@polish, DB-free). These structural assertions pin the parts `node --test`
 * can prove without a browser: the entry-segment error boundaries exist and
 * are wired to `reset()`, the `/q` membership lookup sits inside its guard,
 * the join OTP resend surfaces its action state, and the scanner demotes its
 * exit links while the camera-error retry holds the only primary slot.
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

const boundarySegments = [
  { label: "/q entry", segments: ["app", "q", "[qrId]", "error.tsx"] },
  { label: "/m venue", segments: ["app", "m", "[merchantSlug]", "error.tsx"] },
  {
    label: "/m join",
    segments: ["app", "m", "[merchantSlug]", "join", "error.tsx"],
  },
  { label: "/scan", segments: ["app", "scan", "error.tsx"] },
  { label: "/home/login", segments: ["app", "home", "login", "error.tsx"] },
]

test("Given the customer entry segments When their error boundaries are inspected Then each is a branded client boundary with a working reset", () => {
  for (const { label, segments } of boundarySegments) {
    let source
    try {
      source = readProjectFile(...segments)
    } catch {
      assert.fail(`Missing error boundary for ${label}: ${segments.join("/")}`)
    }

    // Error boundaries must be client components (Next.js requirement).
    assert.match(
      source,
      /^"use client"/,
      `${label} boundary must start with "use client"`
    )
    // House pattern: the shared CustomerErrorState inside a customer shell,
    // with the reset() retry Next.js hands every boundary actually wired.
    assert.match(
      source,
      /import \{ CustomerErrorState \} from "@\/components\/customer\/customer-error-state"/,
      `${label} boundary must use CustomerErrorState`
    )
    assert.match(
      source,
      /import \{ CustomerShell \} from "@\/components\/layout"/,
      `${label} boundary must supply the customer shell`
    )
    assert.match(
      source,
      /reset\s*\}\s*:\s*\{|reset,/,
      `${label} boundary must accept the reset prop`
    )
    assert.match(
      source,
      /reset=\{reset\}/,
      `${label} boundary must pass reset to CustomerErrorState`
    )
    assert.match(
      source,
      /secondaryAction=\{\{ label: (?:".+"|OPEN_MY_CARDS_LABEL), href: "\/(home|scan)" \}\}/,
      `${label} boundary must offer a secondary recovery path`
    )
    // Calm branded copy, never the framework default error text and never
    // exclamation marks (customer copy contract).
    assert.doesNotMatch(
      source,
      /Something went wrong/i,
      `${label} boundary must not use framework default copy`
    )
    assert.doesNotMatch(
      source,
      /!"|!\s*</,
      `${label} boundary copy must not use exclamation marks`
    )
  }
})

test("Given the /q entry page When the membership lookup runs Then it degrades inside the same guard as the QR resolve", () => {
  const page = readProjectFile("app", "q", "[qrId]", "page.tsx")

  // The lookup must sit INSIDE the try block: a failed membership read
  // degrades to the same branded unavailable state as a failed QR resolve.
  assert.match(
    page,
    /try \{[\s\S]*resolveQrForJoin\(qrId[\s\S]*getExistingMembershipForCurrentUser\([\s\S]*\} catch \(error\) \{/,
    "membership lookup must be awaited inside the try/catch guard"
  )
  // The redirects stay OUTSIDE the guard so NEXT_REDIRECT is never swallowed.
  const catchIndex = page.indexOf("} catch (error) {")
  const redirectIndex = page.indexOf("redirect(")
  assert.ok(catchIndex !== -1 && redirectIndex > catchIndex,
    "redirects must remain outside the try/catch guard"
  )
  // The e2e boundary probe is dev-only, mirroring the app/dev NODE_ENV gate.
  assert.match(
    page,
    /process\.env\.NODE_ENV !== "production"[\s\S]{0,120}dev-boundary-probe/,
    "the boundary probe must be gated out of production"
  )
})

test("Given the join OTP step When a resend settles Then its outcome renders inside the live-region card", () => {
  const form = readProjectFile(
    "components",
    "customer",
    "join-otp-form.tsx"
  )

  // The resend action state must be captured, not discarded.
  assert.match(
    form,
    /const \[requestState, requestAction, requestPending\] = useActionState/,
    "resend form must capture its action state"
  )
  assert.doesNotMatch(
    form,
    /const \[, requestAction/,
    "resend action state must not be discarded"
  )
  // Errors and the sent confirmation surface inside the aria-live card.
  assert.match(form, /aria-live="polite"/)
  assert.match(
    form,
    /requestState\.errors\?\.(form|contact)/,
    "resend errors must render"
  )
  assert.match(
    form,
    /requestState\.message/,
    "resend confirmation must render"
  )
  // The resend form identifies itself so the action can answer in place
  // instead of redirecting (behaviour-preserving additive field).
  assert.match(form, /name="resend"/)
  // Pending states go through the shared SubmitButton with real ellipses.
  assert.match(
    form,
    /import \{ SubmitButton \} from "@\/components\/forms"/
  )
  assert.match(form, /pendingLabel="Sending…"/)
  assert.match(form, /pendingLabel="Checking…"/)
  assert.doesNotMatch(
    form,
    /\.\.\."/,
    "pending labels must use a real ellipsis, not three dots"
  )
})

test("Given the join identity action When a resend succeeds Then it returns state for the OTP card and keeps the phone-step redirect", () => {
  const actions = readProjectFile(
    "app",
    "m",
    "[merchantSlug]",
    "join",
    "actions.ts"
  )

  // Additive resend branch: answers the OTP card in place with a message.
  assert.match(
    actions,
    /resend[\s\S]{0,240}return \{[\s\S]{0,240}message:/,
    "resend success must return a confirmation message state"
  )
  // The phone step's advance-to-OTP redirect is unchanged.
  assert.match(
    actions,
    /redirect\(`\/m\/\$\{merchantSlug\}\/join\$\{qrId \? `\?qr=\$\{encodeURIComponent\(qrId\)\}` : ""\}`\)/,
    "phone-step redirect must remain"
  )
})

test("Given the scanner camera-error state When the action group renders Then retry is the only primary and the exits demote", () => {
  const scanner = readProjectFile(
    "components",
    "customer",
    "customer-qr-scanner.tsx"
  )

  // Retry keeps the default (primary) variant.
  assert.match(
    scanner,
    /guidance\.showRetry \? \([\s\S]{0,240}Try the camera again/,
    "retry button must remain gated on guidance.showRetry"
  )
  assert.doesNotMatch(
    scanner,
    /Try the camera again[\s\S]{0,80}variant=/,
    "retry must stay the primary (default variant)"
  )
  // The standing exits demote while retry is shown: start → ghost,
  // cards → secondary; outside the stuck state the original pair returns.
  assert.match(
    scanner,
    /guidance\.showRetry \? "ghost" : "secondary"/,
    "Back to start must demote to ghost in the camera-error state"
  )
  assert.match(
    scanner,
    /guidance\.showRetry \? "secondary" : undefined/,
    "Open my cards must demote to secondary in the camera-error state"
  )
})
