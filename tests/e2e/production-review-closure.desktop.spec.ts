import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"

test("private admin routes prohibit indexing across redirects and layouts", async ({
  request,
}) => {
  const response = await request.get("/admin", { maxRedirects: 0 })
  const layout = readFileSync("app/admin/layout.tsx", "utf8")

  expect(response.status()).toBeGreaterThanOrEqual(300)
  expect(response.status()).toBeLessThan(400)
  expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow")
  expect(layout).toContain(
    "export const metadata: Metadata = PRIVATE_ROUTE_METADATA"
  )
})

test("Lighthouse retains its historical non-LCP quality budgets", () => {
  const lighthouse = JSON.parse(readFileSync(".lighthouserc.json", "utf8"))
  const assertionMatrix = lighthouse.ci.assert.assertMatrix as Array<{
    assertions: Record<string, [string, unknown]>
    matchingUrlPattern: string
  }>

  expect(lighthouse.ci.collect.numberOfRuns).toBeGreaterThanOrEqual(2)
  expect(lighthouse.ci.collect.settings.formFactor).toBe("mobile")
  for (const url of lighthouse.ci.collect.url as string[]) {
    expect(
      assertionMatrix.filter(({ matchingUrlPattern }) =>
        new RegExp(matchingUrlPattern).test(url)
      )
    ).toHaveLength(1)
  }
  for (const { assertions } of assertionMatrix) {
    expect(assertions).not.toHaveProperty("largest-contentful-paint")
    for (const [audit, assertion] of Object.entries(assertions)) {
      expect(audit).not.toBe("largest-contentful-paint")
      expect(assertion[0]).toBe("error")
    }
  }
})
