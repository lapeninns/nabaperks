import { expect, test } from "@playwright/test"

test("Given the full pub guide When it renders Then every section and the contracted hero font remain intact", async ({
  page,
}) => {
  await page.goto("/loyalty-for-pubs")

  const sections = page.locator("main section[id]")
  await expect(sections).toHaveCount(8)
  await expect(sections.locator("h2")).toHaveCount(8)

  await expect(page.locator("main .mono-meta.font-normal").first()).toHaveCSS(
    "font-weight",
    "700"
  )
})
