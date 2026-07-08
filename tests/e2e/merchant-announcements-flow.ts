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
