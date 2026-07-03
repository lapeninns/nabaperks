import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

const expectedDevPages = [
  "app/dev/app-harness/account/page.tsx",
  "app/dev/app-harness/activity/page.tsx",
  "app/dev/app-harness/announcements/page.tsx",
  "app/dev/app-harness/customers/page.tsx",
  "app/dev/app-harness/dashboard/page.tsx",
  "app/dev/app-harness/launch/page.tsx",
  "app/dev/app-harness/onboarding/page.tsx",
  "app/dev/app-harness/qr/page.tsx",
  "app/dev/app-harness/reward-scan/page.tsx",
  "app/dev/app-harness/scan/page.tsx",
  "app/dev/app-harness/skeletons/page.tsx",
  "app/dev/app-harness/states/page.tsx",
  "app/dev/design-system/page.tsx",
  "app/dev/home-harness/home/page.tsx",
  "app/dev/home-harness/rewards/page.tsx",
  "app/dev/poster-preview/page.tsx",
]

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

function listPageFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      return listPageFiles(fullPath)
    }

    return entry.isFile() && entry.name === "page.tsx" ? [fullPath] : []
  })
}

function relativeProjectPath(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/")
}

function hasProductionNotFoundGuard(source) {
  return /process\.env\.NODE_ENV === "production"[\s\S]{0,160}notFound\(\)/.test(
    source
  )
}

test("Given dev and QA routes are not product surfaces When the /dev tree is inventoried Then every current page is covered by the production notFound layout", () => {
  // Given
  const devLayout = readProjectFile("app", "dev", "layout.tsx")
  const devPages = listPageFiles(path.join(projectRoot, "app", "dev"))
    .map(relativeProjectPath)
    .sort()

  // When / Then
  assert.deepEqual(devPages, expectedDevPages)
  assert.match(devLayout, /import \{ notFound \} from "next\/navigation"/)
  assert.match(devLayout, /robots: \{ index: false, follow: false \}/)
  assert.ok(hasProductionNotFoundGuard(devLayout))

  for (const devPage of devPages) {
    assert.match(devPage, /^app\/dev\//)
  }
})
