// Glob matching for blast-radius and surface patterns.
//
// The dialect is ENGINE-FIXED (not a constant): every repository running the
// kit gets identical matching semantics, otherwise the lockstep guarantee is
// meaningless. Supported:
//
//   **   zero or more whole path segments (so "src/**/*.ts" matches
//        "src/a.ts", and "p/**" matches "p" itself as well as "p/x/y")
//   *    any run of characters within a single segment (never crosses /)
//   ?    exactly one character within a segment
//   a pattern with no wildcards matches the exact path or any path below it
//   ("docs" matches "docs" and "docs/guide.md", never "docsy")
//
// This fixes the historical matcher, where "scripts/**" was a bare
// startsWith("scripts") and wrongly matched "scripts-other/x".

const REGEX_SPECIALS = /[.+^${}()|[\]\\]/

export function matchesPattern(file, pattern) {
  if (!pattern.includes("*") && !pattern.includes("?")) {
    return file === pattern || file.startsWith(`${pattern}/`)
  }
  if (pattern.endsWith("/**") && file === pattern.slice(0, -3)) {
    // "**" can match zero segments, so "p/**" covers "p" itself.
    return true
  }
  return compile(pattern).test(file)
}

const cache = new Map()

function compile(pattern) {
  const cached = cache.get(pattern)
  if (cached) return cached

  let source = ""
  let i = 0
  while (i < pattern.length) {
    if (pattern.startsWith("**/", i)) {
      source += "(?:[^/]+/)*"
      i += 3
      continue
    }
    if (pattern.startsWith("**", i)) {
      source += ".*"
      i += 2
      continue
    }
    const char = pattern[i]
    if (char === "*") {
      source += "[^/]*"
    } else if (char === "?") {
      source += "[^/]"
    } else {
      source += REGEX_SPECIALS.test(char) ? `\\${char}` : char
    }
    i += 1
  }

  const regex = new RegExp(`^${source}$`)
  cache.set(pattern, regex)
  return regex
}
