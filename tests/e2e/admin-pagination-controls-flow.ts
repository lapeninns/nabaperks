import { expect, test } from "@playwright/test"

/**
 * ADM 04#56 — the admin paginator's page jump and rows-per-page control.
 *
 * Every admin list route is auth-gated, so the control is exercised on the
 * design-system catalogue, which mounts a live `AdminLookupPagination`
 * (app/dev/design-system/admin-vocabulary-demo.tsx). What is proved here is
 * the part a source contract cannot prove: that these are real GET
 * navigations which put `page` and `size` in the URL.
 *
 * Shared by the desktop and mobile projects — a paginator that only works at
 * one width is the defect this finding is about.
 */
const PAGINATOR = "Catalogue example pages"

export function describeAdminPaginationControls() {
  test.describe("admin paginator controls", () => {
    test("rows-per-page submits a size param and the page jump submits a page", async ({
      page,
    }) => {
      await page.goto("/dev/design-system#admin")

      const paginator = page.getByRole("navigation", { name: PAGINATOR })
      await expect(paginator).toBeVisible()

      // Rows per page: an accessible select, three offered sizes, default 25.
      const rows = paginator.getByLabel("Rows per page")
      await expect(rows).toHaveValue("25")
      await expect(rows.locator("option")).toHaveText(["25", "50", "100"])

      await rows.selectOption("100")
      await paginator.getByRole("button", { name: "Apply" }).click()
      await expect(page).toHaveURL(/[?&]size=100(&|#|$)/)

      // The page jump is a separate GET form on the same paginator.
      const reloaded = page.getByRole("navigation", { name: PAGINATOR })
      await reloaded.getByLabel(/^Go to page/).fill("7")
      await reloaded.getByRole("button", { name: "Go" }).click()
      await expect(page).toHaveURL(/[?&]page=7(&|#|$)/)
    })

    test("page links carry the paging params as plain hrefs", async ({
      page,
    }) => {
      await page.goto("/dev/design-system#admin")

      // First/Previous/Next/Last are links, not buttons with handlers: the
      // paginator has to work before hydration.
      const paginator = page.getByRole("navigation", { name: PAGINATOR })
      await expect(
        paginator.getByRole("link", { name: "Next page" })
      ).toHaveAttribute("href", /page=4/)
      await expect(
        paginator.getByRole("link", { name: "Previous page" })
      ).toHaveAttribute("href", /page=2/)
      await expect(
        paginator.getByRole("link", { name: "Last page" })
      ).toHaveAttribute("href", /page=17/)
    })
  })
}
