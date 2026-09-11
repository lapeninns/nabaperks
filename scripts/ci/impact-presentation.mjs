import posix from "node:path/posix"
import ts from "typescript"
import { readSourceTree, readAt, isToolingSourcePath } from "./impact-git.mjs"
import { presentationClassShape } from "./impact-classes.mjs"

const TEXT_PARENTS = new Set([
  "a",
  "b",
  "blockquote",
  "button",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "label",
  "li",
  "p",
  "section",
  "small",
  "span",
  "strong",
  "summary",
  "Button",
  "Link",
  "MarketingSignupLink",
  "MonoTag",
])
const PRESENTATION_PROPS = new Set([
  "className",
  "title",
  "description",
  "eyebrow",
  "aria-label",
])
const PRESENTATION_COMPONENTS = new Set(["PageTitle", "SectionHeader"])

function tagName(node, source) {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText(source)
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
    return node.tagName.getText(source)
  return ""
}

// Keep every import, expression, tag, attribute name, URL and handler intact.
// Only text children of known display elements and literal presentation props
// may differ. A filename, a small diff or an author-supplied label is insufficient.
export function presentationShape(text, path) {
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  if (source.parseDiagnostics.length) throw new Error("Unparseable public page")
  const replacements = []
  function visit(node) {
    if (ts.isJsxText(node)) {
      const parent = tagName(node.parent, source)
      if (!node.getText(source).trim() || TEXT_PARENTS.has(parent))
        replacements.push([node.getFullStart(), node.end, "__CI_TEXT__"])
    }
    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      const name = node.name.getText(source)
      const parent = tagName(node.parent.parent, source)
      const intrinsic = /^[a-z][a-z0-9-]*$/.test(parent)
      if (
        PRESENTATION_PROPS.has(name) &&
        ((intrinsic && ["className", "title", "aria-label"].includes(name)) ||
          (PRESENTATION_COMPONENTS.has(parent) && name !== "className"))
      )
        replacements.push([
          node.initializer.getStart(source),
          node.initializer.end,
          name === "className"
            ? presentationClassShape(node.initializer.text)
            : '"__CI_PROP__"',
        ])
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  let result = text
  for (const [start, end, value] of replacements.sort((a, b) => b[0] - a[0]))
    result = result.slice(0, start) + value + result.slice(end)
  return result
}

export function isPresentationOnly(before, after, path) {
  return presentationShape(before, path) === presentationShape(after, path)
}

function requireKnownModuleResolution(sha, options) {
  const parsed = ts.parseConfigFileTextToJson(
    "tsconfig.json",
    readAt(sha, "tsconfig.json", options)
  )
  const config = parsed.config
  const compiler = config?.compilerOptions
  if (
    parsed.error ||
    config?.extends ||
    config?.references?.length ||
    compiler?.baseUrl !== undefined ||
    compiler?.rootDirs !== undefined ||
    compiler?.moduleSuffixes !== undefined ||
    JSON.stringify(compiler?.paths) !== JSON.stringify({ "@/*": ["./*"] })
  )
    throw new Error("Unqualified module resolution requires full validation")
}

// Next page modules must remain leaf entry points. An import of one from any
// other source widens its effects, including aliases, re-exports and literal
// dynamic imports. Computed dynamic imports make this proof unavailable.
export function findPageConsumers(sha, pagePaths, { cwd } = {}) {
  requireKnownModuleResolution(sha, { cwd })
  const pages = new Set(pagePaths.map((path) => path.replace(/\.tsx$/, "")))
  const consumers = []
  for (const { path, text } of readSourceTree(sha, { cwd })) {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
    if (source.parseDiagnostics.length)
      throw new Error("Cannot establish page consumers")
    const references = []
    function visit(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier
      )
        references.push(node.moduleSpecifier)
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ((ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === "require") ||
          ts.isMetaProperty(node.expression.expression))
      )
        throw new Error("Computed module discovery requires full validation")
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === "require"))
      ) {
        if (
          node.arguments.length !== 1 ||
          !ts.isStringLiteralLike(node.arguments[0])
        )
          throw new Error("Computed imports require full validation")
        references.push(node.arguments[0])
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    for (const reference of references) {
      if (!ts.isStringLiteralLike(reference))
        throw new Error("Unresolved module reference")
      const value = reference.text
      if (value.startsWith("#"))
        throw new Error("Package import aliases require full validation")
      const resolved = value.startsWith("@/")
        ? posix.join(".", value.slice(2))
        : value.startsWith(".")
          ? posix.normalize(posix.join(posix.dirname(path), value))
          : null
      if (resolved && isToolingSourcePath(resolved))
        throw new Error(
          "Application imports excluded tooling; consumers are uncertain"
        )
      if (resolved && pages.has(resolved.replace(/\.[cm]?[jt]sx?$/, "")))
        consumers.push(path)
    }
  }
  return [...new Set(consumers)].sort()
}
