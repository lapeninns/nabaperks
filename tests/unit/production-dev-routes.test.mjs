import assert from "node:assert/strict"
import { test } from "node:test"
import {
  checkDevRoutes,
  devRoutePaths,
  routeForFile,
} from "../../scripts/ci/check-production-dev-routes.mjs"

test("every /dev page and route handler is discovered, including handlers layouts do not wrap", () => {
  const paths = devRoutePaths()
  assert.ok(paths.length > 20, `${paths.length}`)
  assert.ok(paths.includes("/dev/design-system"))
  assert.ok(paths.includes("/dev/google-review-plate"))
  assert.ok(paths.includes("/dev/google-review-plate/controls.js"))
  assert.ok(paths.every((path) => path.startsWith("/dev/")))
  assert.equal(
    routeForFile("dev/app-harness/numbers/[metric]"),
    "/dev/app-harness/numbers/probe"
  )
  assert.equal(routeForFile("dev/(group)/x"), "/dev/x")
})

test("any reachable development route fails the production probe", async () => {
  const seen = []
  const fetcher = async (url, options) => {
    seen.push([url.pathname, options.redirect])
    return { status: url.pathname === "/dev/b" ? 200 : 404 }
  }
  await assert.rejects(
    checkDevRoutes("http://127.0.0.1:3000", ["/dev/a", "/dev/b"], fetcher),
    /\/dev\/b -> 200/
  )
  // A redirect (for example to a login page) is not proof of absence.
  await assert.rejects(
    checkDevRoutes("http://127.0.0.1:3000", ["/dev/a"], async () => ({
      status: 307,
    })),
    /-> 307/
  )
  assert.ok(seen.every(([, redirect]) => redirect === "manual"))
  assert.equal(
    await checkDevRoutes("http://127.0.0.1:3000", ["/dev/a"], async () => ({
      status: 404,
    })),
    1
  )
  await assert.rejects(
    checkDevRoutes("http://127.0.0.1:3000", [], fetcher),
    /No \/dev routes/
  )
})
