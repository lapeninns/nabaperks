import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)

  assert.notEqual(start, -1, `missing source marker: ${startMarker}`)
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`)

  return source.slice(start, end)
}

test("Given the merchant activation funnel When the registry is inspected Then acquisition, OTP, launch, and billing milestones have stable names", () => {
  const events = readProjectFile("lib", "analytics", "events.ts")

  const acquisitionAndOtpEvents = [
    "merchant_marketing_viewed",
    "merchant_signup_clicked",
    "merchant_signup_started",
    "merchant_account_created",
    "merchant_otp_verification_viewed",
    "merchant_otp_resent",
    "merchant_email_verified",
  ]
  const downstreamActivationEvents = [
    "merchant_launch_entered",
    "merchant_billing_reached",
    "merchant_billing_checkout_started",
    "merchant_billing_checkout_returned",
    "merchant_billing_activated",
  ]

  for (const eventName of [
    ...acquisitionAndOtpEvents,
    ...downstreamActivationEvents,
  ]) {
    assert.match(events, new RegExp(`"${eventName}"`), `${eventName} is stable`)
  }
})

test("Given optional external analytics When PostHog capture is inspected Then it is server-only, explicitly enabled, pseudonymous, and profileless", () => {
  const events = readProjectFile("lib", "analytics", "events.ts")
  const privacyCore = readProjectFile("lib", "analytics", "privacy-core.ts")
  const captureSource = `${events}\n${privacyCore}`
  const envExample = readProjectFile(".env.example")
  const publicEnv = readProjectFile("lib", "env", "public.ts")

  for (const key of [
    "POSTHOG_PROJECT_KEY",
    "POSTHOG_HOST",
    "ANALYTICS_EXTERNAL_PROCESSING_MODE",
    "ANALYTICS_PSEUDONYM_SECRET",
  ]) {
    assert.match(events, new RegExp(`process\\.env\\.${key}\\b`))
    assert.match(envExample, new RegExp(`^${key}=`, "m"))
  }

  assert.match(
    events,
    /ANALYTICS_EXTERNAL_PROCESSING_MODE[\s\S]{0,180}pseudonymous/
  )
  assert.match(events, /\/i\/v0\/e\//)
  assert.match(captureSource, /["']?\$process_person_profile["']?\s*:\s*false/)
  assert.match(captureSource, /distinct_id/)
  assert.doesNotMatch(events, /NEXT_PUBLIC_POSTHOG/)
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_POSTHOG/)
  assert.doesNotMatch(publicEnv, /NEXT_PUBLIC_POSTHOG/)
})

test("Given a public funnel capture request When the route contract is inspected Then origin, size, vocabulary, throttling, and cache guards are server-enforced", () => {
  const route = readProjectFile("app", "api", "analytics", "funnel", "route.ts")
  const contract = readProjectFile("lib", "analytics", "funnel-contract.ts")
  const requestGuard = readProjectFile("lib", "http", "bounded-json-request.ts")
  const guardedSource = `${route}\n${contract}\n${requestGuard}`

  assert.match(guardedSource, /headers\.get\(["']origin["']\)/i)
  assert.match(
    route,
    /isSameOriginRequest\(request, process\.env\.NEXT_PUBLIC_APP_URL\)/
  )
  assert.match(requestGuard, /configuredOrigin/)
  assert.doesNotMatch(
    requestGuard,
    /headers\s*\.get\(["']x-forwarded-host["']\)/
  )
  assert.doesNotMatch(
    requestGuard,
    /headers\s*\.get\(["']x-forwarded-proto["']\)/
  )
  assert.doesNotMatch(requestGuard, /headers\.get\(["']host["']\)/)
  assert.match(guardedSource, /MAX_[A-Z_]*BODY[A-Z_]*BYTES/)
  assert.match(guardedSource, /content-length|body\.length|text\.length/i)
  assert.match(route, /enforceRateLimit/)
  assert.match(route, /trustedClientIp\(request\.headers\)/)
  assert.doesNotMatch(route, /rateLimitIdentityFromHeaders/)
  assert.match(route, /from "@\/lib\/http\/no-store-json"/)
  assert.match(
    readProjectFile("lib", "http", "no-store-json.ts"),
    /cache-control[\s\S]{0,80}no-store/i
  )
  assert.match(contract, /merchant_marketing_viewed/)
  assert.match(contract, /merchant_signup_clicked/)
  assert.match(contract, /merchant_signup_started/)
  assert.doesNotMatch(
    route,
    /createSupabaseServiceRoleClient\([\s\S]*request\.json\(\)[\s\S]*\.insert\(/
  )
})

test("Given acquisition continuity When the browser tracker is inspected Then its signed token stays in sessionStorage and the capture body", () => {
  const tracker = readProjectFile(
    "components",
    "analytics",
    "marketing-funnel-tracker.tsx"
  )
  const captureQueue = readProjectFile(
    "lib",
    "analytics",
    "funnel-capture-queue.ts"
  )

  assert.match(tracker, /sessionStorage\.getItem\(/)
  assert.match(tracker, /sessionStorage\.setItem\(/)
  assert.match(tracker, /fetch\(["']\/api\/analytics\/funnel["']/)
  assert.match(tracker, /method:\s*["']POST["']/)
  assert.match(tracker, /body:\s*JSON\.stringify\(/)
  assert.doesNotMatch(tracker, /\blocalStorage\b/)
  assert.doesNotMatch(tracker, /volatileFunnelToken/)
  assert.match(tracker, /createFunnelCaptureQueue/)
  assert.match(captureQueue, /let queue:\s*Promise<void>/)
  assert.match(
    captureQueue,
    /queue\.then\(async \(\) =>[\s\S]{0,180}readToken\(\)/,
    "each serialized capture reads current session continuity when it starts"
  )
  assert.doesNotMatch(captureQueue, /previousToken/)
  assert.doesNotMatch(tracker, /Promise<string\s*\|\s*null>/)
  assert.doesNotMatch(tracker, /document\.cookie|cookieStore/)
  assert.doesNotMatch(tracker, /[?&](?:funnel|funnel_token|token)=/i)
  assert.doesNotMatch(
    tracker,
    /(?:searchParams|URLSearchParams)[\s\S]{0,160}(?:funnel|token)/i
  )
})

test("Given a visitor enters and advances through marketing When tracking is inspected Then views, clicks and valid submits have distinct milestones", () => {
  const tracker = readProjectFile(
    "components",
    "analytics",
    "marketing-funnel-tracker.tsx"
  )
  const signupLink = readProjectFile(
    "components",
    "analytics",
    "marketing-signup-link.tsx"
  )
  const signupForm = readProjectFile(
    "components",
    "auth",
    "signup-details-form.tsx"
  )

  assert.match(
    tracker,
    /isMarketingPage\(pathname\).*merchant_marketing_viewed/
  )
  assert.doesNotMatch(
    tracker,
    /pathname === ["']\/signup["'].*merchant_signup_started/
  )
  assert.match(signupLink, /merchant_signup_clicked/)
  assert.match(signupForm, /merchant_signup_started/)
})

test("Given a supplied funnel token is invalid When identity recording is inspected Then it rotates without persisting the rejected milestone", () => {
  const funnelEvents = readProjectFile("lib", "analytics", "funnel-events.ts")
  const invalidGuard = sourceSection(
    funnelEvents,
    "if (!verified)",
    "const funnelKey"
  )

  assert.match(invalidGuard, /issueFunnelToken/)
  assert.doesNotMatch(invalidGuard, /recordProductEvent/)
})

test("Given the first token response is lost When anonymous capture retries Then issuance has not created an orphan event", () => {
  const funnelEvents = readProjectFile("lib", "analytics", "funnel-events.ts")
  const issuanceOnly = sourceSection(
    funnelEvents,
    "if (!funnelToken)",
    "const verified"
  )
  const tracker = readProjectFile(
    "components",
    "analytics",
    "marketing-funnel-tracker.tsx"
  )
  const captureQueue = readProjectFile(
    "lib",
    "analytics",
    "funnel-capture-queue.ts"
  )

  assert.match(issuanceOnly, /issueFunnelToken/)
  assert.doesNotMatch(issuanceOnly, /recordProductEvent/)
  assert.match(tracker, /rememberToken:\s*rememberFunnelToken/)
  assert.match(captureQueue, /rememberToken\(result\.token\)/)
  assert.match(captureQueue, /postCapture\(event, result\.token\)/)
})

test("Given authoritative merchant auth outcomes When source wiring is inspected Then resend and verification telemetry is success-only and fail-open", () => {
  const actions = readProjectFile("app", "(auth)", "actions.ts")
  const sendEmailHook = readProjectFile(
    "app",
    "api",
    "auth",
    "hooks",
    "send-email",
    "route.ts"
  )
  const emailActionCore = readProjectFile(
    "lib",
    "auth",
    "send-email-action-core.ts"
  )
  const funnelEvents = readProjectFile("lib", "analytics", "funnel-events.ts")
  const afterResponse = readProjectFile("lib", "analytics", "after-response.ts")
  const signUp = sourceSection(
    actions,
    "export async function signUpAction",
    "export async function signupOtpAction"
  )
  const verify = sourceSection(
    actions,
    "async function verifySignupOtp",
    "async function confirmMerchantEmailAccess"
  )
  const resend = sourceSection(
    actions,
    "async function sendMerchantOtp",
    "type MerchantOtpVerificationResult"
  )

  assert.match(actions, /from ["']@\/lib\/analytics\/funnel-events["']/)
  assert.match(funnelEvents, /recordProductEvent/)
  assert.match(funnelEvents, /import \{ after \} from ["']next\/server["']/)
  assert.match(
    funnelEvents,
    /scheduleAfterResponseAnalytics\(after, \(\) => persistMerchantFunnelEvent\(input\)\)/
  )
  assert.match(afterResponse, /registerAfter\(async \(\) =>/)
  assert.match(afterResponse, /try\s*\{[\s\S]*await task\(\)[\s\S]*catch/)
  assert.doesNotMatch(actions, /await recordMerchantFunnelEventSafely/)
  assert.match(
    funnelEvents,
    /try\s*\{[\s\S]*?recordProductEvent[\s\S]*?\}\s*catch/
  )
  assert.doesNotMatch(funnelEvents, /catch[^\n]*\{[\s\S]{0,220}\bthrow\b/)

  assert.doesNotMatch(
    signUp,
    /merchant_account_created/,
    "enumeration-neutral passwordless signup cannot claim creation before email verification"
  )
  const classifyAt = sendEmailHook.indexOf("classifySendEmailAction(")
  const accountCreatedAt = sendEmailHook.indexOf(
    'event: "merchant_account_created"'
  )
  const claimAt = sendEmailHook.indexOf("claimAuthHookDelivery(")
  assert.ok(classifyAt > 0 && accountCreatedAt > classifyAt)
  assert.ok(claimAt > accountCreatedAt)
  assert.match(sendEmailHook, /actorId: userId/)
  assert.match(emailActionCore, /"signup"[\s\S]*recordsAccountCreation: true/)
  assert.match(
    emailActionCore,
    /"magiclink"[\s\S]*recordsAccountCreation: false/
  )
  assert.match(
    emailActionCore,
    /"recovery"[\s\S]*recordsAccountCreation: false/
  )
  assert.ok(
    resend.indexOf("merchant_otp_resent") >
      resend.indexOf("if (deliveryError)"),
    "resend telemetry follows successful provider delivery"
  )
  assert.ok(
    verify.indexOf("merchant_email_verified") >
      verify.indexOf('verification.status === "error"'),
    "verification telemetry follows the authoritative success guard"
  )
  assert.match(
    resend,
    /context\.flow\s*===\s*["']signup["'][\s\S]{0,500}merchant_otp_resent/
  )
})

test("Given a merchant reads the privacy summary When analytics is described Then first-party session measurement is distinct from optional pseudonymous processing", () => {
  const privacy = readProjectFile("lib", "legal", "content.ts")

  assert.match(privacy, /first-party session measurement/i)
  assert.match(privacy, /optional pseudonymous PostHog processing/i)
  for (const excludedValue of [
    "contact",
    "form",
    "provider",
    "URL",
    "precise-location",
  ]) {
    assert.match(
      privacy,
      new RegExp(
        `${excludedValue}[^.]{0,120}(?:excluded|not sent)|(?:excluded|not sent)[^.]{0,120}${excludedValue}`,
        "i"
      ),
      `privacy copy explains ${excludedValue} exclusion`
    )
  }
})
