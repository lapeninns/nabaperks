import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

/**
 * QA BUG-057: the filled vermillion button lightened on hover
 * (`hover:bg-primary/90`), which put white label text at 4.47:1 on the card
 * surface where the join and login forms place it. This contract resolves
 * the hover background the shipped button classes actually paint, in both
 * themes and over both surfaces the button sits on, and holds the label to
 * the WCAG 1.4.3 text floor.
 */

const root = new URL("../../", import.meta.url)
const css = readFileSync(new URL("app/globals.css", root), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  ""
)
const button = readFileSync(new URL("components/ui/button.tsx", root), "utf8")

function block(selector) {
  const start = css.indexOf(`${selector} {`)
  assert.notEqual(start, -1, `${selector} block not found in globals.css`)
  const open = css.indexOf("{", start)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++
    if (css[i] === "}" && --depth === 0) {
      const props = {}
      for (const decl of css.slice(open + 1, i).split(";")) {
        const m = decl.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/)
        if (m) props[m[1]] = m[2]
      }
      return props
    }
  }
  throw new Error(`${selector} block is not closed`)
}

const themeInline = block("@theme inline")
const light = block(":root")
const dark = { ...light, ...block(".dark") }

function resolve(value, props, seen = new Set()) {
  const m = String(value)
    .trim()
    .match(/^var\((--[\w-]+)\)$/)
  if (!m) return String(value).trim()
  assert.ok(!seen.has(m[1]), `circular token ${m[1]}`)
  seen.add(m[1])
  assert.ok(m[1] in props, `token ${m[1]} is not defined`)
  return resolve(props[m[1]], props, seen)
}

function hex(value) {
  const m = value.match(/^#([0-9a-f]{6})$/i)
  assert.ok(m, `expected a 6-digit hex colour, got ${value}`)
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function composite(fg, alpha, bg) {
  return fg.map((c, i) => Math.round(alpha * c + (1 - alpha) * bg[i]))
}

function variantClasses(name) {
  const m = button.match(new RegExp(`\\n\\s*${name}:\\s*\\n?\\s*"([^"]+)"`))
  assert.ok(m, `button variant ${name} not found`)
  return m[1].split(/\s+/)
}

/** `hover:bg-<color>[/<alpha>]` → the Tailwind colour name and its alpha. */
function hoverBackground(classes) {
  const hovers = classes
    .map((c) => c.match(/^hover:bg-([\w-]+)(?:\/(\d+))?$/))
    .filter(Boolean)
  assert.equal(hovers.length, 1, "expected exactly one hover background")
  const [, color, alpha] = hovers[0]
  return { color, alpha: alpha ? Number(alpha) / 100 : 1 }
}

const VARIANTS = [
  // [variant, label token]
  ["default", "--primary-foreground"],
  ["stamp", "--stamp-foreground"],
]

for (const [variant, labelToken] of VARIANTS) {
  for (const [themeName, props] of [
    ["light", light],
    ["dark", dark],
  ]) {
    test(`${variant} button hover keeps its label at 4.5:1 or better (${themeName})`, () => {
      const { color, alpha } = hoverBackground(variantClasses(variant))
      const themeToken = themeInline[`--color-${color}`]
      assert.ok(themeToken, `--color-${color} is not a theme colour`)
      const hoverFill = hex(resolve(themeToken, props))
      const label = hex(resolve(`var(${labelToken})`, props))

      for (const surface of ["--card", "--background"]) {
        const ground = hex(resolve(`var(${surface})`, props))
        const painted = composite(hoverFill, alpha, ground)
        const ratio = contrast(label, painted)
        assert.ok(
          ratio >= 4.5,
          `${themeName} ${variant} hover over ${surface} is ${ratio.toFixed(3)}:1 (needs 4.5:1)`
        )
      }
    })
  }
}
