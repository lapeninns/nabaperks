import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

const WORKFLOWS = ".github/workflows"
const files = readdirSync(WORKFLOWS)
  .filter((name) => name.endsWith(".yml"))
  .map((name) => ({ name, text: readFileSync(join(WORKFLOWS, name), "utf8") }))

// Returns every `run:` script body with its first line number. Block scalars
// end at the first non-blank line that is not indented past the `run:` key.
function runScripts(text) {
  const lines = text.split("\n")
  const scripts = []
  lines.forEach((line, index) => {
    const match = line.match(/^(\s*)(?:- )?run: ?(.*)$/)
    if (!match) return
    const keyIndent =
      match[1].length + (line.trimStart().startsWith("- ") ? 2 : 0)
    if (!/^[|>]/.test(match[2])) {
      scripts.push({ line: index + 1, body: match[2] })
      return
    }
    const body = []
    for (const next of lines.slice(index + 1)) {
      if (next.trim() && next.length - next.trimStart().length <= keyIndent)
        break
      body.push(next)
    }
    scripts.push({ line: index + 1, body: body.join("\n") })
  })
  return scripts
}

test("no workflow checkout persists a token into the working tree", () => {
  for (const { name, text } of files) {
    const lines = text.split("\n")
    lines.forEach((line, index) => {
      if (!/uses: actions\/checkout@/.test(line)) return
      const indent = line.indexOf("uses:")
      const step = []
      for (const next of lines.slice(index + 1)) {
        if (!next.trim()) continue
        if (next.length - next.trimStart().length <= indent - 2) break
        if (/^\s*- /.test(next) && next.indexOf("-") <= indent - 2) break
        step.push(next)
      }
      assert.ok(
        step.some((entry) => /persist-credentials: false/.test(entry)),
        `${name}:${index + 1} checkout must set persist-credentials: false`
      )
    })
  }
})

test("provider tokens never appear on a command line", () => {
  for (const { name, text } of files)
    assert.doesNotMatch(text, /--token[= ]/, `${name} passes --token`)
})

test("dispatch inputs and event payload fields reach shells only through env", () => {
  // Expression interpolation is substituted into the script text before bash
  // parses it, so a crafted input becomes code. Static matrix values remain
  // allowed; everything user- or event-controlled must go through `env:`.
  const untrusted = /\$\{\{\s*(inputs\.|github\.event\.|github\.head_ref)/
  for (const { name, text } of files)
    for (const { line, body } of runScripts(text))
      assert.doesNotMatch(body, untrusted, `${name}:${line} interpolates input`)
})
