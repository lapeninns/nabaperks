import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (...segments) => readFileSync(path.join(root, ...segments), "utf8")

test("customer stamp and home state use the venue trading date", () => {
  const helper = read("lib", "customer", "venue-trading-date.ts")
  const home = read("lib", "customer", "home.ts")
  const stamp = read("lib", "customer", "experience", "load-stamp.ts")

  assert.match(helper, /rpc\("venue_trading_date"/)
  assert.match(home, /getVenueTradingDate\(merchantId\)/)
  assert.match(home, /stampInfo\.latestBusinessDate ===/)
  assert.match(stamp, /getVenueTradingDate\(/)
  assert.match(stamp, /latest === tradingDate/)
  assert.doesNotMatch(home, /ukTodayIso/)
  assert.doesNotMatch(stamp, /ukTodayIso/)
})

test("next-stamp notifications use the bounded venue-day candidate contract", () => {
  const producer = read("lib", "notifications", "notification-producers.ts")
  const migration = read(
    "supabase",
    "migrations",
    "20260923100000_venue_trading_day.sql"
  )
  const nextStampProducer = producer.slice(
    producer.indexOf("async function enqueueNextStampAvailable"),
    producer.indexOf("async function enqueueDormantProgress")
  )

  assert.match(nextStampProducer, /rpc\(\s*"list_pending_next_stamp_available"/)
  assert.match(
    nextStampProducer,
    /const businessDate = stringValue\(row\.business_date\)/
  )
  assert.match(
    nextStampProducer,
    /const dedupeKey = stringValue\(row\.dedupe_key\)/
  )
  assert.doesNotMatch(nextStampProducer, /\.from\("customer_memberships"\)/)
  assert.match(migration, /private\.venue_trading_date\(/)
  assert.match(
    migration,
    /latest_earned\.earned_business_date < current_day\.business_date/
  )
  assert.match(
    migration,
    /notifications\.business_date = eligible\.business_date/
  )
  assert.match(migration, /limit p_limit/)
})

test("customer-facing trading-day copy does not describe a UK weekday calendar", () => {
  const visibleCopy = [
    read("app", "m", "[merchantSlug]", "page.tsx"),
    read("components", "customer", "customer-card-experience.tsx"),
    read("lib", "customer", "referral-bonus-bank-copy.ts"),
    read("lib", "legal", "content.ts"),
  ].join("\n")

  assert.doesNotMatch(visibleCopy, /UK business day/i)
  assert.match(visibleCopy, /next venue trading day/)
  assert.match(visibleCopy, /One stamp per venue trading day/)
  assert.match(
    visibleCopy,
    /referral bonus stamps can land per venue trading day/
  )
})
