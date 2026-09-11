import assert from "node:assert/strict"
import { existsSync, readFileSync, realpathSync } from "node:fs"
import { resolve, dirname, relative, isAbsolute, sep } from "node:path"
import { spawnSync } from "node:child_process"
import { parsers } from "prettier/plugins/markdown"
import { parsers as htmlParsers } from "prettier/plugins/html"
import { isDocumentationPath } from "./impact-documentation.mjs"

function markdownLinkTargets(text) {
  // Use the same installed Markdown parser as the required formatter. This
  // handles destinations, escapes and block structure without regex gaps.
  const tree = parsers.markdown.parse(text)
  assert.equal(
    tree?.type,
    "root",
    "Markdown parser returned an unsupported tree"
  )
  const nodes = [tree]
  const targets = []
  const html = []
  while (nodes.length) {
    const node = nodes.pop()
    if (["link", "image", "definition"].includes(node.type))
      targets.push(node.url)
    if (node.type === "html") html.push(node.value)
    if (node.children) nodes.push(...[...node.children].reverse())
  }
  if (html.length) targets.push(...htmlLinkTargets(html.join("\n")))
  return targets
}

function htmlLinkTargets(text) {
  const nodes = [htmlParsers.html.parse(text)]
  const targets = []
  while (nodes.length) {
    const node = nodes.pop()
    for (const attribute of node.attrs ?? []) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value
      assert.ok(
        name !== "srcset" || !value,
        "HTML srcset needs explicit Markdown image links for validation"
      )
      if (!["href", "src", "poster"].includes(name) || !value) continue
      // The formatter's HTML parser preserves character references. Reject
      // unvalidated local references rather than treating their spelling as a
      // filesystem path; percent-encoded local paths use the normal validator.
      assert.ok(
        !value.includes("&") || /^[A-Za-z][A-Za-z0-9+.-]*:|^[/#]/.test(value),
        "Local HTML URLs with character references need Markdown link syntax"
      )
      targets.push(value)
    }
    if (node.children) nodes.push(...node.children)
  }
  return targets
}

function withinRoot(root, target) {
  const path = relative(root, target)
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

export function localMarkdownLinks(paths, { cwd = process.cwd() } = {}) {
  const root = resolve(cwd)
  const canonicalRoot = realpathSync(root)
  const missing = []
  const escaped = []
  for (const path of paths) {
    const text = readFileSync(resolve(cwd, path), "utf8")
    const targets = markdownLinkTargets(text)
    for (const destination of targets) {
      const target = destination.split("#")[0]
      if (
        !target ||
        /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target) ||
        target.startsWith("/")
      )
        continue
      const decoded = decodeURIComponent(target)
      const resolved = resolve(root, dirname(path), decoded)
      if (!withinRoot(root, resolved)) escaped.push(`${path}: ${target}`)
      else if (!existsSync(resolved)) missing.push(`${path}: ${target}`)
      else if (!withinRoot(canonicalRoot, realpathSync(resolved)))
        escaped.push(`${path}: ${target}`)
    }
  }
  assert.deepEqual(escaped, [], "Documentation links escape the repository")
  assert.deepEqual(missing, [], "Documentation has missing local link targets")
  return { files: paths.length, missing }
}

export function runDocumentation(
  plan,
  { spawn = spawnSync, cwd = process.cwd() } = {}
) {
  assert.ok(
    plan.profile === "documentation" ||
      (plan.profile === "public-pages" &&
        plan.required.includes("documentation")) ||
      (plan.profile === "full" && plan.comparisonRequired)
  )
  const files = plan.changes
    .filter(
      (change) => change.status !== "D" && isDocumentationPath(change.path)
    )
    .map((change) => change.path)
  const commands = [
    // Public-page fast/quality jobs already run these shared checks. Its
    // documentation job adds only the changed-document formatting/link proof.
    ...(plan.profile === "public-pages"
      ? []
      : [
          ["pnpm", "secrets:check"],
          ["pnpm", "test:contracts"],
          ["pnpm", "docs:check"],
          ["pnpm", "agents:check"],
        ]),
    ...(files.length
      ? [["pnpm", "exec", "prettier", "--check", "--", ...files]]
      : []),
  ]
  for (const [command, ...args] of commands) {
    const result = spawn(command, args, { stdio: "inherit", cwd })
    assert.ok(
      !result.error && !result.signal && result.status === 0,
      `Documentation check failed: ${command} ${args.join(" ")}`
    )
  }
  return localMarkdownLinks(files, { cwd })
}
