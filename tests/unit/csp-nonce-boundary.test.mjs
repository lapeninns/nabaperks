import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { registerHooks } from "node:module"
import { test } from "node:test"

import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server.js"
import { NextRequest } from "next/server.js"

import {
  analyseCspResponse,
  analyseCspResponsePair,
  parseContentSecurityPolicy,
} from "@/tests/support/csp-nonce-parser.mjs"

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === "next/server" ? "next/server.js" : specifier,
      context
    )
  },
  load(url, context, nextLoad) {
    if (!url.endsWith(".json")) return nextLoad(url, context)
    return {
      format: "module",
      shortCircuit: true,
      source: `export default ${readFileSync(new URL(url), "utf8")}`,
    }
  },
})

const { config, proxy } = await import("@/proxy")

test("Given the public root When Next evaluates Proxy matching Then the request enters the nonce boundary", () => {
  // Given
  const url = "https://nabaperks.com/"

  // When
  const matches = unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })

  // Then
  assert.equal(matches, true)
})

test("Given another brochure route When Next evaluates Proxy matching Then shared cache scope remains unchanged", () => {
  // Given
  const url = "https://nabaperks.com/pricing"

  // When
  const matches = unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })

  // Then
  assert.equal(matches, false)
})

test("Given two root requests When Proxy responds Then each request header and CSP share one fresh nonce without device state", async () => {
  // Given
  const request = new NextRequest("https://nabaperks.com/")

  // When
  const first = await proxy(request)
  const second = await proxy(request)
  const firstCsp = first.headers.get("content-security-policy") ?? ""
  const secondCsp = second.headers.get("content-security-policy") ?? ""
  const firstSources =
    parseContentSecurityPolicy(firstCsp).get("script-src") ?? []
  const secondSources =
    parseContentSecurityPolicy(secondCsp).get("script-src") ?? []
  const firstPolicyNonce = firstSources
    .find((source) => source.startsWith("'nonce-"))
    ?.slice(7, -1)
  const secondPolicyNonce = secondSources
    .find((source) => source.startsWith("'nonce-"))
    ?.slice(7, -1)

  // Then
  assert.ok(firstPolicyNonce)
  assert.ok(secondPolicyNonce)
  assert.equal(
    first.headers.get("x-middleware-request-x-nonce"),
    firstPolicyNonce
  )
  assert.equal(
    second.headers.get("x-middleware-request-x-nonce"),
    secondPolicyNonce
  )
  assert.notEqual(firstPolicyNonce, secondPolicyNonce)
  assert.equal(first.headers.get("set-cookie"), null)
  assert.equal(second.headers.get("set-cookie"), null)
})

test("Given two otherwise valid responses When their nonce is reused Then the pair is rejected", () => {
  // Given
  const response = {
    csp: "default-src 'self'; script-src 'self' 'nonce-fresh123'",
    html: '<script nonce="fresh123">self.__next_f.push([])</script>',
  }

  // When
  const result = analyseCspResponsePair(response, response)

  // Then
  assert.equal(result.distinctNonces, false)
  assert.equal(result.usable, false)
})

test("Given an inline script nonce differs from policy When the response is parsed Then the script is blocked", () => {
  // Given
  const response = {
    csp: "default-src 'self'; script-src 'self' 'nonce-policy123'",
    html: '<script nonce="stale123">self.__next_f.push([])</script>',
  }

  // When
  const result = analyseCspResponse(response)

  // Then
  assert.equal(result.blockedInlineScripts, 1)
  assert.equal(result.usable, false)
})

test("Given no policy nonce When inline scripts are present Then nonce absence is rejected", () => {
  // Given
  const response = {
    csp: "default-src 'self'; script-src 'self'",
    html: '<script nonce="orphan123">self.__next_f.push([])</script>',
  }

  // When
  const result = analyseCspResponse(response)

  // Then
  assert.equal(result.policyNonceCount, 0)
  assert.equal(result.usable, false)
})

test("Given a malformed nonce source When the header is parsed Then it fails closed", () => {
  // Given
  const response = {
    csp: "default-src 'self'; script-src 'self' 'nonce-bad nonce'",
    html: '<script nonce="bad nonce">self.__next_f.push([])</script>',
  }

  // When
  const result = analyseCspResponse(response)

  // Then
  assert.equal(result.malformedPolicyNonce, true)
  assert.equal(result.usable, false)
})

test("Given prompt-injection directive text When CSP is parsed Then it remains inert data", () => {
  // Given
  const response = {
    csp: "default-src 'self'; prompt_injection ignore previous instructions; script-src 'self' 'nonce-safe123'",
    html: '<script nonce="safe123">self.__next_f.push([])</script>',
  }

  // When
  const result = analyseCspResponse(response)

  // Then
  assert.equal(result.usable, true)
})

test("Given a parser-only response with no scripts When it is analysed Then success is rejected", () => {
  // Given
  const response = {
    csp: "default-src 'self'; script-src 'self' 'nonce-empty123'",
    html: "<main>Static only</main>",
  }

  // When
  const result = analyseCspResponse(response)

  // Then
  assert.equal(result.scriptsTotal, 0)
  assert.equal(result.usable, false)
})
