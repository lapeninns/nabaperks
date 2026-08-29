import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "next-themes"

import { NEXT_THEMES_OPTIONS } from "@/lib/theme/next-themes-options"

import {
  dynamicContentSecurityPolicy,
  NEXT_THEMES_APP_RENDER_SCRIPT_SHA256,
  NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256,
  NEXT_THEMES_SCRIPT_SHA256,
  staticMarketingContentSecurityPolicy,
} from "@/lib/security/csp"

function sha256(body) {
  return `sha256-${createHash("sha256").update(body).digest("base64")}`
}

/**
 * The bootstrap body next-themes inlines is
 * `(${themeScriptFn.toString()})(${args})`, so it is a function of the BUNDLER
 * as well as of the options — which is why `lib/security/csp.ts` pins three
 * hashes and not one. Only the server-render path can be recomputed here (this
 * process has no webpack and no Turbopack), so the other two paths are stored
 * as the exact bodies read back from them and hashed the same way.
 *
 * Read back on the commit that re-pinned them for `enableSystem: false`:
 *
 * - PRODUCTION: `pnpm build`, then the inline theme <script> in
 *   `.next/server/app/index.html`.
 * - TURBOPACK_DEV: `pnpm dev`, then the inline theme <script> served on any page.
 *
 * The tail assertion below is what stops these going stale unnoticed: every one
 * of the three bodies has to end with the SAME argument list, and that list is
 * derived from the live `NEXT_THEMES_OPTIONS` rather than restated here. Change
 * an option and all three fail together.
 */
const PRODUCTION_BOOTSTRAP_BODY = `((a,b,c,d,e,f,g,h)=>{let i=document.documentElement,j=["light","dark"];function k(b){var c;(Array.isArray(a)?a:[a]).forEach(a=>{let c="class"===a,d=c&&f?e.map(a=>f[a]||a):e;c?(i.classList.remove(...d),i.classList.add(f&&f[b]?f[b]:b)):i.setAttribute(a,b)}),c=b,h&&j.includes(c)&&(i.style.colorScheme=c)}if(d)k(d);else try{let a=localStorage.getItem(b)||c,d=g&&"system"===a?window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light":a;k(d)}catch(a){}})("class","nabaperks-theme","light",null,["light","dark"],null,false,true)`

const TURBOPACK_DEV_BOOTSTRAP_BODY = `((e, i, s, u, m, a, l, h)=>{
    let d = document.documentElement, w = [
        "light",
        "dark"
    ];
    function p(n) {
        (Array.isArray(e) ? e : [
            e
        ]).forEach((y)=>{
            let k = y === "class", S = k && a ? m.map((f)=>a[f] || f) : m;
            k ? (d.classList.remove(...S), d.classList.add(a && a[n] ? a[n] : n)) : d.setAttribute(y, n);
        }), R(n);
    }
    function R(n) {
        h && w.includes(n) && (d.style.colorScheme = n);
    }
    function c() {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    if (u) p(u);
    else try {
        let n = localStorage.getItem(i) || s, y = l && n === "system" ? c() : n;
        p(y);
    } catch (n) {}
})("class","nabaperks-theme","light",null,["light","dark"],null,false,true)`

function bootstrapArguments(body) {
  const call = body.lastIndexOf("})(")
  assert.ok(call > -1, "the bootstrap body should be an invoked function")
  return body.slice(call + "})(".length, -1)
}

function nextThemesScript() {
  const markup = renderToStaticMarkup(
    createElement(
      ThemeProvider,
      // The REAL options object the app ships, not a copy of it. Hashing a
      // hand-rebuilt literal meant a prop change in theme-provider.tsx would
      // stale the CSP pin and break the theme bootstrap in production while
      // this test stayed green.
      NEXT_THEMES_OPTIONS,
      createElement("span", null, "x")
    )
  )
  const scriptStart = markup.indexOf(">") + 1
  const scriptEnd = markup.indexOf("</script>", scriptStart)
  assert.equal(
    markup.startsWith("<script>"),
    true,
    "next-themes should render its bootstrap script first"
  )
  assert.ok(scriptEnd > scriptStart, "next-themes should close its script")
  return markup.slice(scriptStart, scriptEnd)
}

test("Given next-themes renders its bootstrap script When CSP is built Then the pinned hash matches the script body", () => {
  const serverRenderBody = nextThemesScript()
  const hash = sha256(serverRenderBody)
  const csp = dynamicContentSecurityPolicy("test-nonce")

  assert.equal(hash, NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256)
  assert.ok(csp.includes(`'${NEXT_THEMES_SCRIPT_SHA256}'`))
  assert.ok(csp.includes(`'${NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256}'`))
  assert.ok(csp.includes(`'${NEXT_THEMES_APP_RENDER_SCRIPT_SHA256}'`))
  assert.match(csp, /'nonce-test-nonce'/)
  assert.match(csp, /'strict-dynamic'/)
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/)
})

test("Given three bundlers emit the bootstrap When the options change Then every pinned hash goes stale together", () => {
  const expectedArguments = bootstrapArguments(nextThemesScript())

  // Not a restatement of NEXT_THEMES_OPTIONS: this is the argument list the
  // real library produced from it two lines above. A stored body that no longer
  // ends with it is a pin for a configuration the app no longer ships.
  assert.equal(bootstrapArguments(PRODUCTION_BOOTSTRAP_BODY), expectedArguments)
  assert.equal(
    bootstrapArguments(TURBOPACK_DEV_BOOTSTRAP_BODY),
    expectedArguments
  )

  assert.equal(sha256(PRODUCTION_BOOTSTRAP_BODY), NEXT_THEMES_SCRIPT_SHA256)
  assert.equal(
    sha256(TURBOPACK_DEV_BOOTSTRAP_BODY),
    NEXT_THEMES_APP_RENDER_SCRIPT_SHA256
  )

  // Three distinct bodies, so three distinct hashes: a duplicate would mean one
  // render path is unpinned and CSP would block it.
  const pins = new Set([
    NEXT_THEMES_SCRIPT_SHA256,
    NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256,
    NEXT_THEMES_APP_RENDER_SCRIPT_SHA256,
  ])
  assert.equal(pins.size, 3)
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

test("Given brochure pages need shared caching When the root not-found boundary renders Then it stays prerenderable", () => {
  const notFound = readFileSync(
    new URL("../../app/not-found.tsx", import.meta.url),
    "utf8"
  )

  assert.doesNotMatch(notFound, /from "next\/server"/)
  assert.doesNotMatch(notFound, /connection\(\)/)
})
