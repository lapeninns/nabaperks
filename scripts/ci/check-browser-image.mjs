import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
const require = createRequire(import.meta.url)
export const BROWSER_IMAGE_VERSION = "1.62.1"

export function verifyBrowserImage(
  { version, browsersPath, executables },
  exists = existsSync
) {
  if (version !== BROWSER_IMAGE_VERSION || browsersPath !== "/ms-playwright")
    throw new Error(
      "Prepared browser image and installed Playwright version must match"
    )
  if (
    executables.length !== 3 ||
    executables.some(
      (path) => !path.startsWith("/ms-playwright/") || !exists(path)
    )
  )
    throw new Error(
      "Prepared browser image is missing a required browser executable"
    )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const playwright = require("@playwright/test")
  const version = require("@playwright/test/package.json").version
  verifyBrowserImage({
    version,
    browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH,
    executables: [
      playwright.chromium,
      playwright.firefox,
      playwright.webkit,
    ].map((browser) => browser.executablePath()),
  })
  console.log(
    `Prepared Chromium, Firefox and WebKit verified for Playwright ${version}`
  )
}
