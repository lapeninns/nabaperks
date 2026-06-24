import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { retryButtonState } from "@/lib/customer/experience/retry-button"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * F16: the customer error boundary's "Try again" tap fired `reset()` with no
 * pending feedback, so a slow or re-failing retry felt dead. `retryButtonState`
 * is the pure source of the button's label + disabled flag, so the in-flight
 * retry reads as busy rather than ignored.
 */
describe("retryButtonState (pending feedback for the error-boundary retry)", () => {
  it("shows the resting retry label and stays enabled when idle", () => {
    expect(retryButtonState(false)).toEqual({
      label: "Try again",
      disabled: false,
    })
  })

  it("swaps to the busy label and disables while the retry is pending", () => {
    expect(retryButtonState(true)).toEqual({
      label: "Trying again",
      disabled: true,
    })
  })
})

describe("CustomerErrorState retry wiring", () => {
  it("drives the retry through a transition so the tap shows a pending state", () => {
    const source = readProjectFile(
      "components/customer/customer-error-state.tsx"
    )
    // The retry runs inside a transition rather than calling reset() raw.
    expect(source).toContain("useTransition")
    expect(source).toContain("startTransition")
    // The button reflects the pending state from the shared helper.
    expect(source).toContain("retryButtonState")
    expect(source).toContain("isPending")
    expect(source).toContain("disabled={")
  })
})
