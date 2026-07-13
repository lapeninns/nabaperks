import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "next-themes"

import {
  dynamicContentSecurityPolicy,
  isStaticMarketingPath,
  NEXT_THEMES_APP_RENDER_SCRIPT_SHA256,
  NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256,
  NEXT_THEMES_SCRIPT_SHA256,
  staticMarketingContentSecurityPolicy,
} from "@/lib/security/csp"

function nextThemesScript() {
  const markup = renderToStaticMarkup(
    createElement(
      ThemeProvider,
      {
        attribute: "class",
        defaultTheme: "light",
        enableSystem: true,
        disableTransitionOnChange: true,
        storageKey: "nabaperks-theme",
      },
      createElement("span", null, "x")
    )
  )
  const match = markup.match(/<script[^>]*>([\s\S]*?)<\/script\s*>/i)
  assert.ok(
    match,
    "next-themes should render its inline theme bootstrap script"
  )
  return match[1]
}

test("Given next-themes renders its bootstrap script When CSP is built Then the pinned hash matches the script body", () => {
  const hash = `sha256-${createHash("sha256").update(nextThemesScript()).digest("base64")}`
  const csp = dynamicContentSecurityPolicy("test-nonce")

  assert.equal(hash, NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256)
  assert.ok(csp.includes(`'${NEXT_THEMES_SCRIPT_SHA256}'`))
  assert.ok(csp.includes(`'${NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256}'`))
  assert.ok(csp.includes(`'${NEXT_THEMES_APP_RENDER_SCRIPT_SHA256}'`))
  assert.match(csp, /'nonce-test-nonce'/)
  assert.match(csp, /'strict-dynamic'/)
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/)
})

test("Given venue search loads Google Places When dynamic CSP is built Then the exact Maps script origin is trusted", () => {
  const csp = dynamicContentSecurityPolicy("test-nonce")
  const scriptDirective = csp.match(/(?:^|; )script-src ([^;]+)/)?.[1] ?? ""
  const scriptElementDirective =
    csp.match(/(?:^|; )script-src-elem ([^;]+)/)?.[1] ?? ""

  for (const directive of [scriptDirective, scriptElementDirective]) {
    assert.match(directive, /(?:^| )https:\/\/maps\.googleapis\.com(?: |$)/)
    assert.doesNotMatch(directive, /\*\.googleapis\.com/)
  }
  assert.match(scriptDirective, /'nonce-test-nonce'/)
  assert.match(scriptDirective, /'strict-dynamic'/)
  assert.doesNotMatch(scriptDirective, /'unsafe-inline'/)
})

test("Given static brochure pages are prerendered When CSP is built Then inline scripts are allowed without a nonce", () => {
  const csp = staticMarketingContentSecurityPolicy()

  assert.match(csp, /script-src 'self' 'unsafe-inline'/)
  assert.match(csp, /script-src-elem 'self' 'unsafe-inline'/)
  assert.match(csp, /object-src 'none'/)
  assert.match(csp, /base-uri 'self'/)
  assert.match(csp, /frame-ancestors 'none'/)
  assert.doesNotMatch(csp, /nonce-/)
  assert.doesNotMatch(csp, /'strict-dynamic'/)
})

test("Given route groups are classified When proxy selects CSP Then only brochure routes use the static policy", () => {
  for (const pathname of [
    "/",
    "/about",
    "/loyalty-for-pubs",
    "/pricing",
    "/privacy",
    "/terms",
    "/guides/best-loyalty-ideas-for-pubs",
  ]) {
    assert.equal(isStaticMarketingPath(pathname), true, pathname)
  }

  for (const pathname of [
    "/app",
    "/admin",
    "/card/test-membership",
    "/home",
    "/q/test-qr",
    "/reward/test-reward",
    "/start",
  ]) {
    assert.equal(isStaticMarketingPath(pathname), false, pathname)
  }
})

test("Given nonce CSP protects dynamic pages When the root not-found boundary renders Then it opts into request-time rendering", () => {
  const notFound = readFileSync(
    new URL("../../app/not-found.tsx", import.meta.url),
    "utf8"
  )

  assert.match(notFound, /from "next\/server"/)
  assert.match(notFound, /connection\(\)/)
})
