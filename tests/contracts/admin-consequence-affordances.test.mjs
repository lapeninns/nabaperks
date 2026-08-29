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

/**
 * The admin console's consequence language (UI audit ADM 04#19, 04#29, 04#41).
 *
 * Three of these were fixed and none was pinned, so nothing stopped the colour
 * system from telling the operator the opposite of the truth again: a
 * `destructive` silhouette on the reversible control, an irreversible one
 * behind no gate, or a warning wash that is a 15% tint of the same red as
 * danger. Each assertion below is the behaviour, not the styling — the
 * silhouette that means danger, the gate that means irreversible, and two
 * severity washes that are different hues.
 */

/** The body of a named function declaration, up to the next one. */
function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `${name} exists`)
  const next = source.indexOf("\nfunction ", start + 1)
  return source.slice(start, next === -1 ? source.length : next)
}

// 04#19: "Disable QR" is reversible and "Regenerate QR" invalidates every
// printed poster in the venue. The destructive silhouette belongs to the
// second, and the irreversibility gate with it.
test("Given the two QR record controls When source is inspected Then destructive weight and the confirm gate sit on the irreversible one", () => {
  const page = readProjectFile("app", "admin", "merchants", "page.tsx")

  const state = functionBody(page, "QrStateForm")
  const regenerate = functionBody(page, "RegenerateQrForm")

  assert.doesNotMatch(
    state,
    /variant="destructive"/,
    "the reversible enable/disable control must not wear the destructive silhouette"
  )
  assert.match(regenerate, /variant="destructive"/)
  assert.match(
    regenerate,
    /<AdminConfirmCheck/,
    "regenerating a printed poster QR keeps its irreversibility gate"
  )

  // Stopping every scan in a venue takes at least the friction that
  // cancelling one customer's reward takes: a reason AND a ticked consequence.
  assert.match(state, /<AdminConfirmCheck/)
  assert.match(state, /name="reason"\s+required/)
  assert.match(
    state,
    /scans stop immediately/i,
    "the disable gate states the consequence, not the mechanism"
  )
})

// 04#41: turning OFF two-factor is the most security-weakening action in the
// console. It used to be an `outline` button with no gate at all.
test("Given the admin MFA panel When two-factor is turned off Then the control is destructive and gated", () => {
  const panel = readProjectFile("components", "admin", "mfa-panel.tsx")

  const offControl = panel.slice(
    panel.indexOf("AdminConfirmCheck"),
    panel.indexOf("Turn off two-factor")
  )
  assert.notEqual(offControl.length, 0, "the opt-out control exists")
  assert.match(offControl, /variant="destructive"/)
  assert.match(panel, /<AdminConfirmCheck label="I understand admin sign-in/)
})

// 04#29: severity triage by scan is the entire point of the fraud page.
// `--primary` and `--destructive` are both red-orange, so a warning wash drawn
// from primary and a danger wash drawn from destructive were separable only by
// their glyph. Warning has to be a different HUE, not a lighter red.
test("Given the admin status pill When warning and danger render Then they are different hues, not two tints of red", () => {
  const support = readProjectFile("components", "admin", "support.tsx")

  const pill = support.slice(
    support.indexOf("export function StatusPill"),
    support.indexOf("export function formatAdminAction")
  )
  assert.notEqual(pill.length, 0, "StatusPill exists")

  const warning = /tone === "warning" && "([^"]+)"/.exec(pill)?.[1]
  const danger = /tone === "danger" && "([^"]+)"/.exec(pill)?.[1]
  assert.ok(warning && danger, "both severity tones are styled")
  assert.doesNotMatch(
    warning,
    /bg-primary/,
    "the warning wash must not be a tint of the same red as danger"
  )
  assert.match(warning, /bg-seal/, "warning takes the sun ink")
  assert.match(danger, /bg-destructive/)

  // Both tones keep a glyph, so hue is not the only channel (WCAG 1.4.1).
  assert.match(pill, /STATUS_PILL_ICON\[tone\]/)
})

// 04#33: every admin surface renders customer contact masked. The referral
// panel was the one that printed both parties' full addresses, at 12px.
test("Given the referral ops panel When contact renders Then both parties are masked", () => {
  const panel = readProjectFile(
    "app",
    "admin",
    "referrals",
    "referral-ops-panel.tsx"
  )

  for (const field of ["referrerEmail", "referredEmail"]) {
    // Rendered on both the desktop row and the phone card, masked in both.
    const masked = [
      ...panel.matchAll(
        new RegExp(`maskAdminContact\\(row\\.${field}\\)`, "g")
      ),
    ]
    assert.ok(
      masked.length >= 2,
      `${field} is masked on fewer surfaces than it is rendered on`
    )

    // Every other mention of the raw value may only be a presence test.
    const uses = [...panel.matchAll(new RegExp(`row\\.${field}`, "g"))]
    assert.ok(uses.length > masked.length, `${field} is guarded before it is read`)
    for (const use of uses) {
      const before = panel.slice(Math.max(0, use.index - 18), use.index)
      const after = panel.slice(use.index + use[0].length).trimStart()
      assert.ok(
        before.endsWith("maskAdminContact(") || after.startsWith("?"),
        `${field} reaches the page unmasked at index ${use.index}`
      )
    }
  }
})

// 04#39: the console's authenticator QR is the system's one QR treatment, not
// a look-alike. `QrFrame` takes `children: ReactNode`, so an <img> composes in
// it exactly as the marketing venue QR's <svg> does — the recorded reason for
// leaving it hand-rolled ("the frame API takes a matrix") was not true of the
// component.
test("Given the admin authenticator QR When it renders Then it composes through QrFrame rather than restating its classes", () => {
  const panel = readProjectFile("components", "admin", "mfa-panel.tsx")
  const frame = readProjectFile("components", "loyalty", "qr-frame.tsx")

  assert.match(frame, /children: ReactNode/, "QrFrame takes children, not a matrix")
  assert.match(panel, /<QrFrame label="Authenticator setup QR code"/)
  // The hand-rolled frame must not come back beside the real one.
  const image = panel.slice(panel.indexOf("<QrFrame"), panel.indexOf("</QrFrame>"))
  assert.doesNotMatch(
    image,
    /border-2 border-ink/,
    "the QR treatment is restated on the image instead of coming from QrFrame"
  )
  assert.match(image, /className="h-44 w-44"/, "the QR stays at least 176px")
})
