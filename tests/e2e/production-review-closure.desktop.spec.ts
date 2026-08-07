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

test("Lighthouse remains a multi-run mobile quality signal", () => {
  const lighthouse = JSON.parse(readFileSync(".lighthouserc.json", "utf8"))
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8")
  const lighthouseJob = workflow.slice(workflow.indexOf("  lighthouse:"))

  expect(lighthouse.ci.collect.numberOfRuns).toBeGreaterThanOrEqual(2)
  expect(lighthouse.ci.collect.settings.formFactor).toBe("mobile")
  expect(lighthouse.ci.collect.settings.preset).not.toBe("desktop")
  const assertionMatrix = lighthouse.ci.assert.assertMatrix as Array<{
    matchingUrlPattern: string
    assertions: Record<string, [string, unknown]>
  }>
  expect(assertionMatrix).toHaveLength(2)

  for (const url of lighthouse.ci.collect.url as string[]) {
    const matchingGroups = assertionMatrix.filter(({ matchingUrlPattern }) =>
      new RegExp(matchingUrlPattern).test(url)
    )
    expect(
      matchingGroups,
      `${url} must have one Lighthouse budget`
    ).toHaveLength(1)
  }

  for (const { assertions } of assertionMatrix) {
    for (const assertion of Object.values(assertions)) {
      expect(assertion[0]).toBe("error")
    }
  }

  const publicAssertions = assertionMatrix.find(({ matchingUrlPattern }) =>
    new RegExp(matchingUrlPattern).test("http://127.0.0.1:3130/")
  )?.assertions
  const signupAssertions = assertionMatrix.find(({ matchingUrlPattern }) =>
    new RegExp(matchingUrlPattern).test("http://127.0.0.1:3130/signup")
  )?.assertions
  expect(publicAssertions?.["categories:seo"]).toEqual([
    "error",
    { minScore: 0.9 },
  ])
  expect(signupAssertions).not.toHaveProperty("categories:seo")
  expect(lighthouseJob.split("  zap-baseline:")[0]).not.toContain(
    "continue-on-error: true"
  )
})
