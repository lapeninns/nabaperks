import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * contract-rewards-customer-birthday — source-contract tier. Proves the app seams are
 * wired for birthday issuance without a browser/DB: the pure window math, the
 * issuance helper + both hooks, the config action, the catalog twins, and the
 * cron registration.
 */
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const read = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")

test("R-9: the pure birthday window helpers are exported", () => {
  const source = read("lib", "rewards", "birthday.ts")
  assert.match(source, /export function isBirthdayMonth/)
  assert.match(source, /export function birthdayRewardExpiresAt/)
  assert.match(source, /export function currentBirthdayYear/)
})

test("R-7: the issuance helper calls the RPC and both hooks fire it", () => {
  const helper = read("lib", "rewards", "issue-birthday.ts")
  assert.match(helper, /export async function triggerBirthdayIssuanceForCustomer/)
  assert.match(helper, /issue_birthday_rewards/)

  const profile = read("app", "home", "(authed)", "profile", "actions.ts")
  assert.match(profile, /triggerBirthdayIssuanceForCustomer/)
  assert.match(profile, /after\(/)

  const join = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  assert.match(join, /triggerBirthdayIssuanceForCustomer/)
  assert.match(join, /after\(/)
})

test("R-5: the config action is registered and owner-scoped via the RPC", () => {
  const actions = read("app", "app", "card", "actions.ts")
  assert.match(actions, /export async function saveBirthdayRewardAction/)
  assert.match(actions, /save_loyalty_card_birthday_reward/)
})

test("R-6: the dashboard renders the prompt only when a DOB is missing", () => {
  const page = read("app", "home", "(authed)", "page.tsx")
  assert.match(page, /HomeBirthdayPrompt/)
  assert.match(page, /needsBirthday/)
})

test("the notification catalog carries both issued marketing types", () => {
  const catalog = read("lib", "notifications", "catalog.ts")
  assert.match(catalog, /"birthday_reward_issued"/)
  assert.match(catalog, /"merchant_reward_received"/)
  assert.match(catalog, /birthday_reward_issued: "marketing"/)
})

test("R-8: the birthday cron route is registered and authorized", () => {
  const route = read("app", "api", "cron", "birthday-rewards", "route.ts")
  assert.match(route, /issue_birthday_rewards/)
  assert.match(route, /isAuthorizedCronRequest/)
  assert.match(read("lib", "security", "cron-auth.ts"), /CRON_SECRET/)
  assert.match(route, /ok: true, issued/)

  const vercel = JSON.parse(read("vercel.json"))
  const paths = vercel.crons.map((cron) => cron.path)
  assert.ok(
    paths.includes("/api/cron/birthday-rewards"),
    "vercel.json registers the birthday cron"
  )
})
