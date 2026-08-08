import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * Phase D customer production-polish structural contract
 * (ux-ui-production-polish-fixes P2 rows: CUS-P2-01..16, VCU-P2-01..06).
 *
 * Presentation-only pins: the money path's behaviour is untouched; these
 * assertions hold the P2 polish in place (honest receipt footers, one
 * headline, per-route titles, recovery actions on dead ends, contract inputs,
 * StatusBanner errors, width parity on max-w-customer, tap targets).
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

/**
 * Class-name assertions have to read the classes, not the prose about them.
 * `customer-qr-scanner.tsx` documents the variant it deliberately does NOT
 * use ("No `sm:grid-cols-2`: …"), so a naive doesNotMatch on the raw file
 * fails on its own comment. Strip comments first.
 */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

const VIEWPORT_VARIANT = /(?<![\w-])(?:sm|md|lg|xl):[a-z0-9[\]\-./%_]+/g

test("CUS-P2-01: the receipt footer never invents a card number", () => {
  const flowSystem = readProjectFile(
    "components",
    "customer",
    "customer-flow-system.tsx"
  )

  assert.doesNotMatch(flowSystem, /NP-0001/, "fake card number must be gone")
  assert.match(
    flowSystem,
    /\{footerLeft\}/,
    "footerLeft renders only when real"
  )
})

test("CUS-P2-02: the /q error states carry one headline and one description", () => {
  const page = readProjectFile("app", "q", "[qrId]", "page.tsx")

  // The shell no longer stacks a second level-1 headline above the receipt.
  assert.doesNotMatch(page, /title="Card unavailable"/)
  assert.doesNotMatch(page, /title="One moment"/)
  // The near-duplicate shell description is gone; the receipt keeps one.
  // Copy is centralised in lib/copy/product-copy — assert the wired constant.
  assert.doesNotMatch(page, /Ask the venue team for the current loyalty QR\./)
  assert.match(page, /ASK_TEAM_FOR_QR/)
  // Error receipts are honest: no mono footer pretending technical facts.
  const unavailable = page.slice(page.indexOf("function UnavailableQr"))
  assert.match(unavailable, /hideFooter/)
})

test("CUS-P2-03/05: customer entry surfaces set their own tab title", () => {
  const pages = [
    ["app", "q", "[qrId]", "page.tsx"],
    ["app", "m", "[merchantSlug]", "page.tsx"],
    ["app", "m", "[merchantSlug]", "join", "page.tsx"],
    ["app", "card", "[membershipId]", "page.tsx"],
    ["app", "card", "[membershipId]", "stamp", "page.tsx"],
    ["app", "reward", "[rewardId]", "page.tsx"],
  ]

  for (const segments of pages) {
    const source = readProjectFile(...segments)
    assert.match(
      source,
      /\.\.\.PRIVATE_ROUTE_METADATA,\s*title:\s*"/,
      `${segments.join("/")} must set a customer title`
    )
  }
})

test("CUS-P2-04: unavailable venue states offer the shared recovery actions", () => {
  const recovery = readProjectFile(
    "components",
    "customer",
    "unavailable-recovery.tsx"
  )
  assert.match(recovery, /href="\/scan"/)
  assert.match(recovery, /href="\/home"/)

  for (const segments of [
    ["app", "m", "[merchantSlug]", "page.tsx"],
    ["components", "customer", "join-wizard.tsx"],
    ["app", "q", "[qrId]", "page.tsx"],
  ]) {
    assert.match(
      readProjectFile(...segments),
      /UnavailableRecoveryActions/,
      `${segments.join("/")} must reuse the shared recovery block`
    )
  }
})

test("CUS-P2-06: customer inputs sit on the contract ink-well (10px radius, card bg, hard focus ring)", () => {
  const inputClass = readProjectFile("components", "customer", "input-class.ts")

  assert.match(inputClass, /rounded-lg/)
  assert.match(inputClass, /bg-card/)
  assert.match(inputClass, /focus-ring/)
  assert.match(inputClass, /text-base/)
  assert.match(inputClass, /md:text-sm/)
  assert.doesNotMatch(inputClass, /rounded-xl/)
  assert.doesNotMatch(inputClass, /bg-secondary\/60/)
  assert.doesNotMatch(
    inputClass,
    /focus:(border|ring)/,
    "focus styles route through .focus-ring (focus-visible), not :focus"
  )
})

