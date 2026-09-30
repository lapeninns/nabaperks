import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import ts from "typescript"

/**
 * QA BUG-068 (38c42a1..2c45031): Next compiles every "use server" function
 * under app/ into the production server-reference manifest and runs any known
 * action ID posted to any page. The /dev layout's notFound() only runs during
 * render, after the action has already executed, so a harness action with no
 * guard of its own ran in production (one held a request for 60 s).
 *
 * Every server action under app/dev must therefore open with
 * `if (process.env.NODE_ENV === "production") notFound()`. This parses the
 * source with the TypeScript compiler, so it finds module-level "use server"
 * exports and inline "use server" functions alike.
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const devRoot = path.join(projectRoot, "app", "dev")

function listSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(fullPath)
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : []
  })
}

function hasUseServerDirective(statements) {
  for (const statement of statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    ) {
      return false
    }
    if (statement.expression.text === "use server") return true
  }
  return false
}

function firstNonDirective(statements) {
  return statements.find(
    (statement) =>
      !(
        ts.isExpressionStatement(statement) &&
        ts.isStringLiteral(statement.expression)
      )
  )
}

function isNotFoundCall(node) {
  const expression = ts.isExpressionStatement(node) ? node.expression : null
  return Boolean(
    expression &&
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "notFound"
  )
}

function isProductionGuard(statement, sourceFile) {
  if (!statement || !ts.isIfStatement(statement)) return false
  const condition = statement.expression
    .getText(sourceFile)
    .replace(/\s+/g, " ")
  if (condition !== 'process.env.NODE_ENV === "production"') return false
  const then = statement.thenStatement
  return ts.isBlock(then)
    ? then.statements.length > 0 && isNotFoundCall(then.statements[0])
    : isNotFoundCall(then)
}

function isExported(node) {
  return Boolean(
    ts.canHaveModifiers(node) &&
    ts
      .getModifiers(node)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  )
}

function functionName(node) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text
  const parent = node.parent
  if (
    parent &&
    ts.isVariableDeclaration(parent) &&
    ts.isIdentifier(parent.name)
  )
    return parent.name.text
  return "<anonymous>"
}

/** Every server action a file defines, with whether it is guarded. */
function serverActionsIn(filePath) {
  const source = readFileSync(filePath, "utf8")
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const moduleLevel = hasUseServerDirective(sourceFile.statements)
  const actions = []

  function record(fn) {
    const body = fn.body
    const statements = body && ts.isBlock(body) ? body.statements : []
    actions.push({
      name: functionName(fn),
      guarded: isProductionGuard(firstNonDirective(statements), sourceFile),
    })
  }

  if (moduleLevel) {
    for (const statement of sourceFile.statements) {
      if (ts.isFunctionDeclaration(statement) && isExported(statement)) {
        record(statement)
      }
      if (ts.isVariableStatement(statement) && isExported(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const init = declaration.initializer
          if (
            init &&
            (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
          ) {
            record(init)
          }
        }
      }
    }
  }

  function visit(node) {
    if (
      ts.isFunctionLike(node) &&
      "body" in node &&
      node.body &&
      ts.isBlock(node.body) &&
      hasUseServerDirective(node.body.statements)
    ) {
      record(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return {
    actions,
    importsNotFound:
      /import \{[^}]*\bnotFound\b[^}]*\} from "next\/navigation"/.test(source),
  }
}

test("Given harness server actions under app/dev When a production build receives their IDs Then each one refuses with notFound before doing anything (QA BUG-068)", () => {
  const found = []
  const unguarded = []

  for (const filePath of listSourceFiles(devRoot)) {
    const relative = path
      .relative(projectRoot, filePath)
      .split(path.sep)
      .join("/")
    const { actions, importsNotFound } = serverActionsIn(filePath)
    for (const action of actions) {
      found.push(`${relative}#${action.name}`)
      if (!action.guarded || !importsNotFound) {
        unguarded.push(`${relative}#${action.name}`)
      }
    }
  }

  // The inventory is real: the actions the QA probe ran in production are in it.
  for (const known of [
    "app/dev/app-harness/dashboard/actions.ts#slowResetVenueCodeAction",
    "app/dev/claim-unsubscribe/actions.ts#harnessClaimUnsubscribeAction",
    "app/dev/app-harness/layout.tsx#noopSignOutAction",
    "app/dev/customer-login/actions.ts#submitLoginFixture",
  ]) {
    assert.ok(found.includes(known), `expected to find ${known}`)
  }
  assert.deepEqual(
    unguarded,
    [],
    'every app/dev server action must start with `if (process.env.NODE_ENV === "production") notFound()`'
  )
})
