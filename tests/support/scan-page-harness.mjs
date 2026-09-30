import { readFileSync } from "node:fs"
import path from "node:path"

import { build } from "esbuild"

/**
 * Bundles a merchant scan page (`app/app/{rewards,offers}/scan/...`) with every
 * app, Next and component import stubbed, then renders the page and awaits its
 * streamed child so a test sees the real routing decision: the redirect or
 * notFound it throws, or the element tree it returns.
 *
 * `state.impl[name]` answers each stubbed function; components render nothing.
 */
const IMPORT_PATTERN =
  /import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s+"([^"]+)"/g

const SPECIAL = {
  "server-only": "",
  "@/lib/navigation/safe-next-path": `export function merchantLoginHref(path) {
    return "/login?next=" + encodeURIComponent(path)
  }`,
  "next/navigation": `export function redirect(destination) {
    const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error
  }
  export function notFound() {
    const error = new Error("NEXT_NOT_FOUND"); error.notFound = true; throw error
  }`,
}

function importedNames(file) {
  const names = new Map()
  const source = readFileSync(file, "utf8")
  for (const [, defaultName, list, specifier] of source.matchAll(
    IMPORT_PATTERN
  )) {
    const entry = names.get(specifier) ?? { default: null, named: new Set() }
    if (defaultName) entry.default = defaultName
    for (const raw of (list ?? "").split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0]
      if (name && !name.startsWith("type ")) entry.named.add(name)
    }
    names.set(specifier, entry)
  }
  return names
}

function stubModule(specifier, entry) {
  if (specifier in SPECIAL) return SPECIAL[specifier]
  const body = [...entry.named].map((name) =>
    /^[A-Z]/.test(name)
      ? `export function ${name}() { return null }`
      : `export function ${name}(...args) {
          state.calls.push(${JSON.stringify(name)});
          const impl = state.impl[${JSON.stringify(name)}];
          return typeof impl === "function" ? impl(...args) : impl
        }`
  )
  if (entry.default) body.push("export default function Stub() { return null }")
  return `import { state } from "fixture-state";\n${body.join("\n")}`
}

export async function loadScanPage(relativeFile) {
  const root = process.cwd()
  const entry = path.join(root, relativeFile)
  const names = importedNames(entry)
  const result = await build({
    stdin: {
      contents: `export { default } from ${JSON.stringify(`./${relativeFile}`)};
        export { state } from "fixture-state";`,
      resolveDir: root,
      loader: "tsx",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    write: false,
    logLevel: "silent",
    plugins: [
      {
        name: "scan-page-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/|@\/)/ },
            ({ path: specifier }) => ({ path: specifier, namespace: "fixture" })
          )
          build.onLoad(
            { filter: /.*/, namespace: "fixture" },
            ({ path: id }) => ({
              contents:
                id === "fixture-state"
                  ? "export const state = { calls: [], impl: {} };"
                  : stubModule(
                      id,
                      names.get(id) ?? { default: null, named: new Set() }
                    ),
              resolveDir: root,
            })
          )
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
}

function findStream(node, key) {
  if (!node || typeof node !== "object") return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findStream(child, key)
      if (hit) return hit
    }
    return null
  }
  if (typeof node.type === "function" && node.props && key in node.props)
    return node
  return findStream(node.props?.children, key)
}

/**
 * Renders the page and its streamed section. Resolves to
 * `{ redirect }`, `{ notFound: true }` or `{ tree }`.
 */
export async function renderScanPage(page, { params, key, searchParams = {} }) {
  try {
    const shell = await page({
      params: Promise.resolve(params),
      searchParams: Promise.resolve(searchParams),
    })
    const stream = findStream(shell, key)
    if (!stream) throw new Error(`no streamed element with prop ${key}`)
    return { tree: await stream.type(stream.props) }
  } catch (error) {
    if (error?.destination) return { redirect: error.destination }
    if (error?.notFound) return { notFound: true }
    throw error
  }
}

/** Every string in an element tree, including string props such as titles. */
export function treeText(node) {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(treeText).join(" ")
  if (typeof node === "object" && node.props) {
    const own = Object.entries(node.props)
      .filter(
        ([name, value]) => name !== "children" && typeof value === "string"
      )
      .map(([, value]) => value)
    return [...own, treeText(node.props.children)].join(" ")
  }
  return ""
}
