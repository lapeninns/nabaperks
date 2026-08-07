import { expect, test, type Page } from "@playwright/test"

import {
  dismissPwaInstall,
  gotoHydratedPage,
  HARNESS_ROUTES,
} from "./helpers/harness"

/**
 * The Old Crown offer journey, walked in the order the specification sets it
 * out, against the DB-free harness lane.
 *
 * What this tier can and cannot prove is stated in each test rather than left
 * to the reader. The harness mounts the real surfaces against static fixtures,
 * so it proves what a customer and a member of staff SEE and can REACH at every
 * step. It writes nothing, so the transactional half of the journey is proved
 * at the database tier instead, and nothing here is written so as to look like
 * a proof of something it does not exercise. Specifically:
 *
 *   * publishing — "one scan claims atomically: membership, bonus stamps and
 *     the pass" (tests/db/offer-campaigns.test.mjs);
 *   * a repeat scan of the campaign QR — "a re-scan awards nothing and hands
 *     back the existing card and pass";
 *   * an existing digital member — "an existing member is refused, and nothing
 *     at all is written";
 *   * the same-day venue QR — "the bonus grant leaves the customer's earned
 *     business day free";
 *   * repeated redemption from fresh codes — "one token redeems once, but the
 *     pass allows unlimited uses" (tests/db/offer-pass-redemption.test.mjs).
 *
 * Step five into step six is the order that matters most. A redeemable stamp
 * reward takes the whole home tile over and points it at the reward, so the
 * discount pass has to carry its own way through to its code from outside that
 * link. Walking the journey the other way round — redeeming the pass before the
 * card is finished — would never meet the case at all.
 *
 * The creator rewrites the address bar to /app/offers/new after hydration, so
 * every step is reached with its own navigation and never with a reload.
 */

const OFFERS = HARNESS_ROUTES.offers

/**
 * Land on a surface, hydrated, at the URL that was asked for.
 *
 * Exactly one call per test, which is how every other harness spec in this
 * repository is written and not an accident: a second full navigation inside
 * one browser context puts the dev server's Fast Refresh client into a reload
 * loop on Firefox. That is not specific to this lane — it reproduces on the
 * announcements and QR lanes just as readily — so each step of the journey gets
 * its own test rather than a work-around.
 *
 * The retry covers the single extra reload the dev server performs the first
 * time it compiles a route, and the URL assertion catches the creator, which
 * would otherwise take the address bar to `/app/offers/new`.
 */
async function gotoSurface(page: Page, query: string): Promise<void> {
  const path = `${OFFERS}${query}`

  await expect(async () => {
    const response = await gotoHydratedPage(page, path)
    expect(response?.status() ?? 500).toBeLessThan(400)
  }).toPass({ timeout: 45_000 })

  // The creator would otherwise take the address bar to /app/offers/new.
  await expect(page).toHaveURL(new RegExp(`${escapeForRegExp(path)}$`))
}

