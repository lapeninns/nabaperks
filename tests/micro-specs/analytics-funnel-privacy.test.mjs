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

  assert.match(events, /ANALYTICS_EXTERNAL_PROCESSING_MODE[\s\S]{0,180}pseudonymous/)
  assert.match(events, /\/i\/v0\/e\//)
  assert.match(events, /["']\$process_person_profile["']\s*:\s*false/)
  assert.match(events, /distinct_id/)
  assert.doesNotMatch(events, /NEXT_PUBLIC_POSTHOG/)
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_POSTHOG/)
  assert.doesNotMatch(publicEnv, /NEXT_PUBLIC_POSTHOG/)
})

test("Given a public funnel capture request When the route contract is inspected Then origin, size, vocabulary, throttling, and cache guards are server-enforced", () => {
  const route = readProjectFile(
    "app",
    "api",
    "analytics",
    "funnel",
    "route.ts"
  )
  const contract = readProjectFile("lib", "analytics", "funnel-contract.ts")
  const guardedSource = `${route}\n${contract}`

  assert.match(guardedSource, /headers\.get\(["']origin["']\)/i)
  assert.match(guardedSource, /new URL\(request\.url\)\.origin/)
  assert.match(guardedSource, /MAX_[A-Z_]*BODY[A-Z_]*BYTES/)
  assert.match(guardedSource, /content-length|body\.length|text\.length/i)
  assert.match(route, /enforceRateLimit/)
  assert.match(route, /cache-control[\s\S]{0,80}no-store/i)
  assert.match(contract, /merchant_marketing_viewed/)
  assert.match(contract, /merchant_signup_clicked/)
  assert.match(contract, /merchant_signup_started/)
  assert.doesNotMatch(route, /createSupabaseServiceRoleClient\([\s\S]*request\.json\(\)[\s\S]*\.insert\(/)
})

test("Given acquisition continuity When the browser tracker is inspected Then its signed token stays in sessionStorage and the capture body", () => {
  const tracker = readProjectFile(
    "components",
    "analytics",
    "marketing-funnel-tracker.tsx"
  )

  assert.match(tracker, /sessionStorage\.getItem\(/)
  assert.match(tracker, /sessionStorage\.setItem\(/)
  assert.match(tracker, /fetch\(["']\/api\/analytics\/funnel["']/)
  assert.match(tracker, /method:\s*["']POST["']/)
  assert.match(tracker, /body:\s*JSON\.stringify\(/)
  assert.doesNotMatch(tracker, /\blocalStorage\b/)
  assert.doesNotMatch(tracker, /document\.cookie|cookieStore/)
  assert.doesNotMatch(tracker, /[?&](?:funnel|funnel_token|token)=/i)
  assert.doesNotMatch(tracker, /(?:searchParams|URLSearchParams)[\s\S]{0,160}(?:funnel|token)/i)
})

test("Given authoritative merchant auth outcomes When source wiring is inspected Then account creation, resend, and verification telemetry is success-only and fail-open", () => {
  const actions = readProjectFile("app", "(auth)", "actions.ts")
  const funnelEvents = readProjectFile("lib", "analytics", "funnel-events.ts")
  const signUp = sourceSection(
    actions,
    "export async function signUpAction",
    "export async function signupOtpAction"
  )
  const verify = sourceSection(
    actions,
    "async function verifySignupOtp",
    "async function confirmMerchantPasswordReset"
  )
  const resend = sourceSection(
    actions,
    "async function sendMerchantOtp",
    "type MerchantOtpVerificationResult"
  )

  assert.match(actions, /from ["']@\/lib\/analytics\/funnel-events["']/)
  assert.match(funnelEvents, /recordProductEvent/)
  assert.match(funnelEvents, /try\s*\{[\s\S]*?recordProductEvent[\s\S]*?\}\s*catch/)
  assert.doesNotMatch(funnelEvents, /catch[^\n]*\{[\s\S]{0,220}\bthrow\b/)

  assert.ok(
    signUp.indexOf("merchant_account_created") > signUp.indexOf("if (error)"),
    "account-created telemetry follows the provider success guard"
  )
  assert.ok(
    resend.indexOf("merchant_otp_resent") > resend.indexOf("if (deliveryError)"),
    "resend telemetry follows successful provider delivery"
  )
  assert.ok(
    verify.indexOf("merchant_email_verified") >
      verify.indexOf('verification.status === "error"'),
    "verification telemetry follows the authoritative success guard"
  )
  assert.match(resend, /context\.flow\s*===\s*["']signup["'][\s\S]{0,500}merchant_otp_resent/)
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
      new RegExp(`${excludedValue}[^.]{0,120}(?:excluded|not sent)|(?:excluded|not sent)[^.]{0,120}${excludedValue}`, "i"),
      `privacy copy explains ${excludedValue} exclusion`
    )
  }
})
