import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"

test("private admin routes prohibit indexing across redirects and layouts @MS-production-index-performance", async ({
  request,
}) => {
  const response = await request.get("/admin", { maxRedirects: 0 })
  const layout = readFileSync("app/admin/layout.tsx", "utf8")

  expect(response.status()).toBeGreaterThanOrEqual(300)
  expect(response.status()).toBeLessThan(400)
  expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow")
  expect(layout).toContain("export const metadata: Metadata = PRIVATE_ROUTE_METADATA")
})

test("Lighthouse is a blocking multi-run mobile release gate @MS-production-index-performance", () => {
  const lighthouse = JSON.parse(readFileSync(".lighthouserc.json", "utf8"))
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8")
  const lighthouseJob = workflow.slice(workflow.indexOf("  lighthouse:"))

  expect(lighthouse.ci.collect.numberOfRuns).toBeGreaterThanOrEqual(2)
  expect(lighthouse.ci.collect.settings.formFactor).toBe("mobile")
  expect(lighthouse.ci.collect.settings.preset).not.toBe("desktop")
  const assertions = lighthouse.ci.assert.assertions as Record<
    string,
    [string, unknown]
  >
  for (const assertion of Object.values(assertions)) {
    expect(assertion[0]).toBe("error")
  }
  expect(lighthouseJob.split("  zap-baseline:")[0]).not.toContain(
    "continue-on-error: true"
  )
})
