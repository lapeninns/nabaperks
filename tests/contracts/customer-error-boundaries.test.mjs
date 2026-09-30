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
 * are wired to `reset()` through the shared stale-action recovery, the `/q` membership lookup sits inside its guard,
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
    // "Try again" goes through the shared recovery: reset() for ordinary
    // errors, a single reload for a server action from an older deploy
    // (QA BUG-062).
    assert.match(
      source,
      /reset=\{\(\) => recoverFromBoundaryError\(error, reset\)\}/,
      `${label} boundary must pass the shared recovery to CustomerErrorState`
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

test("Given the /q entry page When the QR resolve or the membership lookup fails Then neither reaches the error boundary", () => {
  const page = readProjectFile("app", "q", "[qrId]", "page.tsx")
  const entry = readProjectFile("app", "q", "[qrId]", "qr-entry.ts")

  // Both reads run inside ./qr-entry, each in its own guard: a failed resolve
  // is a retry state and a failed membership lookup falls back to the join
  // flow (QA BUG-041/042); neither falls through to the error boundary
  // (CUS-P1-01), and each failure is reported rather than swallowed.
  assert.match(
    page,
    /decideQrEntry\(\{[\s\S]*resolveQrForJoin\(qrId[\s\S]*lookupMembership: getExistingMembershipForCurrentUser/
  )
  assert.match(
    entry,
    /try \{\s*qrContext = await resolve\(\)\s*\} catch \(error\) \{[\s\S]*report\("resolve", error\)/
  )
  assert.match(
    entry,
    /try \{\s*membership = await lookupMembership\([\s\S]*\} catch \(error\) \{\s*report\("membership_lookup", error\)\s*return \{ kind: "join", qrContext \}/
  )
  // Redirects stay out of the guards so NEXT_REDIRECT is never swallowed.
  assert.doesNotMatch(entry, /redirect\(/)
  assert.ok(
    page.indexOf("redirect(") > page.indexOf("await decideQrEntry("),
    "redirects must run after the guarded decision"
  )
  // The e2e boundary probe is dev-only, mirroring the app/dev NODE_ENV gate.
  assert.match(
    page,
    /process\.env\.NODE_ENV !== "production"[\s\S]{0,120}dev-boundary-probe/,
    "the boundary probe must be gated out of production"
  )
})

test("Given the join OTP step When a resend settles Then its outcome renders inside the live-region card", () => {
  const form = readProjectFile("components", "customer", "join-otp-form.tsx")

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
  assert.match(form, /requestState\.message/, "resend confirmation must render")
  // The resend form identifies itself so the action can answer in place
  // instead of redirecting (behaviour-preserving additive field).
  assert.match(form, /name="resend"/)
  // Pending states go through the shared SubmitButton with real ellipses.
  assert.match(form, /import \{ SubmitButton \} from "@\/components\/forms"/)
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
  // The phone step's advance-to-OTP redirect delegates query encoding and
  // composition to the shared join-intent builder.
  assert.match(
    actions,
    /buildCustomerJoinHref\(merchantSlug, \{[\s\S]{0,180}qrId:[\s\S]{0,180}step: "otp"/,
    "phone-step redirect must preserve the QR and explicit OTP step"
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

test("Given every error boundary in the app When Try again is pressed after a deploy changed the server-action IDs Then it uses the shared stale-action recovery (QA BUG-062)", () => {
  const boundaries = [
    ["app", "error.tsx"],
    ["app", "global-error.tsx"],
    ["app", "admin", "error.tsx"],
    ["app", "app", "error.tsx"],
    ["app", "card", "[membershipId]", "error.tsx"],
    ["app", "home", "(authed)", "error.tsx"],
    ["app", "home", "login", "error.tsx"],
    ["app", "m", "[merchantSlug]", "error.tsx"],
    ["app", "m", "[merchantSlug]", "join", "error.tsx"],
    ["app", "q", "[qrId]", "error.tsx"],
    ["app", "reward", "[rewardId]", "error.tsx"],
    ["app", "scan", "error.tsx"],
  ]
  for (const segments of boundaries) {
    const label = segments.join("/")
    const source = readProjectFile(...segments)
    assert.match(
      source,
      /import \{ recoverFromBoundaryError \} from "@\/lib\/navigation\/stale-server-action"/,
      `${label} must import the shared recovery`
    )
    assert.match(
      source,
      /\(\{\s*error,\s*reset,\s*\}/,
      `${label} must read the caught error to recognise a stale action`
    )
    assert.match(
      source,
      /recoverFromBoundaryError\(error, reset\)/,
      `${label} must route its retry through the shared recovery`
    )
    assert.doesNotMatch(
      source,
      /(onClick|reset)=\{(reset|\(\) => reset\(\))\}/,
      `${label} must not call reset() directly`
    )
  }
})
