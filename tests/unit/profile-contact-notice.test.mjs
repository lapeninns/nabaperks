import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

/**
 * The shared contact notice renders only the server-proven outcome it is
 * given, never a URL parameter, and the real screens read that outcome from
 * the one-time cookie (proved in contact-notice-flash.test.mjs).
 */
const require = createRequire(import.meta.url)
const bundle = await build({
  entryPoints: ["components/customer/profile-contact-notice.tsx"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  external: ["react", "react-dom", "next"],
  mainFields: ["module", "main"],
  jsx: "automatic",
})
const compiled = { exports: {} }
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  require,
  compiled,
  compiled.exports
)
const { ProfileContactNotice } = compiled.exports

const BOTH = { phone: true, email: true }

function render(props) {
  return renderToStaticMarkup(createElement(ProfileContactNotice, props))
}

test("Given no server-proven outcome When the notice renders Then it shows nothing", () => {
  assert.equal(render({ notice: null, confirmed: BOTH }), "")
})

test("Given a server-proven outcome When the notice renders Then it shows that confirmation once, as a status", () => {
  const html = render({ notice: "stamps-together", confirmed: BOTH })
  assert.match(html, /role="status"/)
  assert.match(html, /data-contact-notice="stamps-together"/)
  assert.equal(html.match(/Your stamps are together now\./g)?.length, 1)
  // Not backed by what the server says is confirmed now: nothing.
  assert.equal(
    render({
      notice: "nothing-found-email",
      confirmed: { phone: true, email: false },
    }),
    ""
  )
})

test("Given the real profile and reward screens When they render a notice Then it comes from the one-time cookie and a ?contact= parameter is never read", () => {
  const profile = readFileSync("app/home/(authed)/profile/page.tsx", "utf8")
  const reward = readFileSync("app/reward/[rewardId]/page.tsx", "utf8")
  for (const page of [profile, reward]) {
    assert.doesNotMatch(
      page,
      /CONTACT_NOTICE_PARAM|\.contact\b|contactNoticeFromParam/
    )
    assert.match(page, /readContactNoticeFlash\(\{/)
    assert.match(page, /notice=\{contactNotice\}/)
    assert.match(page, /\bconsume\b/)
  }
  // The profile page reads no search parameters at all.
  assert.doesNotMatch(profile, /searchParams/)
  assert.match(profile, /pathname: "\/home\/profile"/)
})
