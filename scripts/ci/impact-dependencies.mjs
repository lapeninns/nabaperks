import { readFileSync, existsSync, realpathSync, statSync } from "node:fs"
import { dirname, resolve, relative, isAbsolute, sep } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url))
const ENTRYPOINTS = [
  "scripts/ci/plan-checks.mjs",
  "scripts/ci/verify-impact-evidence.mjs",
  "scripts/ci/compare-targeted-evidence.mjs",
  "scripts/ci/run-targeted-checks.mjs",
  "scripts/ci/browser-workload.mjs",
  "scripts/ci/run-browser-pack.mjs",
  "scripts/ci/check-browser-image.mjs",
  "scripts/run-playwright.mjs",
  "playwright.config.ts",
  "tests/e2e/a11y.spec.ts",
  "tests/e2e/a11y.desktop.spec.ts",
  "tests/e2e/visual.spec.ts",
]

function localModule(root, importer, value) {
  if (!value.startsWith(".") && !value.startsWith("@/")) return null
  const base = value.startsWith("@/")
    ? resolve(root, value.slice(2))
    : resolve(root, dirname(importer), value)
  const path = [
    base,
    ...[
      ".mjs",
      ".js",
      ".ts",
      ".tsx",
      "/index.mjs",
      "/index.js",
      "/index.ts",
      "/index.tsx",
    ].map((extension) => base + extension),
  ].find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
  if (!path) throw new Error("Comparison dependency is missing")
  const name = relative(root, realpathSync(path))
  if (name === ".." || name.startsWith(`..${sep}`) || isAbsolute(name))
    throw new Error("Comparison dependency escapes its reviewed checkout")
  return name.split(sep).join("/")
}

// Resolve imports from this module's reviewed checkout, never from PR objects.
// A new dependency changes its already-covered importer first, so subsequent
// PRs automatically retain qualification for the complete transitive closure.
export function comparisonDependencies({
  root = PROJECT_ROOT,
  entrypoints = ENTRYPOINTS,
} = {}) {
  root = realpathSync(root)
  const pending = [...entrypoints]
  const paths = new Set()
  while (pending.length) {
    const path = pending.pop()
    if (paths.has(path)) continue
    paths.add(path)
    if (paths.size > 500)
      throw new Error("Comparison dependency graph is too large")
    const text = readFileSync(resolve(root, path), "utf8")
    if (Buffer.byteLength(text) > 1024 * 1024)
      throw new Error("Comparison dependency exceeds its size bound")
    if (path.endsWith(".json")) continue
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
    if (source.parseDiagnostics.length)
      throw new Error("Unparseable comparison dependency")
    function visit(node) {
      let reference
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier
      )
        reference = node.moduleSpecifier
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
          throw new Error(
            "Computed comparison dependencies cannot be qualified"
          )
        reference = node.arguments[0]
      }
      if (reference) {
        if (!ts.isStringLiteralLike(reference))
          throw new Error("Unresolved comparison dependency")
        const dependency = localModule(root, path, reference.text)
        if (dependency) pending.push(dependency)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return paths
}
