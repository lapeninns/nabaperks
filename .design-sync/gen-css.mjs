// Regenerates the design-sync cssEntry (.ds-sync/wetink.css) — RUN BEFORE EACH
// converter build. Two parts:
//   1. Compile Tailwind v4 from app/globals.css (auto content-detection over the
//      repo) → the used utilities + the @theme/:root Wet Ink tokens.
//   2. Append the self-contained brand @font-face + --font-* vars
//      (.design-sync/fonts/wetink-fonts.css), so previews/designs render in
//      Bricolage Grotesque / Space Mono instead of a fallback.
// Output is gitignored scratch; the durable inputs are app/globals.css and
// .design-sync/fonts/wetink-fonts.css.
import { execFileSync } from 'node:child_process'
import { readFileSync, appendFileSync, existsSync, statSync } from 'node:fs'

const CLI = '.ds-sync/node_modules/@tailwindcss/cli/dist/index.mjs'
const OUT = '.ds-sync/wetink.css'
const FONTS = '.design-sync/fonts/wetink-font-vars.css'

if (!existsSync(CLI)) {
  console.error(`✗ ${CLI} missing — run \`(cd .ds-sync && npm i @tailwindcss/cli@4.3.0)\` first.`)
  process.exit(1)
}
execFileSync(process.execPath, [CLI, '-i', 'app/globals.css', '-o', OUT], { stdio: 'inherit' })
if (existsSync(FONTS)) {
  appendFileSync(OUT, '\n' + readFileSync(FONTS, 'utf8'))
  console.error(`✓ appended ${FONTS}`)
} else {
  console.error(`! ${FONTS} not found — bundle will render in fallback fonts. Run gen-fonts.mjs.`)
}
console.error(`✓ ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)} KB)`)
