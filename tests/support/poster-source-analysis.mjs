import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import ts from "typescript"

export function walkSourceFiles(directory, predicate) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walkSourceFiles(target, predicate))
    else if (predicate(target)) files.push(target)
  }
  return files.sort()
}

export function analyseTypeScript(
  filename,
  source = readFileSync(filename, "utf8")
) {
  const findings = []
  const lineCount = source.trimEnd().split(/\r?\n/).length
  if (lineCount >= 250)
    findings.push(`line count ${lineCount} is not below 250`)

  const scriptKind = filename.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  )
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) findings.push("explicit any")
    if (ts.isAsExpression(node)) findings.push("as assertion")
    if (ts.isTypeAssertionExpression(node)) findings.push("angle assertion")
    if (ts.isNonNullExpression(node)) findings.push("non-null assertion")
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return findings
}
