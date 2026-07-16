import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

const root = process.cwd()
const read = (relativePath) =>
  readFileSync(path.join(root, relativePath), "utf8")

const collector = read("components/customer/stamp-collector.tsx")
const pressButton = read("components/customer/stamp-press-button.tsx")
const wetInk = read("components/motion/wet-ink.tsx")
const choreography = read("lib/customer/experience/stamp-choreography.ts")
const action = read("app/card/[membershipId]/actions.ts")
const actionState = read("lib/customer/self-stamp-action-state.ts")

test("pending never renders an optimistic earned stamp", () => {
  assert.doesNotMatch(
    collector,
    /setArmed|armed/,
    "the old optimistic earned-stamp state must be removed"
  )
  assert.match(
    collector,
    /stampChoreographyView/,
    "the collector must derive card progress from the tested server-led state machine"
  )
  assert.match(
    choreography,
    /Checking today(?:&apos;|')s stamp/,
    "the request phase must use process language"
  )
})

test("the live transaction no longer shakes the interactive receipt", () => {
  assert.doesNotMatch(
    collector,
    /StampSlamSequence/,
    "the customer card must not move around its active control"
  )
  assert.doesNotMatch(
    pressButton,
    /WetInkBreathe/,
    "the actionable stamp target must not idle-scale"
  )
})

test("triggered Wet Ink primitives keep one host identity", () => {
  for (const primitive of ["WetInkSlam", "WetInkShake", "WetInkBreathe"]) {
    const start = wetInk.indexOf(`export function ${primitive}`)
    assert.notEqual(start, -1, `${primitive} must exist`)
    const nextExport = wetInk.indexOf("\nexport function ", start + 1)
    const body = wetInk.slice(start, nextExport === -1 ? undefined : nextExport)

    assert.doesNotMatch(
      body,
      /if\s*\(\s*!shouldAnimate\s*\|\|\s*!active\s*\)\s*\{?\s*return/,
      `${primitive} must not switch host elements when animation is inactive`
    )
  }
})

test("the route uses one atomic status channel and a reserved feedback band", () => {
  assert.match(collector, /aria-atomic="true"/)
  assert.equal(
    (collector.match(/role="status"/g) ?? []).length,
    1,
    "the collector owns exactly one live status region"
  )
  assert.match(
    collector,
    /data-stamp-status-band/,
    "feedback must replace content inside one reserved region"
  )
  assert.doesNotMatch(
    collector,
    /StatusBanner|RewardCelebration/,
    "visual aftermath must not add nested live regions"
  )
})

test("unexpected RPC outcomes stay unknown until authoritative readback", () => {
  assert.match(
    actionState,
    /\{\s*status:\s*"unknown"\s*\}/,
    "the action boundary needs a typed ambiguous outcome"
  )
  assert.match(
    action,
    /catch \(error\) \{[\s\S]*return unknownStamp\(\)/,
    "unexpected RPC failures must request readback instead of claiming rejection"
  )
  assert.doesNotMatch(
    action,
    /return fail\(blockReasonCopy\("unknown"\)\)/,
    "ambiguous writes must not be presented as definitely not added"
  )
})