export function describeOfferCampaignJourney(): void {
  test.describe("offer campaign journey @offer-campaign", () => {
    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("Step 1a — Given the creator's first step When it renders Then the three benefit presets are the whole choice", async ({
      page,
    }) => {
      await gotoSurface(page, "?surface=creator&step=benefits")

      const presets = page.getByRole("radiogroup", { name: "Offer benefit" })
      await expect(presets).toContainText("Welcome stamps")
      await expect(presets).toContainText("Discount pass")
      await expect(presets).toContainText("Welcome stamps and a discount pass")
    })

    test("Step 1b — Given the creator's second step When it renders Then every rule the merchant is about to freeze is on the page", async ({
      page,
    }) => {
      await gotoSurface(page, "?surface=creator&step=rules")

      // By id: "Welcome stamps" is also a benefit preset label on the hidden
      // first step, so the field is addressed the way the form declares it.
      await expect(page.locator("#name")).toBeVisible()
      await expect(page.locator("#customerDescription")).toBeVisible()
      await expect(page.locator("#bonusStampCount")).toBeVisible()
      await expect(page.locator("#discountPercent")).toBeVisible()
      await expect(page.locator("#startsOn")).toBeVisible()
      await expect(page.locator("#endsOn")).toBeVisible()
      await expect(page.locator("#extraTerms")).toBeVisible()
      // The no-stacking rule is not a field: it is printed as always included.
      await expect(page.getByText("Always included")).toBeVisible()
    })

    test("Step 1b — Given a future opening date When the closing date is chosen Then its 366-day window follows that opening date", async ({
      page,
    }) => {
      await gotoSurface(page, "?surface=creator&step=rules")

      const opens = page.locator("#startsOn")
      const closes = page.locator("#endsOn")
      await opens.fill("2026-09-01")

      await expect(closes).toHaveAttribute("max", "2027-09-01")
      await closes.fill("2027-08-31")
      await expect(closes).toHaveValue("2027-08-31")
    })

    test("Step 1c — Given the creator's review step When the 2-stamp plus 10% offer is read back Then the promise is complete before anything is published", async ({
      page,
    }) => {
      await gotoSurface(page, "?surface=creator&step=review")

      const rules = page.getByRole("region", { name: "Offer rules" })
      await expect(rules).toContainText("2 of the 3 needed for a reward")
      await expect(rules).toContainText(
        "10% off the whole bill, as often as they like while the offer runs"
      )
      await expect(rules).toContainText("Staff check photo ID")
      await expect(
        page.getByRole("button", { name: "Publish now" })
      ).toBeVisible()
      // Publishing is a real server action that proves a merchant session, so
      // the harness reads this screen and the database tier proves the write.
    })

    test("Step 2 — Given a new customer When they land on the offer link Then they are promised two stamps and a pass, and the claimed card shows 2 of 3", async ({
      page,
    }) => {
      await gotoSurface(page, "?surface=customer")

      const landing = page.locator("#landing-available")
      await expect(landing).toContainText("Old Crown Girton")
      await expect(landing).toContainText(
        "2 bonus stamps and 10% off to start with"
      )
      await expect(landing).toContainText(
        "2 bonus stamps added to your card the moment you join"
      )
      await expect(landing).toContainText(
        "A 10% discount pass you can use as often as you like"
      )
      await expect(
        landing.getByRole("button", { name: "Claim this offer" })
      ).toBeVisible()

      const rail = page.locator("#pass-rail")
      // Offer stamps carry a NULL business date, so claiming does not spend the
      // customer's earned day — the card still reports a stamp is available.
      await expect(
        rail.getByRole("list", { name: "2 of 3 stamps earned" }).first()
      ).toBeVisible()
      await expect(rail).toContainText("2 of 3 stamps — 1 more to unlock")
      await expect(
        rail.getByText("10% off at Old Crown Girton").first()
      ).toBeVisible()
    })

    test("Step 4 — Given someone who already holds the card When they open the offer link Then they are told plainly and sent to the card they have", async ({
      page,
    }) => {
      await gotoSurface(page, "?surface=customer")

      const recovery = page.locator("#landing-recovery")
      await expect(recovery).toContainText("You are already a member here")
      await expect(recovery).toContainText(
        "This offer is a welcome for people joining for the first time"
      )
      await expect(
        recovery.getByRole("link", { name: "Open your card" })
      ).toBeVisible()
    })

    test("Step 5 into 6 — Given the venue QR has completed the card When the reward takes the tile over Then the pass still carries its own way through to its code", async ({
      page,
    }) => {
      await gotoSurface(page, "?surface=customer")

      const rail = page.locator("#pass-rail")
      const rewardTile = rail
        .getByRole("link", { name: "Open your Old Crown Girton card" })
        .nth(1)

      // The completed card takes the whole tile to the reward, not to the card.
      await expect(rewardTile).toHaveAttribute("href", /^\/reward\//)

      // So the pass chip must carry its own destination, and that destination
      // must not be nested inside the tile's link — a link inside a link is
      // invalid and unreachable.
      const passLinks = rail.getByRole("link", { name: "Show pass QR" })
      await expect(passLinks).toHaveCount(2)
      await expect(passLinks.first()).toHaveAttribute("href", /^\/pass\//)
      await expect(rail.locator("a a")).toHaveCount(0)

      // A pass the venue cannot honour keeps its chip and offers no code at all.
      await expect(rail).toContainText("Not available just now")
    })

    test("Step 6 — Given a scanned pass When staff are asked to confirm Then both attestations are demanded and no bill amount is asked for", async ({
      page,
    }) => {
      await gotoSurface(page, "?surface=staff")

      const ready = page.locator("#scan-ready")
      await expect(ready).toContainText("Ready to redeem")
      await expect(
        ready.getByLabel("I have checked the member's photo ID.")
      ).toBeVisible()
      await expect(
        ready.getByLabel(
          "I have checked this discount is not being used with another reward or offer."
        )
      ).toBeVisible()
      await expect(
        ready.getByRole("button", { name: "Apply 10% off" })
      ).toBeVisible()

      // Nothing on this screen asks what the bill came to, and nothing prints a
      // number that reads as a phone number.
      await expect(ready.getByText(/bill amount/i)).toHaveCount(0)
      await expect(ready.getByText(/\+?\d{7,}/)).toHaveCount(0)
    })

    test("Step 6 — Given a code that has already been used When staff scan it Then the pass itself is reported as still working", async ({
      page,
    }) => {
      await gotoSurface(page, "?surface=staff")

      const redeemed = page.locator("#scan-redeemed")
      await expect(redeemed).toContainText("Code already used")
      // The single-use thing is the code, never the pass: this is what makes
      // repeated redemption from fresh codes the expected behaviour.
      await expect(redeemed).toContainText(
        "The pass itself still works — ask the member to show a fresh code from their pass."
      )
      await expect(redeemed.getByRole("button", { name: /Apply/ })).toHaveCount(
        0
      )

      const expired = page.locator("#scan-expired")
      await expect(expired).toContainText("Code expired")
      await expect(expired).toContainText(
        "Ask the member to show their pass again for a fresh code."
      )

      const unauthorized = page.locator("#scan-unauthorized")
      await expect(unauthorized).toContainText("Pass not matched")
      await expect(unauthorized).toContainText(
        "This pass belongs to another venue."
      )
    })

    test("Step 7 — Given a paused, ended, not-yet-open or replaced link When a customer opens it Then each says something different and true", async ({
      page,
    }) => {
      await gotoSurface(page, "?surface=customer")

      const recovery = page.locator("#landing-recovery")
      // A campaign that has not opened is never reported as finished.
      await expect(recovery).toContainText(
        "This offer opens on 1 September 2026"
      )
      await expect(recovery).toContainText("This offer is paused just now")
      await expect(recovery).toContainText("This offer has finished")
      await expect(recovery).toContainText("This offer link is not available")
      await expect(recovery).toContainText(
        "the venue may have replaced the code"
      )

      // And the held pass says the same four things in its own voice.
      const faces = page.locator("#pass-faces")
      await expect(faces).toContainText("Ready to use")
      await expect(faces).toContainText("Opens soon")
      await expect(faces).toContainText("Finished")
      await expect(faces).toContainText("Withdrawn")
    })

    test("Given the merchant desk When each lifecycle state renders Then it says what it stops and what it does not", async ({
      page,
    }) => {
      await gotoSurface(page, "?surface=desk")

      await expect(page.locator("#desk-empty")).toContainText(
        "No offer running"
      )

      const draft = page.locator("#desk-draft")
      await expect(draft).toContainText("Nobody can claim this yet")
      // A draft has nothing to share yet, so the panel skips the Share tab
      // and opens on Manage and its publish flow.
      await expect(draft.getByRole("tab", { name: "Share" })).toHaveCount(0)
      await expect(
        draft.getByRole("button", { name: "Publish this offer" })
      ).toBeVisible()

      await expect(page.locator("#desk-scheduled")).toContainText("Scheduled")

      const live = page.locator("#desk-live")
      await expect(live).toContainText("Live")
      // A live offer opens on Share; the recorded counts are one tab away.
      await expect(live.getByRole("tab", { name: "Share" })).toHaveAttribute(
        "aria-selected",
        "true"
      )
      await live.getByRole("tab", { name: "Results" }).click()
      await expect(live).toContainText("Link opened")

      const paused = page.locator("#desk-paused")
      await expect(paused).toContainText("No new claims")
      // Pausing is the product control and never cancels an issued pass.
      await expect(paused).toContainText(
        "Passes already issued keep working until their own end date."
      )

      await expect(page.locator("#desk-ended")).toContainText("Ended")

      const errored = page.locator("#desk-error")
      await expect(errored).toContainText(
        "The campaign link couldn't be prepared."
      )
      // The desk shows a link the landing page would accept, or none at all.
      await expect(errored).toContainText("Your link needs replacing")
    })

    test("Given every merchant-authored field at its maximum length When the desk renders Then the whole of it is on the page", async ({
      page,
    }) => {
      await gotoSurface(page, "?surface=desk")

      const longCopy = page.locator("#desk-long-copy")
      // The three maximums the database enforces, read back in full. The
      // description and the terms sit on the Manage tab — a live offer opens
      // on Share — so the tab is opened the way a merchant would open it.
      await expect(longCopy).toContainText(LONGEST_NAME)
      await longCopy.getByRole("tab", { name: "Manage" }).click()
      await expect(longCopy).toContainText(LONGEST_DESCRIPTION_TAIL)
      await expect(longCopy).toContainText(LONGEST_TERMS_TAIL)
    })
  })

  describeOfferCampaignBreakpoints()
}

/**
 * The same surfaces at the three widths the QA matrix names. Long copy is the
 * hard case at every one of them: a 60-character name beside a status tag at
 * 375, a 160-character description in a two-column review at 768, and 500
 * characters of terms in a sticky preview column at 1280.
 */
function describeOfferCampaignBreakpoints(): void {
  for (const breakpoint of BREAKPOINTS) {
    test.describe(`offer campaign layout at ${breakpoint.label} @offer-campaign`, () => {
      test.use({
        viewport: { width: breakpoint.width, height: breakpoint.height },
      })

      test.beforeEach(async ({ page }) => {
        await dismissPwaInstall(page)
      })

      for (const surface of SURFACE_CHECKS) {
        test(`Given ${surface.label} at ${breakpoint.label} When it renders Then the longest copy is readable and the page does not scroll sideways`, async ({
          page,
        }) => {
          await gotoSurface(page, surface.query)
          // Content that moved behind a panel tab is reached the same way a
          // merchant reaches it before it is read back.
          if (surface.openTab) {
            await page
              .locator(surface.longestCopy)
              .getByRole("tab", { name: surface.openTab })
              .click()
          }
          await expect(page.locator(surface.longestCopy)).toContainText(
            surface.expected
          )
          await expectNoSidewaysScroll(page)
        })
      }
    })
  }
}

const BREAKPOINTS = [
  { label: "375px", width: 375, height: 812 },
  { label: "768px", width: 768, height: 1024 },
  { label: "1280px", width: 1280, height: 900 },
] as const

/** Exactly the 60 characters offer_campaigns.name allows. */
const LONGEST_NAME =
  "A midsummer welcome for new regulars at the Old Crown Girton"

/** The tail of the 160-character customer description. */
const LONGEST_DESCRIPTION_TAIL = "while the summer offer is still running."

/** The tail of the 500 characters of additional terms. */
const LONGEST_TERMS_TAIL =
  "Please be patient with the team on a busy night. Thank you"

type SurfaceCheck = {
  readonly label: string
  readonly query: string
  readonly longestCopy: string
  readonly expected: string
  /** A panel tab to open before the copy is read (the desk defaults to Share). */
  readonly openTab?: string
}

const SURFACE_CHECKS: readonly SurfaceCheck[] = [
  {
    label: "the merchant desk",
    query: "?surface=desk",
    longestCopy: "#desk-long-copy",
    expected: LONGEST_TERMS_TAIL,
    openTab: "Manage",
  },
  {
    label: "the creator's review step",
    query: "?surface=creator&step=review",
    longestCopy: "#creator-review",
    expected: LONGEST_NAME,
  },
  {
    label: "the customer landing and pass",
    query: "?surface=customer",
    longestCopy: "#landing-long-copy",
    expected: LONGEST_TERMS_TAIL,
  },
  {
    label: "the staff redemption screen",
    query: "?surface=staff",
    longestCopy: "#scan-long-copy",
    expected: LONGEST_TERMS_TAIL,
  },
]

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Wide content must scroll inside its own container, never take the document
 * with it. One pixel of slack absorbs sub-pixel layout rounding.
 */
async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  )
  expect(overflow).toBeLessThanOrEqual(1)
}
