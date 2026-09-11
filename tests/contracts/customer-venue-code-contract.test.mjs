import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

// contract-customer-venue-code — pins the application half of the venue-code
// fallback:
//   1. the action throttles before any database work, validates the code's
//      shape before it proves QR context, and proves QR context before the RPC;
//   2. the service never records a "location refusal" for a refused code —
//      the code is a fallback for a refusal, not a source of them;
//   3. no code value is ever echoed back to the client in action state;
//   4. the form is a numeric, one-time-code field and only appears when the
//      choreography offers the fallback;
//   5. the refusal copy points at the fallback.
// Behavioural proof: tests/db/venue-code-stamp.test.mjs and the
// customer-stamp-choreography Playwright specs (location-blocked lanes).

const action = readFileSync("app/card/[membershipId]/actions.ts", "utf8")
const service = readFileSync("lib/customer/stamp.ts", "utf8")
const collector = readFileSync(
  "components/customer/stamp-collector.tsx",
  "utf8"
)
const form = readFileSync("components/customer/venue-code-form.tsx", "utf8")
const copy = readFileSync("lib/customer/experience/block-reasons.ts", "utf8")

function slice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  assert.notEqual(start, -1, `${startMarker} exists`)
  const end = endMarker ? source.indexOf(endMarker, start + 1) : -1
  return source.slice(start, end === -1 ? undefined : end)
}

test("the venue-code action throttles, validates, proves QR context, then calls the RPC — in that order", () => {
  const body = slice(
    action,
    "export async function venueCodeStampAction",
    "async function completeIssuedStamp"
  )
  const charge = body.indexOf("chargeVenueCodeActionAttempt()")
  const shape = body.indexOf("venue_code_format")
  const qr = body.indexOf("getStampQrContextForMembership(membershipId, qrId)")
  const rpc = body.indexOf("issueVenueCodeStamp({")

  assert.ok(
    charge > -1 && shape > charge,
    "the code's shape is checked after the throttle"
  )
  assert.ok(qr > shape, "QR context is proved after the shape check")
  assert.ok(rpc > qr, "the RPC runs only after QR context is proved")
  assert.match(
    body,
    /deviceHash: customerDeviceHashFromHeaders\(requestHeaders\)/
  )
  assert.match(
    body,
    /networkHash: rateLimitIdentityFromHeaders\(requestHeaders\)/
  )
})

test("both stamp actions share one post-issue path so their side effects cannot drift", () => {
  assert.equal(
    (
      action.match(
        /completeIssuedStamp\(membershipId, qrContext\.merchant\.id, result\)/g
      ) ?? []
    ).length,
    2,
    "selfStampAction and venueCodeStampAction both settle through completeIssuedStamp"
  )
})

test("a refused code is never recorded as a location refusal", () => {
  const body = slice(
    service,
    "export async function issueVenueCodeStamp",
    "function notSignedIn"
  )
  assert.doesNotMatch(
    body,
    /recordLocationRefusal/,
    "no refusal is recorded from the code path"
  )
  assert.match(
    body,
    /consume_venue_code_attempt/,
    "the committed-first charge runs"
  )
  assert.match(
    body,
    /drainReferralBonusesBeforeStamp/,
    "referral settle-before-stamp parity"
  )
  assert.match(body, /issue_venue_code_stamp/)
  assert.ok(
    body.indexOf("consume_venue_code_attempt") <
      body.indexOf("issue_venue_code_stamp"),
    "the charge precedes the verify call"
  )
})

test("no code value is echoed back in action state", () => {
  const body = slice(
    action,
    "export async function venueCodeStampAction",
    "async function completeIssuedStamp"
  )
  for (const failCall of body.match(/fail\([^)]*\)/g) ?? []) {
    assert.doesNotMatch(
      failCall,
      /\bcode\b/,
      `state never carries the code: ${failCall}`
    )
  }
  assert.doesNotMatch(
    readFileSync("lib/customer/self-stamp-action-state.ts", "utf8"),
    /code\??:/,
    "the action state type has no code field"
  )
})

test("the form is a numeric one-time-code field that only renders when offered", () => {
  assert.match(form, /inputMode="numeric"/)
  assert.match(form, /autoComplete="one-time-code"/)
  assert.match(form, /maxLength=\{VENUE_CODE_LENGTH\}/)
  assert.match(
    form,
    /replace\(\/\\D\/g, ""\)/,
    "non-digits are stripped as typed"
  )
  assert.match(
    form,
    /<fieldset disabled=\{pending\}/,
    "inert while a request is in flight"
  )
  assert.match(
    collector,
    /view\.venueCodeOffer \|\| view\.venueCodeLockedUntil !== null/
  )
  assert.match(
    collector,
    /LocationRetryButton/,
    "a location refusal also offers a tap that re-asks the browser for location"
  )
  assert.match(
    collector,
    /submitVenueCode = venueCodeStampAction/,
    "the real action is the default submitter"
  )
})

test("the location refusal copy names the fallback", () => {
  const outOfRange = slice(
    copy,
    'case "location_out_of_range":',
    'case "location_required":'
  )
  const required = slice(
    copy,
    'case "location_required":',
    'case "venue_code_rejected":'
  )
  assert.match(outOfRange, /today's code/)
  assert.match(required, /today's code/)
})
