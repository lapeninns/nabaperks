import { expect, test } from "@playwright/test"

/**
 * Sortable `DataTable` headers (ADM 04#60).
 *
 * Driven through the harness because every /admin route redirects to /login,
 * so the console's own tables can never be reached by a browser test. The
 * harness mounts the real component with the real sort-token allowlist.
 */
test("sortable admin headers are links, carry the sort params, and expose aria-sort", async ({
  page,
}) => {
  await page.goto("/dev/app-harness/trial/admin-table-sort", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  })

  // An unstyled page cannot be measured or trusted.
  expect(await page.evaluate(() => document.styleSheets.length)).toBeGreaterThan(
    0
  )

  const headers = page.locator("thead th")
  await expect(headers).toHaveCount(3)

  // A column that cannot be sorted must not claim aria-sort at all: "none" on
  // an inert header tells a screen-reader user the table sorts when it does not.
  await expect(headers.nth(0)).not.toHaveAttribute("aria-sort", /.*/)
  await expect(headers.nth(1)).toHaveAttribute("aria-sort", "none")
  await expect(headers.nth(2)).toHaveAttribute("aria-sort", "none")

  // The control is a real link, so the sorted view is linkable and needs no JS.
  const severity = headers.nth(1).locator("a")
  await expect(severity).toHaveAttribute(
    "href",
    "/dev/app-harness/trial/admin-table-sort?sort=severity&dir=desc"
  )
  await expect(severity).toHaveAttribute(
    "aria-label",
    "Sort by Severity, descending"
  )

  await severity.click()
  await expect(page.locator("#harness-active-sort")).toContainText(
    "sort=severity"
  )
  await expect(page.locator("thead th").nth(1)).toHaveAttribute(
    "aria-sort",
    "descending"
  )
  // Only one column may claim a direction at a time.
  await expect(page.locator("thead th").nth(2)).toHaveAttribute(
    "aria-sort",
    "none"
  )

  // Pressing the active column reverses it rather than re-applying it.
  await expect(page.locator("thead th").nth(1).locator("a")).toHaveAttribute(
    "href",
    "/dev/app-harness/trial/admin-table-sort?sort=severity&dir=asc"
  )
  await page.locator("thead th").nth(1).locator("a").click()
  await expect(page.locator("thead th").nth(1)).toHaveAttribute(
    "aria-sort",
    "ascending"
  )

  // A sort token that is not on the allowlist is not a sort: it reaches
  // PostgREST as an .order() column on a service-role read, so it falls back
  // to the list's default order rather than to the nearest legal value.
  await page.goto(
    "/dev/app-harness/trial/admin-table-sort?sort=metadata&dir=asc",
    { waitUntil: "domcontentloaded", timeout: 120000 }
  )
  await expect(page.locator("#harness-active-sort")).toContainText(
    "sort=default"
  )
  await expect(page.locator("thead th").nth(1)).toHaveAttribute(
    "aria-sort",
    "none"
  )
})
