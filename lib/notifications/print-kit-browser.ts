import { chromium, type Browser } from "playwright"

let sharedBrowser: Browser | null = null

/** Shared Chromium for print-kit export (preview pages + Google HTML kit). */
export async function getPrintKitBrowser(): Promise<Browser> {
  if (sharedBrowser?.isConnected()) return sharedBrowser
  sharedBrowser = await chromium.launch({ headless: true })
  return sharedBrowser
}

/** Best-effort Chromium shutdown for CLI export scripts. */
export async function closePrintKitBrowser(): Promise<void> {
  if (!sharedBrowser) return
  const browser = sharedBrowser
  sharedBrowser = null
  try {
    await Promise.race([
      browser.close(),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ])
  } catch {
    // Ignore shutdown races on CLI exit.
  }
}
