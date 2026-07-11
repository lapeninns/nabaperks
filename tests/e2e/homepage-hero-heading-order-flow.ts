import { expect, test } from "@playwright/test"

export function defineHomepageHeroHeadingOrderTests() {
  test("uses a native h2 for the sample reward beneath the page h1", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "The loyalty card that just opens.",
      })
    ).toHaveCount(1)

    const hero = page.locator("#top")
    await expect(hero).toHaveCount(1)
    const reward = hero.getByRole("region", { name: "Reward" })
    await expect(reward).toHaveCount(1)
    await expect(reward.locator("h2")).toHaveCount(1)
    await expect(reward.locator("h2")).not.toBeEmpty()
    await expect(reward.locator("h3")).toHaveCount(0)
  })

  test("keeps h3 as the default for standalone reward tickets", async ({
    page,
  }) => {
    await page.goto("/dev/design-system")

    const tickets = page.getByRole("region", { name: "Reward" })
    await expect(tickets).toHaveCount(4)
    await expect(tickets.locator("h3")).toHaveCount(4)
    await expect(tickets.locator("h2")).toHaveCount(0)
  })
}
