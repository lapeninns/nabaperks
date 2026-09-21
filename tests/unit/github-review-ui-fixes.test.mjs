import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("counter QR card presents only when scans are available and never tracks downloads", () => {
  const source = readProjectFile(
    "components",
    "merchant",
    "counter-qr-card.tsx"
  )

  assert.match(source, /getLaunchBillingReadiness/)
  assert.match(source, /buildLaunchReadiness/)
  assert.match(source, /launchReady: readiness\.launchReady/)
  // Counter architecture: the card itself is the one present-mode trigger,
  // and the dialog root only mounts for a ready QR — paused, gated and
  // missing cards present nothing and are not tappable.
  assert.match(source, /state === "ready" \? \(\s*<PresentQrTrigger>\s*<button/)
  assert.match(source, /return state === "ready" \? \(\s*<PresentQrRoot/)
  assert.match(source, /state !== "ready" && "opacity-40"/)
  assert.match(source, /\{state === "paused" \? "Paused" : "Not live yet"\}/)
  assert.match(source, /Your venue QR is not ready yet/)
  assert.match(source, /logger\.warn\("counter\.qr_missing"/)
  assert.doesNotMatch(source, /Show full screen/)
  assert.doesNotMatch(source, /className="[^"]*max-w-full[^"]*"/)
})

test("login page normalizes repeated next and error search params before redirecting or rendering", () => {
  const source = readProjectFile("app", "(auth)", "login", "page.tsx")

  assert.match(source, /next\?: string \| string\[\]/)
  assert.match(source, /error\?: string \| string\[\]/)
  assert.match(
    source,
    /const next = safeMerchantNextPath\(firstSearchParam\(params\.next\) \?\? "\/app"\)/
  )
  assert.match(source, /const error = firstSearchParam\(params\.error\)/)
  assert.match(source, /redirect\(safeMerchantNextPath\(next\)\)/)
  assert.match(source, /next=\{next\}/)
  assert.match(source, /function firstSearchParam/)
  assert.doesNotMatch(source, /const next = params\.next/)
  assert.doesNotMatch(source, /next=\{params\.next\}/)
})

test("pilot note fields reset the controlled note type when the parent action form resets", () => {
  const source = readProjectFile("components", "admin", "pilot-note-fields.tsx")

  assert.match(source, /DEFAULT_PILOT_NOTE_TYPE = "support"/)
  assert.match(source, /const containerRef = useRef<HTMLDivElement>\(null\)/)
  assert.match(source, /containerRef\.current\?\.closest\("form"\)/)
  assert.match(source, /form\.addEventListener\("reset", resetNoteType\)/)
  assert.match(source, /form\.removeEventListener\("reset", resetNoteType\)/)
  assert.match(source, /setNoteType\(DEFAULT_PILOT_NOTE_TYPE\)/)
  assert.match(source, /value=\{noteType\}/)
})

test("design-sync DataTable reward badges are supported by the shared Badge API", () => {
  const preview = readProjectFile(".design-sync", "previews", "DataTable.tsx")
  const badge = readProjectFile("components", "ui", "badge.tsx")

  assert.match(preview, /"reward" : "secondary"/)
  assert.match(badge, /reward: "bg-reward text-reward-foreground/)
})

test("admin customer mobile record cards constrain long values and action forms", () => {
  const recordCard = readProjectFile("components", "admin", "record-card.tsx")
  const memberships = readProjectFile(
    "app",
    "admin",
    "customers",
    "customer-memberships-panel.tsx"
  )
  const rewards = readProjectFile(
    "app",
    "admin",
    "customers",
    "customer-rewards-panel.tsx"
  )

  assert.match(recordCard, /surface-card grid min-w-0/)
  assert.match(recordCard, /\[overflow-wrap:anywhere\]/)
  assert.match(memberships, /className="min-w-0 xl:min-w-\[280px\]"/)
  assert.match(rewards, /className="min-w-0 xl:min-w-\[260px\]"/)
})

test("venue launch form preserves saved Google Places provenance until address edit", () => {
  const location = readProjectFile("lib", "merchant", "location.ts")
  const panel = readProjectFile(
    "components",
    "merchant",
    "launch",
    "venue-panel.tsx"
  )
  const form = readProjectFile(
    "components",
    "merchant",
    "launch",
    "venue-location-form.tsx"
  )

  assert.match(
    location,
    /address_source, address_provider, address_provider_id/
  )
  assert.match(
    panel,
    /initialProvenance=\{venueProviderProvenance\(location\)\}/
  )
  assert.match(panel, /address_source !== "provider_lookup"/)
  assert.match(panel, /provider: "google_places"/)
  assert.match(form, /initialProvenance \?\? MANUAL_VENUE_PROVENANCE/)
  assert.match(form, /setProvenance\(MANUAL_VENUE_PROVENANCE\)/)
})
