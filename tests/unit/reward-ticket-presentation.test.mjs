import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

const bundle = await build({
  entryPoints: ["components/loyalty/reward-ticket.tsx"],
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
  createRequire(import.meta.url),
  compiled,
  compiled.exports
)
const { RewardTicket } = compiled.exports
const render = (props) =>
  renderToStaticMarkup(
    createElement(RewardTicket, { name: "Tea and cake", ...props })
  )

test("Given an expired reward When rendered Then expiry is visible and accessible", () => {
  const html = render({ state: "expired" })
  assert.match(html, /Your reward · expired/)
  assert.match(html, /aria-label="Reward expired"/)
  assert.doesNotMatch(html, /Reward ready to collect|Reward redeemed/)
})

test("Given an age-restricted reward When rendered Then photo ID guidance is shown", () => {
  const html = render({ state: "ready", requiresAgeCheck: true })
  assert.match(html, /Photo ID needed/)
})

for (const requiresAgeCheck of [false, undefined]) {
  test(`Given age check is ${requiresAgeCheck} When rendered Then photo ID guidance is absent`, () => {
    const html = render({ state: "ready", requiresAgeCheck })
    assert.doesNotMatch(html, /Photo ID needed/)
  })
}

test("Given immutable earning terms and deadlines When rendered Then supplied wording is preserved", () => {
  const html = render({
    state: "waiting",
    earningTerms: "One stamp per transaction of £10 or more.",
    expiryText: "Expires 30 September 2026",
    collectionDeadlineText: "Collect by 15:00",
    readyDate: "Tuesday 22 September",
  })
  for (const text of [
    "One stamp per transaction of £10 or more.",
    "Expires 30 September 2026",
    "Collect by 15:00",
    "Ready · Tuesday 22 September",
  ])
    assert.ok(html.includes(text))
})

test("Given a current upgrade window When rendered Then the supplied upgrade and end time are shown", () => {
  const html = render({
    state: "ready",
    collectionWindowText: "Collect now and get Cream tea — until 15:00",
  })
  assert.match(html, /Collect now and get Cream tea — until 15:00/)
})

test("Given an upcoming upgrade window When rendered Then the supplied collection window is shown", () => {
  const html = render({
    state: "ready",
    collectionWindowText:
      "Collect on Tue 12:00–15:00 and get Cream tea instead",
  })
  assert.match(html, /Collect on Tue 12:00–15:00 and get Cream tea instead/)
})

test("Given an unlocked reward that is not ready When rendered Then it never reads as ready", () => {
  const html = render({ state: "waiting" })
  assert.match(html, /Unlocked/)
  assert.doesNotMatch(html, />Ready</)
  assert.doesNotMatch(html, /Reward ready to collect/)
})
