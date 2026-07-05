// Strict YAML-subset frontmatter parser for Micro-Specs.
//
// The governance engine refuses to guess: anything outside the supported
// subset is a parse ERROR with a line number, never a silent drop or a
// mis-parse. The supported subset is exactly what the Micro-Spec metadata
// contract needs:
//
//   key: scalar                    unquoted, or "double"/'single' quoted
//   key:                           opens a dash list
//     - item
//   key: []                        empty list
//   key: [a, b, "c"]               inline flow list
//   # comment lines and blank lines
//
// Rejected with errors (the historical parser silently dropped several of
// these, losing spec content): wrapped/continuation lines, nested maps,
// block scalars (| and >), flow maps ({}), tabs in indentation, duplicate
// keys, unterminated quotes, and list items with no open list key.
//
// Line numbers in errors are 1-indexed positions in the FULL source file
// (the opening --- is line 1), so failures are directly clickable.

const KEY_LINE = /^([A-Za-z0-9_]+):(.*)$/
const LIST_ITEM = /^(\s+)-(?:\s+(.*)|\s*)$/
const NESTED_MAP_ITEM = /^[A-Za-z0-9_]+:(\s+\S|$)/

export function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/)
  if (!match) return null

  const metadata = {}
  const errors = []
  const lines = match[1].split(/\r?\n/)
  let currentListKey = null

  const fail = (index, message) => {
    // +2: line 1 is the opening ---, block lines start at file line 2.
    errors.push({ line: index + 2, message })
  }

  for (const [index, rawLine] of lines.entries()) {
    if (rawLine.trim() === "" || /^\s*#/.test(rawLine)) continue

    if (/^[ ]*\t/.test(rawLine)) {
      fail(index, "tab indentation is not supported; use spaces")
      continue
    }

    const item = rawLine.match(LIST_ITEM)
    if (item) {
      if (!currentListKey) {
        fail(index, "list item has no open list key")
        continue
      }
      const value = item[2] ?? ""
      if (value === "") {
        fail(index, `empty list item under "${currentListKey}"`)
        continue
      }
      if (NESTED_MAP_ITEM.test(value)) {
        fail(index, `nested maps are not supported (list item under "${currentListKey}" looks like "key: value")`)
        continue
      }
      const scalar = parseScalar(value, () =>
        fail(index, `unterminated quoted string under "${currentListKey}"`)
      )
      if (scalar !== undefined) metadata[currentListKey].push(scalar)
      continue
    }

    const pair = rawLine.match(KEY_LINE)
    if (!pair) {
      if (/^\s+\S/.test(rawLine)) {
        fail(
          index,
          "wrapped/continuation lines are not supported; keep each entry on one line"
        )
      } else {
        fail(index, `unrecognized frontmatter syntax: "${rawLine.trim()}"`)
      }
      continue
    }

    const key = pair[1]
    const rest = pair[2].trim()
    currentListKey = null

    if (Object.prototype.hasOwnProperty.call(metadata, key)) {
      fail(index, `duplicate metadata key "${key}"`)
      continue
    }

    if (rest === "") {
      metadata[key] = []
      currentListKey = key
      continue
    }
    if (rest === "[]") {
      metadata[key] = []
      continue
    }
    if (rest.startsWith("|") || rest.startsWith(">")) {
      fail(index, `block scalars are not supported for "${key}"; keep the value on one line`)
      continue
    }
    if (rest.startsWith("{")) {
      fail(index, `flow maps are not supported for "${key}"`)
      continue
    }
    if (rest.startsWith("[")) {
      if (!rest.endsWith("]")) {
        fail(index, `unterminated flow list for "${key}"`)
        continue
      }
      const list = parseFlowList(rest.slice(1, -1), (message) => fail(index, `${message} in flow list for "${key}"`))
      if (list !== undefined) metadata[key] = list
      continue
    }

    const scalar = parseScalar(rest, () => fail(index, `unterminated quoted string for "${key}"`))
    if (scalar !== undefined) metadata[key] = scalar
  }

  return { metadata, errors }
}

function parseFlowList(body, fail) {
  if (body.trim() === "") return []

  const items = []
  let current = ""
  let quote = null

  for (const char of body) {
    if (quote) {
      if (char === quote) {
        quote = null
      }
      current += char
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    if (char === "[" || char === "{") {
      fail("nested flow collections are not supported")
      return undefined
    }
    if (char === ",") {
      items.push(current)
      current = ""
      continue
    }
    current += char
  }

  if (quote) {
    fail("unterminated quoted string")
    return undefined
  }
  items.push(current)

  const parsed = []
  for (const raw of items) {
    const trimmed = raw.trim()
    if (trimmed === "") {
      fail("empty element")
      return undefined
    }
    parsed.push(stripQuotes(trimmed))
  }
  return parsed
}

function parseScalar(value, onUnterminatedQuote) {
  if (
    (value.startsWith('"') || value.startsWith("'")) &&
    (value.length < 2 || value[value.length - 1] !== value[0])
  ) {
    onUnterminatedQuote()
    return undefined
  }
  return stripQuotes(value)
}

function stripQuotes(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1)
  }
  return value
}
