import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const pageUrl = new URL(
  "../../app/home/session/reset/page.tsx",
  import.meta.url
)
const routeUrl = new URL(
  "../../app/home/session/reset/route.ts",
  import.meta.url
)
const action = readFileSync(
  new URL("../../app/home/session/reset/actions.ts", import.meta.url),
  "utf8"
)
const page = readFileSync(pageUrl, "utf8")
const homeActions = readFileSync(
  new URL("../../app/home/actions.ts", import.meta.url),
  "utf8"
)

test("GET session reset is a read-only confirmation page", () => {
  assert.equal(existsSync(routeUrl), false)
  assert.doesNotMatch(page, /clearCustomerSession/)
  assert.match(page, /<form action=\{resetCustomerSessionAction\}/)
  assert.match(page, /type="submit"/)
})

test("explicit reset sanitises continuation before revoking the session", () => {
  const sanitise = action.indexOf("safeNextPath(")
  const revoke = action.indexOf("await clearCustomerSession()")
  const redirect = action.indexOf("redirect(customerLoginHref(next))")

  assert.ok(sanitise >= 0 && sanitise < revoke)
  assert.ok(revoke < redirect)
})

test("the ordinary customer logout remains an explicit server action", () => {
  assert.match(
    homeActions,
    /export async function signOutCustomerAction\(\)[\s\S]*await clearCustomerSession\(\)[\s\S]*redirect\("\/home\/login"\)/
  )
})
