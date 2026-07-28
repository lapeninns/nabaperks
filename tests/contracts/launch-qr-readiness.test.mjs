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

test("Given join QR creation When SQL is reviewed Then the database requires three active rewards", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260630120000_require_three_rewards_for_join_qr.sql"
  )

  assert.match(
    migration,
    /create or replace function public\.create_or_get_join_qr/
  )
  assert.match(migration, /v_active_reward_count < 3/)
  assert.match(
    migration,
    /Add at least 3 active mystery rewards before launching the QR\./
  )
})

test("Given a disabled join QR When activation is reviewed Then app and SQL both enforce the same reward gate", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260630120000_require_three_rewards_for_join_qr.sql"
  )
  const qrActions = readProjectFile("app", "app", "qr", "actions.ts")

  assert.match(migration, /create or replace function public\.set_qr_active/)
  assert.match(migration, /if p_is_active then[\s\S]*v_active_reward_count < 3/)
  assert.match(
    qrActions,
    /nextActive && activeRewardPoolItemCount < LAUNCH_MIN_ACTIVE_REWARDS/
  )
  assert.match(qrActions, /QR_REWARD_POOL_ERROR/)
})

test("Given an admin reactivates a join QR When SQL is reviewed Then the same reward gate still applies", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260630132000_guard_admin_qr_activation.sql"
  )

  assert.match(
    migration,
    /create or replace function public\.admin_set_qr_active/
  )
  assert.match(
    migration,
    /p_is_active and qr_record\.destination_type = 'join'/
  )
  assert.match(migration, /v_active_reward_count < 3/)
  assert.match(
    migration,
    /Add at least 3 active mystery rewards before launching the QR\./
  )
  assert.match(
    migration,
    /update public\.qr_codes[\s\S]*set is_active = p_is_active/
  )
})

test("Given a disabled join QR already exists When create-or-get runs Then SQL re-enables the original slug instead of minting a suffix", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260630120000_require_three_rewards_for_join_qr.sql"
  )

  assert.match(
    migration,
    /where qr_codes\.merchant_id = p_merchant_id[\s\S]*qr_codes\.destination_type = 'join'[\s\S]*order by qr_codes\.created_at asc/
  )
  assert.doesNotMatch(
    migration,
    /destination_type = 'join'\s+and qr_codes\.is_active\s+order by qr_codes\.created_at asc/
  )
  assert.match(
    migration,
    /set loyalty_card_id = p_loyalty_card_id,\s+is_active = true/
  )
  assert.match(migration, /v_created boolean := false/)
})

test("Given a merchant owns a paused QR When its asset context loads Then the QR stays renderable without exposing non-join rows", () => {
  const qrCode = readProjectFile("lib", "merchant", "qr-code.ts")
  const imageRoute = readProjectFile(
    "app",
    "app",
    "qr",
    "image",
    "[qrCodeId]",
    "route.ts"
  )
  const loaderStart = qrCode.indexOf("async function loadOwnedQrImageContext")
  const loader = loaderStart === -1 ? "" : qrCode.slice(loaderStart)

  assert.match(imageRoute, /getOwnedQrImageContext\(qrCodeId\)/)
  assert.ok(loader, "QR image loader source must be present")
  assert.match(
    loader,
    /loadOwnedQrImageContext[\s\S]*\.eq\("id", qrCodeId\)[\s\S]*\.eq\("merchant_id", merchant\.id\)[\s\S]*\.eq\("destination_type", "join"\)[\s\S]*\.maybeSingle\(\)/
  )
  assert.doesNotMatch(
    loader.slice(0, loader.indexOf("const [locationResult")),
    /\.eq\("is_active", true\)/
  )
  assert.match(
    loader,
    /merchant_locations[\s\S]*\.eq\("id", qrCode\.location_id\)[\s\S]*\.eq\("merchant_id", merchant\.id\)/
  )
  assert.match(
    loader,
    /loyalty_cards[\s\S]*\.eq\("id", qrCode\.loyalty_card_id\)[\s\S]*\.eq\("merchant_id", merchant\.id\)[\s\S]*\.eq\("location_id", qrCode\.location_id\)/
  )
  assert.doesNotMatch(loader, /\.eq\("location_id", location\.id\)/)
  assert.doesNotMatch(loader, /\.eq\("loyalty_card_id", activeCard\.id\)/)
})

