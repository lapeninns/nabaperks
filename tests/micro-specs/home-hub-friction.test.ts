import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  HOME_EMPTY_HOW_IT_WORKS,
  HOME_EMPTY_HOW_IT_WORKS_LABEL,
} from "@/components/customer/home-empty-state"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * Home-hub cluster of the customer-flow friction audit.
 *
 * F3   — the hub subtitle promised "add a stamp", but a card tile links to
 *        /card/[id] with no qr param, where the page structurally refuses to
 *        stamp. The subtitle must drop the stamp promise.
 * F28  — the zero-cards empty state reused the join wizard's past-tense
 *        how-it-works narration ("You scanned the venue QR"), contradicting its
 *        own forward-looking "Scan a venue QR..." title. The empty state must
 *        carry its own forward-looking copy and not reuse JOIN_WELCOME_*.
 * F27  — activity timestamps rendered in a plain <span> with no machine-readable
 *        datetime, while every other timestamped surface uses <time dateTime>.
 */
describe("home-hub friction (F3, F28, F27)", () => {
  describe("F3 — hub subtitle drops the unreachable stamp promise", () => {
    const homePage = readProjectFile("app/home/(authed)/page.tsx")

    it("no longer promises 'add a stamp' from a card tile", () => {
      // The tile routes to /card/[id] with no qr param, which cannot stamp.
      expect(homePage).not.toContain("add a stamp")
    })

    it("frames the hub as a collection of cards to view", () => {
      expect(homePage).toContain(
        "Every card you've collected. Tap one to see its stamps and rewards."
      )
    })
  })

  describe("F28 — empty state has its own forward-looking copy", () => {
    const emptyState = readProjectFile(
      "components/customer/home-empty-state.tsx"
    )

    it("does not reuse the join wizard's how-it-works narration", () => {
      expect(emptyState).not.toContain("JOIN_WELCOME_HOW_IT_WORKS")
    })

    it("drops the past-tense 'You scanned the venue QR' line", () => {
      expect(HOME_EMPTY_HOW_IT_WORKS).not.toContain("You scanned the venue QR")
    })

    it("leads with finding then scanning the venue QR (forward-looking)", () => {
      expect(HOME_EMPTY_HOW_IT_WORKS[0]).toBe(
        "Find the Nabaperks QR at the counter, then scan it here"
      )
    })

    it("explains saving the card to your number with one text, no app", () => {
      expect(HOME_EMPTY_HOW_IT_WORKS).toContain(
        "Save the card to your number — one text, no app"
      )
    })

    it("sets the expectation of a stamp on every visit", () => {
      expect(HOME_EMPTY_HOW_IT_WORKS).toContain(
        "Collect a stamp on every visit"
      )
    })

    it("keeps the single Scan venue QR CTA pointing at /scan", () => {
      expect(emptyState).toContain('href="/scan"')
      expect(emptyState).toContain("Scan venue QR")
    })

    it("labels the steps with a How it works heading", () => {
      expect(HOME_EMPTY_HOW_IT_WORKS_LABEL).toBe("How it works")
    })

    it("keeps the warm en-GB voice (no emoji, no exclamation marks)", () => {
      for (const step of HOME_EMPTY_HOW_IT_WORKS) {
        expect(step).not.toContain("!")
      }
    })
  })

  describe("F27 — relative timestamps carry a machine-readable datetime", () => {
    it("renders activity-page rows as <time> bound to item.createdAt with the relative label", () => {
      const activityPage = readProjectFile(
        "app/home/(authed)/activity/page.tsx"
      )
      expect(activityPage).toMatch(/<time[\s\S]*?dateTime=\{item\.createdAt\}/)
      expect(activityPage).toContain("{formatRelativeTime(item.createdAt)}")
      expect(activityPage).toContain("</time>")
      // The plain <span> wrapper for the timestamp is gone.
      expect(activityPage).not.toMatch(
        /<span[^>]*>\s*\{formatRelativeTime\(item\.createdAt\)\}/
      )
    })

    it("renders the home activity snippet rows as <time> bound to item.createdAt", () => {
      const snippet = readProjectFile(
        "components/customer/home-activity-snippet.tsx"
      )
      expect(snippet).toMatch(/<time[\s\S]*?dateTime=\{item\.createdAt\}/)
      expect(snippet).toContain("{formatRelativeTime(item.createdAt)}")
      expect(snippet).toContain("</time>")
      expect(snippet).not.toMatch(
        /<span[^>]*>\s*\{formatRelativeTime\(item\.createdAt\)\}/
      )
    })
  })
})
