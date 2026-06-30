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

test("Given merchant QR images are fetched by internal id When the owned context is loaded Then inactive and non-join QR rows are not renderable", () => {
  const qrCode = readProjectFile("lib", "merchant", "qr-code.ts")
  const imageRoute = readProjectFile(
    "app",
    "app",
    "qr",
    "image",
    "[qrCodeId]",
    "route.ts"
  )

  assert.match(imageRoute, /getOwnedQrImageContext\(qrCodeId\)/)
  assert.match(
    qrCode,
    /getOwnedQrImageContext[\s\S]*\.eq\("id", qrCodeId\)[\s\S]*\.eq\("merchant_id", merchant\.id\)[\s\S]*\.eq\("location_id", location\.id\)[\s\S]*\.eq\("loyalty_card_id", activeCard\.id\)[\s\S]*\.eq\("destination_type", "join"\)[\s\S]*\.eq\("is_active", true\)[\s\S]*\.maybeSingle\(\)/
  )
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
  assert.match(imageRoute, /const qrContext = await getOwnedQrImageContext\(qrCodeId\)/)
  assert.match(
    imageRoute,
    /if \(!qrContext\) \{[\s\S]*new NextResponse\("QR code not found", \{ status: 404 \}\)/
  )
  assert.match(
    imageRoute,
    /const shareUrl = `\$\{env\.NEXT_PUBLIC_APP_URL\}\/q\/\$\{qrContext\.qrCode\.qr_id\}`/
  )
  assert.match(imageRoute, /renderQrCodePng\(shareUrl\)/)
  assert.match(imageRoute, /"Content-Type": "image\/png"/)
  assert.match(imageRoute, /"Cache-Control": "private, no-store"/)
  assert.ok(
    imageRoute.indexOf("getOwnedQrImageContext(qrCodeId)") <
      imageRoute.indexOf("const env = getServerEnv()"),
    "route must prove ownership before deriving the public QR URL"
  )
  assert.doesNotMatch(imageRoute, /searchParams|nextUrl|request\.url/)
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
  assert.match(
    cardActions,
    /savedAction === "loyalty_card_created"[\s\S]*seedDefaultRewardPoolIfEmpty\(supabase, merchant\.id, savedCardId\)[\s\S]*revalidatePath\("\/app\/launch"\)/
  )
  assert.match(
    cardActions,
    /eventName: cardId \? "loyalty_card_updated" : "loyalty_card_created"/
  )
  assert.match(
    cardActions,
    /savedAction === "loyalty_card_created" \? "rewards" : "card"/
  )
  assert.match(
    cardActions,
    /savedAction === "loyalty_card_created" \? "pool" : "1"/
  )
  assert.match(
    cardActions,
    /savedAction === "loyalty_card_created" \? "&seeded=1"/
  )
})