test("Given the merchant QR image route is hit When the owned context is absent Then only the owned active join QR path can render private PNG bytes", () => {
  const imageRoute = readProjectFile(
    "app",
    "app",
    "qr",
    "image",
    "[qrCodeId]",
    "route.ts"
  )

  assert.match(imageRoute, /const \{ qrCodeId \} = await context\.params/)
  assert.match(
    imageRoute,
    /process\.env\.NODE_ENV !== "production"[\s\S]*qrCodeId === DEV_HARNESS_QR_CODE_ID/
  )
  assert.match(
    imageRoute,
    /const qrContext = await getOwnedQrImageContext\(qrCodeId\)/
  )
  assert.match(
    imageRoute,
    /if \(!qrContext\) \{[\s\S]*new NextResponse\("QR code not found", \{ status: 404 \}\)/
  )
  assert.match(
    imageRoute,
    /const shareUrl = `\$\{getCanonicalAppOrigin\(\)\}\/q\/\$\{qrContext\.qrCode\.qr_id\}`/
  )
  assert.match(imageRoute, /renderQrCodePng\(\s*shareUrl,\s*parseQrImageWidth/)
  assert.match(imageRoute, /"Content-Type": "image\/png"/)
  assert.match(
    imageRoute,
    /"Cache-Control": "private, max-age=86400, immutable"/
  )
  assert.ok(
    imageRoute.indexOf("getOwnedQrImageContext(qrCodeId)") <
      imageRoute.indexOf("const shareUrl ="),
    "route must prove ownership before deriving the public QR URL"
  )
  const ownedRenderPath = imageRoute.slice(
    imageRoute.indexOf("const qrContext = await getOwnedQrImageContext")
  )
  assert.ok(
    ownedRenderPath.indexOf("parseQrImageWidth") >
      ownedRenderPath.indexOf("const shareUrl ="),
    "thumbnail width must not influence which QR URL is rendered"
  )
})

test("Given launch and QR pages render setup When the model loads Then GET rendering stays read-only and QR mutations stay behind explicit actions", () => {
  const launchPageModel = readProjectFile(
    "lib",
    "merchant",
    "launch-page-model.ts"
  )
  const qrActions = readProjectFile("app", "app", "qr", "actions.ts")
  const cardActions = readProjectFile("app", "app", "card", "actions.ts")
  const qrPanel = readProjectFile(
    "components",
    "merchant",
    "launch",
    "qr-panel.tsx"
  )

  assert.doesNotMatch(launchPageModel, /ensureJoinQrProvisioned/)
  assert.doesNotMatch(launchPageModel, /autoProvisionJoinQrFromSetup/)
  assert.doesNotMatch(launchPageModel, /create_or_get_join_qr/)
  assert.doesNotMatch(launchPageModel, /set_qr_active/)
  assert.match(
    qrActions,
    /export async function generateQrCodeAction[\s\S]*\.rpc\("create_or_get_join_qr"/
  )
  assert.match(
    qrActions,
    /export async function setQrActiveAction[\s\S]*\.rpc\("set_qr_active"/
  )
  assert.match(
    cardActions,
    /saveRewardPoolItemAction[\s\S]*autoProvisionJoinQrFromSetup/
  )
  assert.match(
    cardActions,
    /toggleRewardPoolItemActiveAction[\s\S]*autoProvisionJoinQrFromSetup/
  )
  assert.match(qrPanel, /<form action={generateQrCodeAction}>/)
})

test("Given billing is not ready When QR provision or enable is attempted Then every app write path fails closed", () => {
  const readinessCore = readProjectFile(
    "lib",
    "merchant",
    "launch-readiness-core.ts"
  )
  const ensureQr = readProjectFile("lib", "merchant", "ensure-join-qr.ts")
  const qrActions = readProjectFile("app", "app", "qr", "actions.ts")

  assert.match(
    readinessCore,
    /type EnsureJoinQrInput[\s\S]*billingReady: boolean/
  )
  assert.match(
    readinessCore,
    /isJoinQrProvisionEligible[\s\S]*input\.billingReady/
  )
  assert.match(ensureQr, /getLaunchBillingReadiness/)
  assert.match(ensureQr, /billingReady: isLaunchBillingReady\(billing\)/)
  assert.match(qrActions, /QR_BILLING_ERROR/)
  assert.match(
    qrActions,
    /generateQrCodeAction[\s\S]*isLaunchBillingReady\(billing\)[\s\S]*create_or_get_join_qr/
  )
  assert.match(
    qrActions,
    /setQrActiveAction[\s\S]*nextActive && !isLaunchBillingReady\(billing\)[\s\S]*set_qr_active/
  )
})

test("Given billing confirmation returns When source is inspected Then QR provisioning is an explicit return-only carve-out", () => {
  const launchPageModel = readProjectFile(
    "lib",
    "merchant",
    "launch-page-model.ts"
  )
  const billingReturn = readProjectFile(
    "lib",
    "merchant",
    "billing-checkout-return.ts"
  )

  assert.doesNotMatch(launchPageModel, /autoProvisionJoinQrFromSetup/)
  assert.match(
    billingReturn,
    /completeBillingCheckoutReturn[\s\S]*outcome\.kind === "confirmed"[\s\S]*autoProvisionJoinQrFromSetup/
  )
  assert.match(
    billingReturn,
    /completeBillingPortalReturn[\s\S]*outcome\.kind === "confirmed"[\s\S]*autoProvisionJoinQrFromSetup/
  )
})

test("Given billing is pending When no QR exists Then the QR panel stays locked without rendering an image", () => {
  const qrPanel = readProjectFile(
    "components",
    "merchant",
    "launch",
    "qr-panel.tsx"
  )
  assert.match(qrPanel, /if \(!billingReady && !qrCode\)/)
  assert.match(qrPanel, /Activate billing to unlock your venue QR/)
  assert.match(qrPanel, /href="\/app\/launch\?tab=billing"/)
})

test("Given billing lapses When a QR already exists Then scans pause without hiding poster or disable controls", () => {
  const qrPanel = readProjectFile(
    "components",
    "merchant",
    "launch",
    "qr-panel.tsx"
  )
  const livePanel = readProjectFile(
    "components",
    "merchant",
    "launch",
    "qr-panel-live.tsx"
  )
  const workspaceParts = readProjectFile(
    "components",
    "merchant",
    "launch",
    "qr-redesign-concept-parts.tsx"
  )

  assert.match(qrPanel, /isLaunchReadinessBillingReady\(readiness\)/)
  assert.doesNotMatch(qrPanel, /billingReady=\{!billingHref\}/)
  assert.match(workspaceParts, /Enabled · scans paused/)
  assert.match(livePanel, /Scans paused — fix billing/)
  assert.match(livePanel, /href="\/app\/launch\?tab=billing"/)
  assert.match(livePanel, /EmailPosterButton/)
  assert.match(livePanel, /Pause customer scans/)
})

test("Given scans are available When the QR panel renders Then distribution actions are explicit", () => {
  const livePanel = readProjectFile(
    "components",
    "merchant",
    "launch",
    "qr-panel-live.tsx"
  )
  const workspace = readProjectFile(
    "components",
    "merchant",
    "launch",
    "qr-redesign-concept.tsx"
  )

  assert.match(livePanel, /scansAvailable/)
  assert.match(workspace, /Print for the till/)
  assert.match(workspace, /Share digitally/)
  assert.match(workspace, /Open customer link/)
  assert.doesNotMatch(workspace, /Three quick checks/)
  assert.doesNotMatch(livePanel, /href="\/app\/scan"/)
})

test("Given the card setup form is saved When source is inspected Then validation RPC seed and redirect decisions stay coupled to the server action", () => {
  const cardActions = readProjectFile("app", "app", "card", "actions.ts")

  assert.match(
    cardActions,
    /export async function saveLoyaltyCardAction[\s\S]*const merchant = await getCurrentMerchant\(\)/
  )
  assert.match(cardActions, /if \(!cardName\) errors\.cardName/)
  assert.match(cardActions, /parsedStampsRequired < DEFAULT_STAMPS_REQUIRED/)
  assert.match(cardActions, /parsedStampsRequired > MAX_STAMPS_REQUIRED/)
  assert.match(cardActions, /rewardTerms\.length < 12/)
  assert.match(
    cardActions,
    /\.rpc\("save_loyalty_card", \{[\s\S]*p_merchant_id: merchant\.id[\s\S]*p_card_id: cardId \|\| null[\s\S]*p_stamps_required: parsedStampsRequired[\s\S]*p_is_active: isActive/
  )
  assert.doesNotMatch(cardActions, /seedDefaultRewardPool/)
  assert.match(
    cardActions,
    /eventName: cardId \? "loyalty_card_updated" : "loyalty_card_created"/
  )
  assert.match(
    cardActions,
    /savedAction === "loyalty_card_created"[\s\S]*"\/app\/launch\?tab=rewards"[\s\S]*"\/app\/launch\?tab=card&saved=1"/
  )
  assert.doesNotMatch(cardActions, /seeded=1/)
})
