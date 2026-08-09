
import { chromium } from "@playwright/test"
const BASE = process.env.BASE_URL
const browser = await chromium.launch()
const page = await (await browser.newContext()).newPage()
const bad = []
page.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.request().resourceType() + " " + r.url()) })
for (const route of ["/", "/pricing", "/how-it-works", "/faq", "/loyalty-for-pubs"]) {
  await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(1500)
}
console.log(JSON.stringify([...new Set(bad)], null, 1))
await browser.close()
