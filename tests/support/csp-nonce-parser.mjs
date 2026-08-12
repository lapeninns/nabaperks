import { createHash } from "node:crypto"

const NONCE_SOURCE_PATTERN = /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/
const SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
const ATTRIBUTE_PATTERN = /([:\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g

export function parseContentSecurityPolicy(value) {
  const directives = new Map()

  for (const rawDirective of value.split(";")) {
    const [name, ...sources] = rawDirective.trim().split(/\s+/)
    if (name) directives.set(name.toLowerCase(), sources)
  }

  return directives
}

export function analyseCspResponse({ csp, html }) {
  const directives = parseContentSecurityPolicy(csp)
  const scriptSources = directives.get("script-src") ?? []
  const scriptElementSources =
    directives.get("script-src-elem") ?? scriptSources
  const policyNonces = scriptSources
    .map((source) => source.match(NONCE_SOURCE_PATTERN)?.[1])
    .filter((nonce) => nonce !== undefined)
  const scripts = parseScripts(html)
  const inlineScripts = scripts.filter((script) => script.src === undefined)
  const blockedInlineScripts = inlineScripts.filter((script) => {
    const nonceAllowed =
      script.nonce !== undefined && policyNonces.includes(script.nonce)
    const hash = `sha256-${createHash("sha256").update(script.body).digest("base64")}`
    const hashAllowed = scriptElementSources.includes(`'${hash}'`)
    return !nonceAllowed && !hashAllowed
  })
  const inlineNonces = [
    ...new Set(
      inlineScripts
        .map((script) => script.nonce)
        .filter((nonce) => nonce !== undefined)
    ),
  ]
  const malformedPolicyNonce = scriptSources.some(
    (source) =>
      source.startsWith("'nonce-") && !NONCE_SOURCE_PATTERN.test(source)
  )
  const hasUnsafeInline = [...scriptSources, ...scriptElementSources].includes(
    "'unsafe-inline'"
  )
  const hasUnsafeEval = scriptSources.includes("'unsafe-eval'")

  return {
    policyNonce: policyNonces.length === 1 ? policyNonces[0] : undefined,
    policyNonceCount: policyNonces.length,
    inlineNonces,
    scriptsTotal: scripts.length,
    inlineScriptsTotal: inlineScripts.length,
    blockedInlineScripts: blockedInlineScripts.length,
    hasUnsafeInline,
    hasUnsafeEval,
    malformedPolicyNonce,
    usable:
      scripts.length > 0 &&
      inlineScripts.length > 0 &&
      policyNonces.length === 1 &&
      !malformedPolicyNonce &&
      !hasUnsafeInline &&
      !hasUnsafeEval &&
      blockedInlineScripts.length === 0,
  }
}

export function analyseCspResponsePair(first, second) {
  const firstResult = analyseCspResponse(first)
  const secondResult = analyseCspResponse(second)

  return {
    first: firstResult,
    second: secondResult,
    distinctNonces:
      firstResult.policyNonce !== undefined &&
      secondResult.policyNonce !== undefined &&
      firstResult.policyNonce !== secondResult.policyNonce,
    usable:
      firstResult.usable &&
      secondResult.usable &&
      firstResult.policyNonce !== secondResult.policyNonce,
  }
}

function parseScripts(html) {
  return [...html.matchAll(SCRIPT_PATTERN)].map((match) => {
    const attributes = new Map()
    for (const attribute of match[1].matchAll(ATTRIBUTE_PATTERN)) {
      attributes.set(
        attribute[1].toLowerCase(),
        attribute[2] ?? attribute[3] ?? attribute[4] ?? ""
      )
    }

    return {
      body: match[2],
      nonce: attributes.get("nonce"),
      src: attributes.get("src"),
    }
  })
}
