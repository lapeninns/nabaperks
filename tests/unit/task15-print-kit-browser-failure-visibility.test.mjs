/**
 * Task 15 harness repair for the four `chromium-mach-port-permission` rows:
 * T37-DEF-2e0e4cfdd3288bbdb9fef841, T37-DEF-4acf9fcf259e5b203f5eb611,
 * T37-DEF-606adcf86eb3f4d4a921b4a8, T37-DEF-8e9a5e915a515af8e180e9f4.
 *
 * Those rows record that the Google-review PDF unit tests could not launch
 * Chromium. Their authority marks them NOT_CERTIFIED with "a later retry cannot
 * erase the receipt", so re-running them green is explicitly not the fix. The
 * prescribed action is to repair the harness or evidence contract so the
 * failure mode is visible, and then rerun the exact scenario.
 *
 * What was missing was not fail-closed behaviour — the builders do reject — but
 * any proof of it. Nothing stopped a future change from folding an unavailable
 * browser into the same empty-result path that a missing review URL already
 * takes, which would turn "Chromium is broken" into a silent pass. This test
 * pins the distinction.
 *
 * The unavailable browser is real, not mocked: a child process runs with
 * PLAYWRIGHT_BROWSERS_PATH pointed at an empty directory, so Playwright's own
 * launch fails the way it would on a host without browsers installed.
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"

import { PDFDocument } from "pdf-lib"

import {
  buildGoogleReviewCardPdfAttachment,
  buildGoogleReviewPdfAttachments,
  buildGoogleReviewPlatePdfAttachment,
  closeGoogleReviewPdfBrowser,
} from "@/lib/notifications/google-review-pdf"

const INPUT = {
  merchantName: "Old Crown Girton",
  locality: "Girton",
  reviewUrl:
    "https://search.google.com/local/writereview?placeid=ChIJr-Lmrdt22EcRpM90SQtZug4",
}

const owned = []

after(async () => {
  await closeGoogleReviewPdfBrowser()
  for (const path of owned) rmSync(path, { recursive: true, force: true })
})

function temp() {
  const path = mkdtempSync(join(tmpdir(), "nabaperks-task15-printkit-"))
  owned.push(path)
  return path
}

/** Runs `source` in a child process whose Chromium cannot possibly launch. */
function withoutBrowsers(source) {
  const root = temp()
  const script = join(root, "probe.mjs")
  writeFileSync(script, source)
  return execFileSync(
    process.execPath,
    ["--import", "./tests/support/register-alias.mjs", script],
    {
      encoding: "utf8",
      timeout: 120_000,
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: join(root, "no-browsers-here"),
      },
    }
  )
}

test(
  "Given Chromium cannot launch When a review PDF is built Then every builder rejects instead of returning a result",
  { timeout: 180_000 },
  () => {
    const output = withoutBrowsers(`
      const mod = await import("@/lib/notifications/google-review-pdf")
      const INPUT = ${JSON.stringify(INPUT)}
      const names = [
        "buildGoogleReviewCardPdfAttachment",
        "buildGoogleReviewPlatePdfAttachment",
        "buildGoogleReviewPdfAttachments",
      ]
      for (const name of names) {
        try {
          const value = await mod[name](INPUT)
          console.log(name + " RESOLVED " + JSON.stringify(value ?? null).slice(0, 60))
        } catch (error) {
          console.log(name + " REJECTED " + String(error.message).split("\\n")[0].slice(0, 60))
        }
      }
      await mod.closeGoogleReviewPdfBrowser().catch(() => {})
    `)

    for (const name of [
      "buildGoogleReviewCardPdfAttachment",
      "buildGoogleReviewPlatePdfAttachment",
      "buildGoogleReviewPdfAttachments",
    ]) {
      assert.match(
        output,
        new RegExp(`^${name} REJECTED `, "m"),
        `${name} must reject when Chromium is unavailable, got:\n${output}`
      )
    }
    // The rejection has to name the launch, or an unrelated failure could
    // satisfy this test and hide a regression.
    assert.match(output, /browserType\.launch/)
    assert.doesNotMatch(output, /RESOLVED/)
  }
)

test(
  "Given no review URL When attachments are built Then the empty result is reserved for that case alone",
  { timeout: 60_000 },
  async () => {
    // The distinction this pins: an absent review URL yields []; an unavailable
    // browser must not. Collapsing the two is how a broken Chromium would
    // become a silent pass.
    const attachments = await buildGoogleReviewPdfAttachments({
      ...INPUT,
      reviewUrl: "",
    })
    assert.deepEqual(attachments, [])
  }
)

test(
  "Given Chromium is available When the four recorded scenarios rerun Then each produces a valid PDF",
  { timeout: 180_000 },
  async () => {
    // Reruns the exact scenarios the four rows record as unable to launch.
    const card = await buildGoogleReviewCardPdfAttachment(INPUT)
    assert.match(card.content, /^JVBERi0/)
    assert.equal((await PDFDocument.load(card.content)).getPageCount(), 2)

    const plate = await buildGoogleReviewPlatePdfAttachment(INPUT)
    assert.match(plate.content, /^JVBERi0/)
    assert.equal((await PDFDocument.load(plate.content)).getPageCount(), 1)

    const attachments = await buildGoogleReviewPdfAttachments(INPUT)
    assert.ok(
      attachments.length >= 2,
      `expected card and plate attachments, got ${attachments.length}`
    )
    for (const attachment of attachments) {
      assert.match(attachment.filename, /\.pdf$/)
      assert.ok(Buffer.from(attachment.content, "base64").byteLength > 4_000)
    }

    // The unsupported-glyph scenario: a merchant name outside Latin-1 must
    // still render rather than throwing an encoding error.
    const glyphs = await buildGoogleReviewPlatePdfAttachment({
      ...INPUT,
      merchantName: "Café Ω 日本 Crown",
    })
    assert.match(glyphs.content, /^JVBERi0/)
    assert.ok(Buffer.from(glyphs.content, "base64").byteLength > 4_000)
  }
)
