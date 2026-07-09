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

test("dashboard QR quick action stays hidden until scans are available", () => {
  const source = readProjectFile(
    "components",
    "merchant",
    "dashboard-qr-card.tsx"
  )

  assert.match(source, /getLaunchBillingReadiness/)
  assert.match(source, /buildLaunchReadiness/)
  assert.match(source, /scansAvailable=\{readiness\.launchReady\}/)
  assert.match(
    source,
    /const thumbnailQrSrc = scansAvailable\s+\? `\/app\/qr\/image\/\$\{qrCodeId\}\?w=256`\s+: null/
  )
  assert.match(source, /thumbnailQrSrc \? \([\s\S]*<img/)
  assert.match(source, /scansAvailable \? \([\s\S]*<PresentQrButton/)
  assert.match(source, /scansAvailable \? \([\s\S]*<CopyUrlButton/)
  assert.match(source, /Launch gated/)
  assert.match(source, /QR paused/)
  assert.doesNotMatch(source, /className="[^"]*max-w-full[^"]*"/)
})

test("login page normalizes repeated next and error search params before redirecting or rendering", () => {
  const source = readProjectFile("app", "(auth)", "login", "page.tsx")

  assert.match(source, /next\?: string \| string\[\]/)
  assert.match(source, /error\?: string \| string\[\]/)
  assert.match(
    source,
    /const next = firstSearchParam\(params\.next\) \?\? "\/app"/
  )
  assert.match(source, /const error = firstSearchParam\(params\.error\)/)
  assert.match(source, /redirect\(safeMerchantNextPath\(next\)\)/)
  assert.match(source, /next=\{next\}/)
  assert.match(source, /function firstSearchParam/)
  assert.doesNotMatch(source, /params\.next \?\? "\/app"/)
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

test("regulars calculator estimate email opens an unaddressed draft", () => {
  const source = readProjectFile(
    "components",
    "marketing",
    "landing",
    "regulars-calculator.tsx"
  )

  assert.match(source, /const mailto = `mailto:\?subject=/)
  assert.match(source, />Email this estimate</)
  assert.doesNotMatch(source, /OPERATOR\.supportEmail/)
  assert.doesNotMatch(source, /Email me this estimate/)
})

test("anti-fraud copy does not claim screenshots or shared QR links are blocked", () => {
  const source = readProjectFile(
    "components",
    "marketing",
    "landing",
    "counter-verified-stamp.tsx"
  )

  assert.match(source, /traceable source/)
  assert.doesNotMatch(source, /not a screenshot/)
  assert.doesNotMatch(source, /shared link/)
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
