import { expect, test, type Page } from "@playwright/test"

import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

/**
 * QA BUG-043: the merchant sign-up pre-check blocked an invalid submit but
 * showed no message, so only a focus ring explained the refusal. DB-free:
 * every case is refused in the browser before the server action runs.
 */

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page }) => {
  await dismissPwaInstall(page)
})

function countSignupPosts(page: Page) {
  const posts = { count: 0 }
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/signup"
    ) {
      posts.count += 1
    }
  })
  return posts
}

async function submit(page: Page, name: string, email: string) {
  await page.getByLabel("Your name").fill(name)
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByRole("button", { name: "Create account" }).click()
}

test("an empty sign-up shows both field errors, wired to the fields", async ({
  page,
}) => {
  const posts = countSignupPosts(page)
  await gotoHydratedPage(page, "/signup")
  await submit(page, "", "")

  const name = page.getByLabel("Your name")
  const email = page.getByLabel("Email", { exact: true })
  await expect(page.getByText("Enter your name.")).toBeVisible()
  await expect(page.getByText("Enter a valid email address.")).toBeVisible()
  await expect(name).toHaveAttribute("aria-invalid", "true")
  await expect(email).toHaveAttribute("aria-invalid", "true")
  await expect(name).toHaveAttribute("aria-describedby", /name-error/)
  await expect(email).toHaveAttribute("aria-describedby", /email-error/)
  await expect(name).toBeFocused()
  expect(posts.count).toBe(0)
})

test("a one-letter name is explained and the message clears on input", async ({
  page,
}) => {
  const posts = countSignupPosts(page)
  await gotoHydratedPage(page, "/signup")
  await submit(page, "A", "owner@venue.example")

  const name = page.getByLabel("Your name")
  await expect(page.getByText("Enter your name.")).toBeVisible()
  await expect(page.getByText("Enter a valid email address.")).toHaveCount(0)
  await expect(name).toHaveAttribute("aria-invalid", "true")
  await expect(name).toBeFocused()

  await name.pressSequentially("lex")
  await expect(page.getByText("Enter your name.")).toHaveCount(0)
  await expect(name).not.toHaveAttribute("aria-invalid", "true")
  expect(posts.count).toBe(0)
})

test("an email the browser accepts but the app refuses is explained", async ({
  page,
}) => {
  const posts = countSignupPosts(page)
  await gotoHydratedPage(page, "/signup")
  await submit(page, "Alex Owner", "owner@venue")

  const email = page.getByLabel("Email", { exact: true })
  await expect(page.getByText("Enter a valid email address.")).toBeVisible()
  await expect(page.getByText("Enter your name.")).toHaveCount(0)
  await expect(email).toHaveAttribute("aria-invalid", "true")
  await expect(email).toBeFocused()
  expect(posts.count).toBe(0)
})
