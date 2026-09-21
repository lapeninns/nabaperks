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

test("Given admin layout state is preserved When the cookie-backed default changes Then SidebarProvider resets uncontrolled state", () => {
  // Given
  const sidebar = readProjectFile("components", "ui", "sidebar.tsx")

  // When / Then
  assert.match(sidebar, /const \[internalOpenState, setInternalOpenState\]/)
  assert.match(
    sidebar,
    /const resetKey =\s*openProp === undefined \? `uncontrolled-\$\{String\(defaultOpen\)\}` : "controlled"/
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

test("Given the counter-first console When the merchant shell mounts Then it carries no sidebar and reads no sidebar cookie", () => {
  // Given
  const shell = readProjectFile(
    "components",
    "layout",
    "merchant-app-shell.tsx"
  )
  const appLayout = readProjectFile("app", "app", "layout.tsx")
  const posterChrome = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "poster-preview-chrome.tsx"
  )

  // When / Then — the rail replaced SidebarProvider on /app; admin keeps it.
  assert.doesNotMatch(shell, /@\/components\/ui\/sidebar/)
  assert.match(shell, /<MerchantTabBar[\s\S]*form="tabs"/)
  assert.match(shell, /<MerchantTabBar[\s\S]*form="rail"/)
  assert.doesNotMatch(appLayout, /sidebar_state|defaultSidebarOpen/)
  assert.doesNotMatch(posterChrome, /@\/components\/ui\/sidebar/)
  assert.match(
    readProjectFile("components", "layout", "admin-shell.tsx"),
    /SidebarProvider/
  )
})

test("Given the poster print path When the shell is chromeless Then only the top bar and tab bar go and the body still self-pads", () => {
  const shell = readProjectFile(
    "components",
    "layout",
    "merchant-app-shell.tsx"
  )

  assert.match(shell, /hideMobileChrome \? null : \(\s*<header/)
  assert.match(
    shell,
    /hideMobileChrome \? null : \(\s*<MerchantTabBar\s+form="tabs"/
  )
  assert.match(shell, /hideMobileChrome\s*\? "w-full min-w-0"/)
})