test("CUS-P2-07: money-path form errors use StatusBanner, not hand-rolled 1px banners", () => {
  for (const file of [
    "join-forms.tsx",
    "join-otp-form.tsx",
    "customer-login-form.tsx",
  ]) {
    const source = readProjectFile("components", "customer", file)
    assert.doesNotMatch(
      source,
      /border-destructive\/30/,
      `${file} must not hand-roll error banners`
    )
    assert.match(
      source,
      /StatusBanner[\s\S]{0,80}tone="error"/,
      `${file} must use the Wet Ink error banner`
    )
  }
})

test("CUS-P2-07b: the login OTP-sent confirmation uses the shared success face", () => {
  const form = readProjectFile(
    "components",
    "customer",
    "customer-login-form.tsx"
  )
  const banner = readProjectFile("components", "loyalty", "status-banner.tsx")

  // The confirmation is StatusBanner tone="success", not a hand-rolled box.
  assert.match(
    form,
    /<StatusBanner tone="success" title=\{state\.message\}>/,
    "the OTP-sent confirmation must use StatusBanner tone=success"
  )
  assert.doesNotMatch(
    form,
    /border-reward\/30|bg-reward\/12/,
    "no hand-rolled success box may return to the login form"
  )
  // Why that is safe: "we sent your code" must stay POLITE. StatusBanner
  // derives its announcement from tone, and success resolves to role="status".
  // If that mapping is ever changed to alert, this login confirmation starts
  // interrupting screen readers, so pin the mapping here too (05#28).
  assert.match(
    banner,
    /toneRole: Record<StatusBannerTone, "alert" \| "status"> = \{\s*\n\s*success: "status",/,
    "StatusBanner success must announce politely, not assertively"
  )
})

test("CUS 02#6: nothing inside the 410px customer column responds to viewport width", () => {
  // The column is capped at 410px (max-w-customer), so a `sm:` variant on
  // anything INSIDE it fires on a screen size the column never reaches: the
  // phone gets the small value and a desktop browser showing the same 410px
  // column gets the large one. Content files therefore carry no viewport
  // variants at all.
  const contentFiles = [
    ["components", "customer", "customer-qr-scanner.tsx"],
    ["components", "customer", "customer-qr-scanner-loader.tsx"],
    ["components", "customer", "offer-pass-qr.tsx"],
    ["components", "customer", "customer-card-experience.tsx"],
    ["components", "customer", "reward-collection-qr.tsx"],
    ["components", "loyalty", "reward-ticket.tsx"],
  ]

  for (const segments of contentFiles) {
    const live = withoutComments(readProjectFile(...segments)).match(
      VIEWPORT_VARIANT
    )
    assert.equal(
      live,
      null,
      `${segments.join("/")} must not scale on viewport inside a capped column (found ${live?.join(", ")})`
    )
  }

  // The two scanner surfaces must agree: the loader kept `sm:grid-cols-2`
  // after the loaded scanner dropped it, so above 640px the fallback drew two
  // 173px buttons and the loaded state then re-stacked them to 358px — a
  // first-paint jump in the one place a comment promised parity.
  for (const file of [
    "customer-qr-scanner.tsx",
    "customer-qr-scanner-loader.tsx",
  ]) {
    assert.doesNotMatch(
      withoutComments(readProjectFile("components", "customer", file)),
      /grid-cols-2/,
      `${file} exits must stack at every width`
    )
  }

  // The shells are the exception and must stay the exception: their viewport
  // variants are page-edge gutters and page top/bottom padding, which respond
  // to the SCREEN, not the column. Anything else there is the same defect.
  const shellFiles = [
    ["components", "layout", "customer-shell.tsx"],
    ["components", "layout", "customer-app-shell.tsx"],
    ["components", "customer", "customer-flow-system.tsx"],
    ["components", "customer", "loading-skeletons.tsx"],
  ]

  for (const segments of shellFiles) {
    const live = withoutComments(readProjectFile(...segments)).match(
      VIEWPORT_VARIANT
    )
    for (const variant of live ?? []) {
      assert.match(
        variant,
        /^sm:(px|pt|pb)-/,
        `${segments.join("/")} may only scale page padding on viewport, found ${variant}`
      )
    }
  }
})

test("CUS-P2-08: logged-out card access asks for the action the button performs", () => {
  const derive = readProjectFile("lib", "customer", "experience", "derive.ts")

  assert.match(derive, /Sign in with your number to open this card\./)
  assert.doesNotMatch(derive, /Verify your identity from the venue QR/)
})

test("CUS-P2-09: the reward support line matches the state it renders over", () => {
  const copy = readProjectFile("lib", "customer", "experience", "copy.ts")

  assert.doesNotMatch(
    copy,
    / - show this at the counter when ready\./,
    "spaced-hyphen counter line must not render on the waiting state"
  )
  assert.match(copy, /Unlocked — yours from/)
  assert.match(copy, /— show this at the counter\./)
})

test("CUS-P2-10: redemption-gate resend links meet the tap-size contract", () => {
  for (const file of ["profile-gate-forms.tsx", "profile-about-you.tsx"]) {
    const source = readProjectFile("components", "customer", file)
    assert.doesNotMatch(
      source,
      /size="xs"/,
      `${file} gate links must be at least size="sm"`
    )
  }
})

test("CUS-P2-10A: profile email verification does not auto-zoom the mobile viewport", () => {
  const source = readProjectFile(
    "components",
    "customer",
    "profile-about-you.tsx"
  )

  assert.doesNotMatch(
    source,
    /id="home-profile-otp"[\s\S]{0,220}autoFocus/,
    "the profile OTP must wait for user focus so iOS does not magnify the viewport"
  )
})

test("CUS-P2-11: the scanner intro speaks barista, not system", () => {
  const scanner = readProjectFile(
    "components",
    "customer",
    "customer-qr-scanner.tsx"
  )

  assert.doesNotMatch(scanner, /existing QR flow/)
  assert.doesNotMatch(scanner, /OTP checks/)
  // \s+ tolerates the JSX line wrap; the rendered sentence is one line.
  assert.match(scanner, /No\s+app, no plastic\./)
})

test("CUS-P2-12/16: one customer journey, one column width (max-w-customer)", () => {
  const widthFiles = [
    ["components", "layout", "customer-shell.tsx"],
    ["components", "layout", "customer-app-shell.tsx"],
    ["components", "layout", "customer-tab-bar.tsx"],
    ["components", "customer", "customer-flow-system.tsx"],
    ["components", "customer", "loading-skeletons.tsx"],
  ]

  for (const segments of widthFiles) {
    const source = readProjectFile(...segments)
    assert.match(
      source,
      /max-w-customer/,
      `${segments.join("/")} must use the 410px customer token`
    )
    assert.doesNotMatch(
      source,
      /max-w-\[410px\]/,
      `${segments.join("/")} must not hardcode 410px`
    )
  }

  assert.doesNotMatch(
    readProjectFile("components", "layout", "customer-shell.tsx"),
    /max-w-sm/
  )
  for (const file of ["customer-app-shell.tsx", "customer-tab-bar.tsx"]) {
    assert.doesNotMatch(
      readProjectFile("components", "layout", file),
      /max-w-md/
    )
  }
})

test("CUS-P2-14: the authed header Log out meets the 44px contract", () => {
  const shell = readProjectFile(
    "components",
    "layout",
    "customer-app-shell.tsx"
  )

  assert.doesNotMatch(shell, /size="sm"/)
})

test("VCU-P2-01: the login screen says My Nabaperks once", () => {
  const login = readProjectFile("app", "home", "login", "page.tsx")

  assert.doesNotMatch(login, /<Eyebrow>My Nabaperks<\/Eyebrow>/)
  assert.match(login, /caption="My Nabaperks"/)
})

test("VCU-P2-02/03: the venue preview uses the q-valid journey treatment (inline patch, venue stamps)", () => {
  const venuePage = readProjectFile("app", "m", "[merchantSlug]", "page.tsx")

  assert.match(
    venuePage,
    /<StampJourneyPreview[\s\S]{0,200}venueName=/,
    "venue preview must pass venueName like the join welcome step"
  )
  assert.doesNotMatch(
    venuePage,
    /<StampJourneyPreview[\s\S]{0,200}compact/,
    "compact preview wraps the reward patch to an orphan row at 375"
  )
})

test("VCU-P2-05/06: the unavailable card panel is compact and leads with a primary action", () => {
  const experience = readProjectFile(
    "components",
    "customer",
    "customer-card-experience.tsx"
  )
  const panel = experience.slice(
    experience.indexOf("function UnavailablePanel")
  )

  // The receipt drops the fake mono footer and the banner duplicating the
  // shell headline, so the sole CTA clears the tab bar on first paint.
  assert.match(panel, /hideFooter/)
  assert.doesNotMatch(panel, /StatusBanner title="Card unavailable"/)
  // The page's only action is the primary, not a stalled secondary.
  assert.doesNotMatch(
    panel,
    /PrimaryLink action=\{vm\.primaryAction\} variant="secondary"/
  )
})
