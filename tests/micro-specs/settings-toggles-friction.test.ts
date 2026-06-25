import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { marketingConsentRowState } from "@/lib/customer/experience/marketing-consent-row"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * Cluster `settings-toggles` of the customer-flow friction audit.
 *
 * F8 (feedback): flipping a marketing channel posted with no success affordance,
 * and the checkbox was uncontrolled (defaultChecked) — so on a FAILED save the
 * visible switch stayed where the customer left it while the message said it
 * failed (UI vs state contradiction). `marketingConsentRowState` is the pure
 * source of both the controlled checkbox value (reflected from server truth) and
 * the polite live-region text, kept out of the component so it can be triangulated.
 */
describe("marketingConsentRowState (consent feedback + control/state sync)", () => {
  it("reflects the standing value and says nothing before any save", () => {
    expect(
      marketingConsentRowState({
        channel: "email",
        optedIn: true,
        pending: false,
        state: {},
      })
    ).toEqual({ checked: true, message: "" })
  })

  it("announces a brief Saved once this row's save succeeds", () => {
    expect(
      marketingConsentRowState({
        channel: "email",
        optedIn: false,
        pending: false,
        state: { channel: "email", optedIn: true },
      })
    ).toEqual({ checked: true, message: "Saved" })
  })

  it("forces the switch back and warns when this row's save fails", () => {
    // The action returns the reverted (prior) value on failure, so control and
    // message agree: the customer asked to turn it on, it failed, switch shows off.
    expect(
      marketingConsentRowState({
        channel: "sms",
        optedIn: true,
        pending: false,
        state: { channel: "sms", optedIn: false, error: "We couldn't save…" },
      })
    ).toEqual({ checked: false, message: "Couldn't save — try again" })
  })

  it("ignores another row's result and keeps its own standing value", () => {
    // A different channel's action state must not leak into this row.
    expect(
      marketingConsentRowState({
        channel: "whatsapp",
        optedIn: true,
        pending: false,
        state: { channel: "email", optedIn: false },
      })
    ).toEqual({ checked: true, message: "" })
  })

  it("stays silent while this row's save is still in flight", () => {
    // No premature "Saved" mid-request; the standing value holds until resolved.
    expect(
      marketingConsentRowState({
        channel: "email",
        optedIn: false,
        pending: true,
        state: {},
      })
    ).toEqual({ checked: false, message: "" })
  })

  it("generalises rather than hardcoding a single channel/value", () => {
    expect(
      marketingConsentRowState({
        channel: "sms",
        optedIn: false,
        pending: false,
        state: { channel: "sms", optedIn: true },
      })
    ).toEqual({ checked: true, message: "Saved" })
  })
})

describe("settings toggles meet the 44px target (F5)", () => {
  const files = [
    "components/customer/profile-marketing-consent.tsx",
    "components/customer/push-notification-settings.tsx",
  ] as const

  for (const file of files) {
    it(`expands the toggle hit area to >=44px in ${file}`, () => {
      const source = readProjectFile(file)
      // The label is the tap target: 44px box with negative margin so the 20px
      // visual switch stays put and the row layout does not shift.
      expect(source).toContain("min-h-11")
      expect(source).toContain("min-w-11")
      expect(source).toContain("-m-3")
      expect(source).toContain("p-3")
      // The visible switch is still the 20px checkbox.
      expect(source).toContain("size-5")
    })
  }
})

describe("marketing consent feedback wiring (F8)", () => {
  const source = () =>
    readProjectFile("components/customer/profile-marketing-consent.tsx")

  it("drives a polite per-row live region from the helper", () => {
    const src = source()
    expect(src).toContain("marketingConsentRowState")
    expect(src).toContain('aria-live="polite"')
    expect(src).toContain('role="status"')
  })

  it("controls the checkbox from server truth instead of defaultChecked", () => {
    const src = source()
    // No longer uncontrolled: control and the failure message must agree.
    expect(src).not.toContain("defaultChecked")
    expect(src).toContain("checked={")
  })

  it("renders the helper's live-region message, not its own copy", () => {
    // The audited copy lives in the unit-tested helper (asserted above); the row
    // just renders {message}, so the component reads it from the helper result.
    const src = source()
    expect(src).toContain("{message}")
  })

  it("sources the audited confirmation and failure copy from the helper", () => {
    const helper = readProjectFile(
      "lib/customer/experience/marketing-consent-row.ts"
    )
    expect(helper).toContain('"Saved"')
    expect(helper).toContain('"Couldn\'t save — try again"')
  })
})
