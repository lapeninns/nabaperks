import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { easings, wetInkTransition } from "@/lib/motion/tokens"

/**
 * Drift guard: lib/motion/tokens.ts is a deliberate hardcoded mirror of the
 * --w-dur-* / --w-ease* custom properties in app/globals.css (Framer needs
 * plain numbers). This test fails the moment the stylesheet and the mirror
 * disagree, so a timing change in one place cannot silently desync the other.
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

const globalsCss = readFileSync(
  path.join(projectRoot, "app", "globals.css"),
  "utf8"
)

function cssDurationSeconds(name) {
  const match = globalsCss.match(new RegExp(`${name}:\\s*(\\d+)ms`))
  assert.ok(match, `${name} must be defined in app/globals.css`)
  return Number(match[1]) / 1000
}

function cssBezier(name) {
  const match = globalsCss.match(
    new RegExp(`${name}:\\s*cubic-bezier\\(([^)]+)\\)`)
  )
  assert.ok(match, `${name} must be a cubic-bezier in app/globals.css`)
  return match[1].split(",").map((part) => Number(part.trim()))
}

test("Framer durations mirror the --w-dur-* custom properties", () => {
  const move = cssDurationSeconds("--w-dur-move")
  const slam = cssDurationSeconds("--w-dur-slam")
  const shake = cssDurationSeconds("--w-dur-shake")
  const press = cssDurationSeconds("--w-dur-press")

  assert.equal(wetInkTransition.move.duration, move)
  assert.equal(wetInkTransition.sheet.duration, move)
  assert.equal(wetInkTransition.rise.duration, move)
  assert.equal(wetInkTransition.slam.duration, slam)
  assert.equal(wetInkTransition.softStamp.duration, slam)
  assert.equal(wetInkTransition.shake.duration, shake)
  assert.equal(wetInkTransition.press.duration, press)
})

test("Framer easings mirror --w-ease and --w-ease-slam", () => {
  assert.deepEqual([...easings.standard], cssBezier("--w-ease"))
  assert.deepEqual([...easings.slam], cssBezier("--w-ease-slam"))

  assert.deepEqual([...wetInkTransition.move.ease], cssBezier("--w-ease"))
  assert.deepEqual([...wetInkTransition.rise.ease], cssBezier("--w-ease"))
  assert.deepEqual([...wetInkTransition.sheet.ease], cssBezier("--w-ease"))
  assert.deepEqual(
    [...wetInkTransition.slam.ease],
    cssBezier("--w-ease-slam")
  )
  assert.deepEqual(
    [...wetInkTransition.pop.ease],
    cssBezier("--w-ease-slam")
  )
})
