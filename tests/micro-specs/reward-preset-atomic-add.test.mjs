import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

function readProjectFile(...segments) {
  return readFileSync(join(projectRoot, ...segments), "utf8")
}

function exportedSection(source, exportName) {
  const marker = `export async function ${exportName}`
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `${exportName} must be exported`)
  const nextExport = source.indexOf("\nexport ", start + marker.length)
  return source.slice(start, nextExport === -1 ? undefined : nextExport)
}

function sqlFunctionSection(source, functionName) {
  const marker = `create or replace function public.${functionName}`
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `${functionName} must be created by the migration`)
  const delimiter = source
    .slice(start)
    .match(/\nas (\$[a-z0-9_]*\$)\n/i)?.[1]
  assert.ok(delimiter, `${functionName} must declare a SQL body delimiter`)
  const end = source.indexOf(`\n${delimiter};`, start)
  assert.notEqual(end, -1, `${functionName} must have a complete SQL body`)
  return source.slice(start, end + delimiter.length + 2)
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length
}

test("RA-3: the action accepts preset ids only and crosses one atomic RPC boundary", () => {
  const actions = readProjectFile("app", "app", "card", "actions.ts")
  const action = exportedSection(actions, "addRewardPresetsAction")

  assert.match(action, /formData\s*\.\s*getAll\("presetId"\)/)
  assert.match(
    action,
    /resolveRewardPresetsByIds\(\s*merchant\.business_type,\s*submittedPresetIds\s*\)/
  )
  assert.equal(
    countMatches(action, /\.rpc\("add_reward_pool_presets"/g),
    1,
    "one submitted selection must make exactly one batch RPC call"
  )
  assert.doesNotMatch(action, /\.rpc\("upsert_reward_pool_item"/)
  assert.match(action, /p_presets:\s*\w+\.map\(/)
  assert.match(action, /preset_id:/)
  assert.match(action, /reward_name:/)
  assert.match(action, /reward_terms:/)
  assert.doesNotMatch(
    action,
    /formData\s*\.\s*(?:get|getAll)\("(?:rewardName|rewardTerms|weight|isActive|displayOrder)"\)/,
    "browser-authored reward copy and ordering must not enter the batch payload"
  )
})

test("RA-10/RA-12: action outcomes use house-authored no-change copy and post-commit continuation", () => {
  const actions = readProjectFile("app", "app", "card", "actions.ts")
  const action = exportedSection(actions, "addRewardPresetsAction")

  assert.match(
    actions,
    /Rewards not added\. Nothing was changed\. Your choices are still selected — try again\./
  )
  assert.match(
    actions,
    /We couldn't confirm whether those rewards were added\. Your choices are still selected — try again\. Already-added rewards won't duplicate\./
  )
  assert.match(actions, /session (?:has )?expired/i)
  assert.match(
    action,
    /isDefiniteRewardPresetRollbackCode\(error\.code\)/
  )
  assert.match(
    action,
    /presetIds:\s*presets\.map\(\(preset\) => preset\.id\)/,
    "retry state must use trusted, trimmed, deduplicated catalogue ids"
  )
  assert.match(action, /autoProvisionJoinQrFromSetup\(\)/)
  assert.match(action, /revalidateMerchantLaunchSurfaces\(merchant\.id\)/)
  assert.ok(
    action.indexOf('rpc("add_reward_pool_presets"') <
      action.indexOf("autoProvisionJoinQrFromSetup()"),
    "QR work must happen only after the batch RPC returns successfully"
  )
  assert.doesNotMatch(
    action,
    /(?:error|rpcError)\.(?:message|details|hint)/,
    "database/provider details must never be returned as merchant copy"
  )
})

test("RA-1/RA-2/RA-11: reward ideas expose draft multi-selection, separate customisation, and one mobile-persistent Add action", () => {
  const form = readProjectFile(
    "components",
    "merchant",
    "loyalty-card-form.tsx"
  )

  assert.match(form, /LAUNCH_MIN_ACTIVE_REWARDS/)
  assert.doesNotMatch(form, /const REQUIRED_ACTIVE_REWARDS\s*=\s*3/)
  assert.match(form, /selectedPresetIds/)
  assert.match(form, /reconcileSelectedPresetIdsAfterRewardSave/)
  assert.match(form, /aria-pressed=\{[^}]*selected[^}]*\}/)
  assert.match(
    form,
    /onKeyDown=\{\(event\) => \{[\s\S]*?event\.key !== " "[\s\S]*?event\.preventDefault\(\)[\s\S]*?togglePreset\(preset\)/
  )
  assert.match(form, /Customise \$?\{?preset\.rewardName\}?/)
  assert.match(form, /Edit \$?\{?[^}]*rewardName[^}]*\}?/)
  assert.match(form, /Add \$?\{?[^\n]*selected[^\n]*\}? reward/)
  assert.match(form, /fixed[^"\n]*bottom-[^"\n]*sm:static/)
  assert.match(form, /editingId === null[\s\S]*fixed/)
  assert.match(form, /pb-\[8\.75rem\][^"\n]*sm:pb-6/)
  assert.match(form, /dismissedBatchFeedback/)
  assert.match(form, /batchSuccessRef/)
  assert.match(form, /<RewardRow[\s\S]*?disabled=\{batchPending\}/)
  assert.match(form, /function RewardRow[\s\S]*?disabled=\{disabled\}/)
  assert.match(
    form,
    /editingId === null\s*\?\s*\([\s\S]*?<button[\s\S]*?disabled=\{batchPending\}[\s\S]*?Add a reward/
  )
  assert.match(
    form,
    /id=\{`\$\{draft\.id \?\? "new"\}-rewardName`\}[\s\S]*?autoFocus/
  )
  assert.match(form, /aria-live="polite"/)
  assert.match(form, /role="alert"/)
})

test("RA-11: the optional PWA install prompt yields the launch action area", () => {
  const pwa = readProjectFile("components", "pwa", "app-pwa.tsx")

  assert.match(pwa, /pathname === "\/app\/launch"/)
})

test("RA-4 through RA-9: the additive migration defines a locked atomic RPC and closes bypass ACLs", () => {
  const migrationPath = join(
    projectRoot,
    "supabase",
    "migrations",
    "20260710110000_atomic_reward_preset_add.sql"
  )
  assert.ok(
    existsSync(migrationPath),
    "the atomic reward preset migration must exist"
  )

  const migration = readFileSync(migrationPath, "utf8")
  const batch = sqlFunctionSection(migration, "add_reward_pool_presets")

  assert.match(batch, /p_merchant_id uuid/)
  assert.match(batch, /p_loyalty_card_id uuid/)
  assert.match(batch, /p_presets jsonb/)
  assert.match(batch, /security definer/)
  assert.match(batch, /set search_path = public, auth/)
  assert.match(batch, /auth\.uid\(\)/)
  assert.match(batch, /is_merchant_owner\(p_merchant_id\)/)
  assert.match(batch, /jsonb_array_length\(p_presets\)/)
  assert.match(batch, /(?:between 1 and 7|< 1[\s\S]*> 7)/)
  assert.match(batch, /from public\.loyalty_cards[\s\S]*for update/)
  assert.match(batch, /reward_pool_item_created/)
  assert.match(batch, /reward_pool_item_existing/)
  assert.match(batch, /insert into public\.product_events/)
  assert.match(batch, /insert into public\.audit_logs/)

  const validationIndex = batch.indexOf("jsonb_array_length(p_presets)")
  const lockIndex = batch.indexOf("for update")
  const firstInsertIndex = batch.indexOf("insert into public.reward_pool_items")
  assert.ok(validationIndex !== -1 && validationIndex < firstInsertIndex)
  assert.ok(lockIndex !== -1 && lockIndex < firstInsertIndex)

  const upsert = sqlFunctionSection(migration, "upsert_reward_pool_item")
  assert.match(upsert, /for update/)
  assert.match(
    sqlFunctionSection(migration, "delete_reward_pool_item"),
    /for update/
  )
  const collapseThenTrimKey =
    /pg_catalog\.lower\(\s*pg_catalog\.btrim\(\s*pg_catalog\.regexp_replace\(/
  assert.match(batch, collapseThenTrimKey)
  assert.match(upsert, collapseThenTrimKey)
  assert.ok(
    batch.includes("'(^[[:space:]]+|[[:space:]]+$)'") &&
      upsert.includes("'(^[[:space:]]+|[[:space:]]+$)'"),
    "batch and one-item writes trim non-space boundary whitespace"
  )
  const qrGuard = sqlFunctionSection(
    migration,
    "enforce_active_join_qr_reward_pool_minimum"
  )
  assert.match(qrGuard, /security definer/)
  assert.match(qrGuard, /set search_path = public/)
  assert.match(qrGuard, /from public\.loyalty_cards[\s\S]*for update/)
  assert.match(qrGuard, /from public\.reward_pool_items/)
  assert.match(qrGuard, /v_active_reward_count < 3/)
  assert.match(
    migration,
    /create trigger qr_codes_guard_active_join_reward_pool[\s\S]*before insert or update on public\.qr_codes[\s\S]*enforce_active_join_qr_reward_pool_minimum\(\)/
  )
  assert.match(
    migration,
    /revoke all on function public\.add_reward_pool_presets\(uuid, uuid, jsonb\) from public, anon/
  )
  assert.match(
    migration,
    /grant execute on function public\.add_reward_pool_presets\(uuid, uuid, jsonb\) to authenticated, service_role/
  )
  assert.match(
    migration,
    /revoke all on (?:table )?public\.reward_pool_items from authenticated/
  )
  assert.match(
    migration,
    /grant select on (?:table )?public\.reward_pool_items to authenticated/
  )
})
