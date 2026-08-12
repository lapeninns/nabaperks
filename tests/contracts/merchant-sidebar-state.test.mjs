import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Given merchant layout state is preserved When the cookie-backed default changes Then SidebarProvider resets uncontrolled state", () => {
  // Given
  const sidebar = readProjectFile("components", "ui", "sidebar.tsx")

  // When / Then
  assert.match(sidebar, /const \[internalOpenState, setInternalOpenState\]/)
  assert.match(
    sidebar,
    /const resetKey\s*=\s*openProp === undefined\s*\?\s*`uncontrolled-\$\{String\(defaultOpen\)\}`\s*:\s*"controlled"/
  )
  assert.match(
    sidebar,
    /<SidebarProviderState key=\{resetKey\} \{\.\.\.props\} \/>/
  )
  assert.doesNotMatch(
    sidebar,
    /React\.useEffect\(\(\) => \{[\s\S]*setInternalOpen\(defaultOpen\)[\s\S]*\}, \[defaultOpen, openProp\]\)/
  )
  assert.match(
    sidebar,
    /internalOpenState\.defaultOpen === defaultOpen[\s\S]*\? internalOpenState\.value[\s\S]*: defaultOpen/
  )
  assert.match(
    sidebar,
    /setInternalOpenState\(\{ defaultOpen, value: nextOpen \}\)/
  )
  assert.doesNotMatch(sidebar, /setInternalOpen\(defaultOpen\)/)
})

test("Given poster preview routes When the app shell is seeded Then poster focus does not override the saved sidebar cookie", () => {
  // Given
  const appLayout = readProjectFile("app", "app", "layout.tsx")

  // When / Then
  assert.match(appLayout, /defaultSidebarOpen=\{sidebarCookieOpen\}/)
  assert.doesNotMatch(
    appLayout,
    /defaultSidebarOpen=\{posterFocus \? false : sidebarCookieOpen\}/
  )
})

test("Given mobile poster preview When shell mobile chrome is hidden Then the poster top bar still opens merchant navigation", () => {
  // Given
  const posterChrome = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "poster-preview-chrome.tsx"
  )

  // When / Then
  assert.match(
    posterChrome,
    /import \{ SidebarTrigger \} from "@\/components\/ui\/sidebar"/
  )
  assert.match(
    posterChrome,
    /<SidebarTrigger[\s\S]*className="[^"]*\bmd:hidden\b[^"]*"[\s\S]*aria-label="Open menu"[\s\S]*\/>/
  )
})
