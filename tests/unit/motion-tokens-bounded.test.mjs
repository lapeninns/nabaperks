import assert from "node:assert/strict"
import { test } from "node:test"

import { wetInkTransition } from "@/lib/motion/tokens"

/**
 * DESIGN.md § Motion: Wet Ink motion is one-shot. Nothing in the shared
 * transition tokens may sanction indefinite motion — an unbounded animation is
 * a WCAG 2.2.2 problem the moment a component honours it. The marquee's loop
 * is a CSS animation with its own pause affordance; it reads `duration` only.
 */
test("Given the Wet Ink transition tokens When read Then none sanctions indefinite repetition", () => {
  for (const [name, token] of Object.entries(wetInkTransition)) {
    assert.equal(
      Object.hasOwn(token, "repeat"),
      false,
      `wetInkTransition.${name} must not carry a repeat count`
    )
  }
})
