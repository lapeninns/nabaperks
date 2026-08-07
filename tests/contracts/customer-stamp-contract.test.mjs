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

test("Given the self-stamp action receives form data When source is inspected Then QR proof is validated before stamping", () => {
  const action = readProjectFile("app", "card", "[membershipId]", "actions.ts")

  assert.match(action, /const membershipId = value\(formData, "membershipId"\)/)
  assert.match(action, /const qrId = value\(formData, "qrId"\)/)
  assert.match(
    action,
    /if \(!membershipId \|\| !qrId\) \{[\s\S]*Scan the venue code to add your stamp/
  )
  assert.match(action, /getStampQrContextForMembership\(membershipId, qrId\)/)
  assert.match(
    action,
    /if \(!qrContext\) \{[\s\S]*Scan the venue code to add your stamp/
  )
  assert.match(
    action,
    /issueSelfServiceStamp\(membershipId, coordinates\(formData\)\)/
  )
  assert.ok(
    action.indexOf("getStampQrContextForMembership(membershipId, qrId)") <
      action.indexOf(
        "issueSelfServiceStamp(membershipId, coordinates(formData))"
      ),
    "the action must prove QR context before calling the stamp RPC"
  )
})

test("Given a QR id crosses into stamping When context is resolved Then inactive, unavailable, and wrong-membership QR rows are rejected", () => {
  const join = readProjectFile("lib", "customer", "join.ts")
  const resolver = join.slice(
    join.indexOf("export async function getStampQrContextForMembership"),
    join.indexOf("function first<T>")
  )

  assert.match(resolver, /resolveQrForJoin\(qrId, \{[\s\S]*recordScan: false/)
  assert.match(
    resolver,
    /if \(!qrContext \|\| !qrContext\.available\) return null/
  )
  assert.match(
    resolver,
    /getExistingMembershipForCurrentUser\(\s*qrContext\.merchant\.id\s*\)/
  )
  assert.match(
    resolver,
    /if \(!membership \|\| membership\.id !== membershipId\) return null/
  )
})

test("Given stamp context is loaded for the page When QR is missing or invalid Then the UI receives non-stamping state", () => {
  const loader = readProjectFile(
    "lib",
    "customer",
    "experience",
    "load-stamp.ts"
  )

  assert.match(
    loader,
    /if \(!qr\) \{[\s\S]*qrValid: false[\s\S]*qrMissing: true/
  )
  assert.match(
    loader,
    /const qrContext = await getStampQrContextForMembership\(membershipId, qr\)/
  )
  assert.match(
    loader,
    /if \(!qrContext\) \{[\s\S]*qrValid: false[\s\S]*qrMissing: false/
  )
  assert.ok(
    loader.indexOf("getStampQrContextForMembership(membershipId, qr)") <
      loader.indexOf("const location = await getMembershipLocationRequirement"),
    "location requirements are loaded only after the QR belongs to the member"
  )
  assert.match(loader, /getMembershipLocationRequirement\(membershipId\)/)
  assert.match(loader, /qrValid: true[\s\S]*qrId: qrContext\.qrId \?\? qr/)
})

test("Given a stamp is issued When post-issue side effects run Then they occur only after the RPC succeeds", () => {
  const action = readProjectFile("app", "card", "[membershipId]", "actions.ts")

  assert.match(
    action,
    /if \(result\.status === "blocked"\) \{[\s\S]*return fail\(result\.reason\)/
  )
  assert.ok(
    action.indexOf('if (result.status === "blocked")') <
      action.indexOf("revalidatePath(`/card/${membershipId}`)"),
    "blocked stamp results must not revalidate or enqueue notifications"
  )
  assert.match(action, /revalidatePath\(`\/card\/\$\{membershipId\}`\)/)
  assert.match(
    action,
    /enqueueStampTransitionNotifications\(\{[\s\S]*rewardUnlocked: result\.rewardUnlocked/
  )
})
