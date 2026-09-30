import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

/**
 * QA BUG-012 follow-up (38c42a1..2c45031): when "Log out on all devices" could
 * sign out only this browser, the action redirects to
 * /home/login?signed_out=this_device and the page must say so. Only that exact
 * value shows the notice. The rendered-page proof is
 * tests/e2e/customer-login-signed-out-notice.spec.ts.
 */

const { SIGNED_OUT_THIS_DEVICE_NOTICE, signedOutNotice } =
  await import("@/lib/customer/session-signed-out-notice")

test("Given only this device was signed out When /home/login opens Then it says other devices are still signed in", () => {
  assert.equal(signedOutNotice("this_device"), SIGNED_OUT_THIS_DEVICE_NOTICE)
  assert.match(SIGNED_OUT_THIS_DEVICE_NOTICE, /signed out on this device/)
  assert.match(
    SIGNED_OUT_THIS_DEVICE_NOTICE,
    /couldn't sign you out on your other devices/
  )
  assert.doesNotMatch(SIGNED_OUT_THIS_DEVICE_NOTICE, /session|account|—/i)
  // British English guest copy: no exclamation marks.
  assert.doesNotMatch(SIGNED_OUT_THIS_DEVICE_NOTICE, /!/)
})

test("Given any other signed_out value When /home/login opens Then no notice is shown", () => {
  for (const value of [
    undefined,
    "",
    "all_devices",
    "THIS_DEVICE",
    " this_device",
    "this_device ",
    "this_device,this_device",
    ["this_device"],
    ["this_device", "this_device"],
  ]) {
    assert.equal(signedOutNotice(value), null, JSON.stringify(value))
  }
})

test("Given the login page When it renders Then it reads signed_out through the notice rule and keeps the safe next path", () => {
  const page = readFileSync("app/home/login/page.tsx", "utf8")
  assert.match(page, /signedOutNotice\(params\.signed_out\)/)
  assert.match(page, /safeNextPath\(nextParam \?\? "\/home"\)/)
})
