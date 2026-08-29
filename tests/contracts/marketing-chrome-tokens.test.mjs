import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * Marketing chrome token contract — the type rank and the circle exceptions.
 *
 * DESIGN.md declares `typography.marketing-hero` at 56px. Both site heroes
 * shipped `lg:text-6xl` (60px) instead, so the design contract and the largest
 * type object on the site disagreed. The audit note for 01#15 recorded the
 * reason as "no 56px token exists in DESIGN.md" — that was wrong; the token is
 * declared at DESIGN.md `typography.marketing-hero`. What did not exist was a
 * Tailwind rung for it, so the heroes hand-numbered themselves off the stock
 * scale.
 *
 * These assertions keep the minted rung and DESIGN.md in step and stop the
 * heroes drifting back onto the stock 60px rung.
 *
 * The second half guards DESIGN.md's named circle exceptions. 01#6's note said
 * the footer pills were left alone because "DESIGN.md names the legal-link
 * halo family as a sanctioned exception". That is true of the legal row and
 * only the legal row: the thirteen site links above it are navigation, not
 * legal links, and were never on the list.
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

const designMd = readProjectFile("DESIGN.md")
const globalsCss = readProjectFile("app", "globals.css")

const HERO_FILES = [
  ["components", "marketing", "landing", "hero.tsx"],
  ["components", "marketing", "landing", "process-hero.tsx"],
]

test("Given DESIGN.md's marketing-hero rank When the theme is read Then a rung of exactly that size is minted", () => {
  const declared = designMd.match(
    /marketing-hero:[\s\S]*?fontSize:\s*(\d+)px/
  )?.[1]
  assert.equal(
    declared,
    "56",
    "DESIGN.md must still declare the marketing-hero rank at 56px"
  )

  const minted = globalsCss.match(/--text-marketing-hero:\s*([\d.]+)rem/)?.[1]
  assert.ok(minted, "globals.css must mint --text-marketing-hero")
  assert.equal(
    Number(minted) * 16,
    Number(declared),
    "--text-marketing-hero must equal DESIGN.md's marketing-hero fontSize"
  )
})

test("Given the two site heroes When their headline class is read Then they use the minted rung and not the stock 60px one", () => {
  for (const segments of HERO_FILES) {
    const source = readProjectFile(...segments)
    const heading = source.match(/<h1 className="([^"]*)"/)?.[1]
    assert.ok(heading, `${segments.at(-1)} must render an <h1> with classes`)
    assert.ok(
      heading.includes("lg:text-marketing-hero"),
      `${segments.at(-1)} must reach DESIGN.md's 56px hero rank at lg`
    )
    assert.ok(
      !/\btext-6xl\b/.test(heading),
      `${segments.at(-1)} must not use the stock 60px rung`
    )
  }
})

test("Given DESIGN.md's circle exceptions When the marketing footer is read Then only the legal row keeps the halo", () => {
  const layout = readProjectFile("components", "layout", "marketing-layout.tsx")

  assert.match(
    designMd,
    /legal-link halo family/,
    "DESIGN.md must still name the legal-link halo as the sanctioned exception"
  )

  const classOf = (name) =>
    layout.match(new RegExp(`const ${name} =\\s*\n?\\s*"([^"]*)"`))?.[1]

  const legal = classOf("legalLinkClass")
  assert.ok(legal, "legalLinkClass must exist")
  assert.ok(
    legal.includes("rounded-full"),
    "the legal row is the named exception and keeps its halo"
  )

  const siteLinks = classOf("footerLinkClass")
  assert.ok(siteLinks, "footerLinkClass must exist")
  assert.ok(
    !siteLinks.includes("rounded-full"),
    "footer site links are navigation, not the legal-link halo family"
  )

  const summary = layout.match(/<summary className="([^"]*)"/)?.[1]
  assert.ok(summary, "the footer column disclosure must have a summary")
  assert.ok(
    !summary.includes("rounded-full"),
    "the footer column summary is a heading row, not a stamp"
  )
})
