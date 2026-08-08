import { expect, test, type Locator } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

export function describeMerchantAnnouncements() {
  test.describe("merchant announcements @merchant-announcements", () => {
    test("Given an eligible audience When an announcement is sent Then queued and skipped counts are shown", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await page.goto(HARNESS_ROUTES.announcements)

      const composer = page.getByRole("region", {
        name: "Announcement composer",
        exact: true,
      })

      await expect(composer).toContainText(
        "About 18 of your 24 members can receive this."
      )
      await expect(composer).toContainText("Daily announcements 0/2")
      await fillReadyAnnouncementDraft(composer, {
        title: "Rainy lunch",
        body: "Warm pies and cask ale are ready from noon today.",
      })

      await composer.getByRole("button", { name: /Send announcement/ }).click()

      await expect(composer.getByText("Announcement queued")).toBeVisible()
      await expect(composer).toContainText("Daily announcements 1/2")
      await expect(composer).toContainText("Queued for 14 members.")
      await expect(composer).toContainText(
        "4 were skipped because this announcement was already queued for them."
      )
    })

    test("Given the API rate-limits a send When the form returns 429 Then daily copy is shown", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await page.goto(HARNESS_ROUTES.announcements)

      const composer = page.getByRole("region", {
        name: "Announcement composer",
        exact: true,
      })

      await fillReadyAnnouncementDraft(composer, {
        title: "Rate limit",
        body: "This fixture returns a rate-limit response from the harness.",
      })
      await composer.getByRole("button", { name: /Send announcement/ }).click()

      await expect(composer.getByText("Daily limit reached")).toBeVisible()
      await expect(composer).toContainText("up to 2 a day")
      await expect(composer).toContainText("Daily announcements 2/2")
    })

    test("Given the API rejects copy When moderation fails Then plain guidance is shown", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await page.goto(HARNESS_ROUTES.announcements)

      const composer = page.getByRole("region", {
        name: "Announcement composer",
        exact: true,
      })

      await fillReadyAnnouncementDraft(composer, {
        title: "Moderation",
        body: "This fixture returns a moderation response from the harness.",
      })
      await composer.getByRole("button", { name: /Send announcement/ }).click()

      await expect(composer.getByText("Check the wording")).toBeVisible()
      await expect(composer).toContainText("plain venue update")
    })

    test("Given no members are eligible When the compose page renders Then submit is disabled", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await page.goto(HARNESS_ROUTES.announcements)

      const emptyComposer = page.getByRole("region", {
        name: "Empty announcement composer",
        exact: true,
      })

      await expect(
        emptyComposer.getByText("No members can receive this yet")
      ).toBeVisible()
      await expect(
        emptyComposer.getByRole("button", { name: /Send announcement/ })
      ).toBeDisabled()
    })

    test("Given a paste longer than the limit When maxLength trims it Then the loss is named", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await page.goto(HARNESS_ROUTES.announcements)

      const composer = page.getByRole("region", {
        name: "Announcement composer",
        exact: true,
      })
      const body = composer.getByLabel("Announcement body")
      const notice = composer.getByText(/characters? w(?:as|ere) removed/)

      // A paste with room to land says nothing.
      await body.fill("a".repeat(100))
      await pasteInto(body, "b".repeat(20))
      await expect(notice).toHaveCount(0)

      // A paste that overflows names exactly what the field dropped. Before
      // this, `maxLength` swallowed the tail with no event and no message
      // (03#55) — and the contract pins `maxLength`, so the limit stays hard
      // and only the silence goes.
      await body.fill("a".repeat(180))
      await pasteInto(body, "b".repeat(70))
      await expect(notice).toHaveText(
        "70 characters were removed to fit the 180-character limit. Edit the text to keep what matters."
      )
      await expect(body).toHaveAttribute(
        "aria-describedby",
        /-body-count .*-body-trimmed/
      )

      // Editing back under the ceiling retires the notice, so it can never
      // outlive the text it describes.
      await body.press("Backspace")
      await expect(notice).toHaveCount(0)

      // The title carries the same wiring at its own 80-character limit, and
      // a one-character loss reads as one character.
      const title = composer.getByLabel("Announcement title")
      await title.fill("t".repeat(80))
      await pasteInto(title, "u")
      await expect(notice).toHaveText(
        "1 character was removed to fit the 80-character limit. Edit the text to keep what matters."
      )
    })

    test("Given a template chip When it is clicked Then the fields prefill and nothing is sent", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await page.goto(HARNESS_ROUTES.announcements)

      const composer = page.getByRole("region", {
        name: "Announcement composer",
        exact: true,
      })

      await composer.getByRole("button", { name: "Quiz night" }).click()

      await expect(composer.getByLabel("Announcement title")).toHaveValue(
        "Quiz night is back this week"
      )
      await expect(composer.getByLabel("Announcement body")).toHaveValue(
        /Bring a team and play for the top table\./
      )
      // Prefill only: tapping a template must not send.
      await expect(composer.getByText("Announcement queued")).toHaveCount(0)
    })
  })
}

/**
 * Dispatch a real `paste` at the field with a synthetic clipboard payload.
 *
 * `context.grantPermissions(["clipboard-write"])` is Chromium-only, and this
 * flow runs on four projects, so the clipboard is built in-page instead. The
 * browser's own `maxLength` truncation is not what this asserts — that is a
 * platform guarantee — the assertion is that the component measures and names
 * the loss the truncation causes.
 *
 * A dispatched event is untrusted, so it performs no default insertion. Each
 * case therefore fills the field to the length the real truncation would leave
 * and asserts the count the component derives from the clipboard payload. The
 * end-to-end path (real Cmd+V of 250 characters into the 180-character body,
 * value truncated to 180, notice reading "70 characters were removed") was
 * measured in Chromium with `clipboard-write` granted; that permission name is
 * Chromium-only, which is why it is not the assertion here.
 */
async function pasteInto(field: Locator, text: string): Promise<void> {
  await field.evaluate((element, value) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData("text/plain", value)
    const event = new ClipboardEvent("paste", {
      clipboardData,
      bubbles: true,
      cancelable: true,
    })

    // Firefox ignores the `clipboardData` init member and leaves the property
    // null, so a constructed event alone silently tests nothing there. Attach
    // it directly when the constructor dropped it. (Real Firefox pastes do
    // carry clipboardData; only the synthetic constructor does not.)
    if (event.clipboardData !== clipboardData) {
      Object.defineProperty(event, "clipboardData", { value: clipboardData })
    }

    element.dispatchEvent(event)
  }, text)
}

async function fillReadyAnnouncementDraft(
  composer: Locator,
  copy: { readonly title: string; readonly body: string }
): Promise<void> {
  const title = composer.getByLabel("Announcement title")
  const body = composer.getByLabel("Announcement body")
  const sendButton = composer.getByRole("button", { name: /Send announcement/ })

  await composer.getByRole("button", { name: "Quiz night" }).click()
  await expect(title).toHaveValue("Quiz night is back this week")

  await title.fill(copy.title)
  await body.fill(copy.body)

  await expect(composer.getByText(`${copy.title.length}/80`)).toBeVisible()
  await expect(composer.getByText(`${copy.body.length}/180`)).toBeVisible()
  await expect(sendButton).toBeEnabled()
}
