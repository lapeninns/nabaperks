import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

import {
  isDatabaseConnectionRefused,
  printDatabaseConnectionHelp,
} from "./db-connection-help.mjs"

const projectDir = process.cwd()
const DEFAULT_MERCHANT_ID = "10000000-0000-0000-0000-000000000001"
const DEFAULT_LOCATION_ID = "11000000-0000-0000-0000-000000000001"
const DEFAULT_LOYALTY_CARD_ID = "13000000-0000-0000-0000-000000000001"
const STRESS_EMAIL_DOMAIN = "example.test"
const STRESS_SOURCE = "stress_seed"
const APPROVED_LOCAL_DATABASE_NAMES = new Set(["postgres", "nabaperks_task11"])
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
const args = isMain ? parseArgs(process.argv.slice(2)) : null

const env = {
  ...readEnvFile(join(projectDir, ".env.local")),
  ...readEnvFile(join(projectDir, ".env")),
  ...process.env,
}

if (isMain) {
  void runCli(env, args)
}

async function runCli(env, args) {
  const dbUrl = resolveDbUrl(env)

  if (!dbUrl) {
    console.error("SUPABASE_DB_URL is required for stress seeding.")
    process.exit(1)
  }

  assertWriteTargetIsSafe(dbUrl)

  const sql = postgres(dbUrl, {
    max: 1,
    ssl: shouldRequireSsl(dbUrl) ? "require" : undefined,
    transform: postgres.camel,
  })

  try {
    const count = args.count ?? 10_000
    if (args.dryRun) {
      printDryRunPlan(count, args)
      process.exit(0)
    }

    await verifyDatabaseConnection(sql, dbUrl)

    if (args.clean) {
      assertCleanupDatabaseNamespace(dbUrl)
      await cleanStressData(sql, args.merchantId)
      if (!args.count) {
        console.log("Stress seed cleanup completed.")
        process.exit(0)
      }
    }

    await seedStressData(sql, count, args)
    console.log(
      `Stress seed completed: ${count.toLocaleString()} members on merchant ${args.merchantId}.`
    )
  } catch (error) {
    console.error("Stress seed failed.")
    if (isDatabaseConnectionRefused(error)) {
      printDatabaseConnectionHelp(
        safeDbTarget(dbUrl),
        "pnpm db:setup && pnpm db:seed:stress"
      )
    } else if (error instanceof Error) {
      console.error(error.message)
    }
    process.exitCode = 1
  } finally {
    await sql.end({ timeout: 5 })
  }
}

export function parseArgs(argv) {
  let hasExplicitMerchantId = false
  const parsed = {
    count: 10_000,
    batch: 1_000,
    merchantId: DEFAULT_MERCHANT_ID,
    locationId: DEFAULT_LOCATION_ID,
    loyaltyCardId: DEFAULT_LOYALTY_CARD_ID,
    stampsPerMember: 1,
    withEvents: true,
    clean: false,
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    // pnpm forwards shell comments as extra argv tokens when copy-pasted inline.
    if (token === "#" || token.startsWith("#")) {
      break
    }

    if (token === "--clean") {
      parsed.clean = true
      continue
    }

    if (token === "--dry-run") {
      parsed.dryRun = true
      continue
    }

    if (token === "--no-events") {
      parsed.withEvents = false
      continue
    }

    if (token === "--") {
      continue
    }

    if (token.startsWith("--merchant-id=")) {
      parsed.merchantId = parseMerchantId(token.slice("--merchant-id=".length))
      hasExplicitMerchantId = true
      continue
    }

    const value = argv[index + 1]
    if (value === undefined) {
      throw new Error(`Missing value for ${token}`)
    }

    switch (token) {
      case "--count":
        parsed.count = parsePositiveInt(value, "--count")
        index += 1
        break
      case "--batch":
        parsed.batch = parsePositiveInt(value, "--batch")
        index += 1
        break
      case "--merchant-id":
        parsed.merchantId = parseMerchantId(value)
        hasExplicitMerchantId = true
        index += 1
        break
      case "--location-id":
        parsed.locationId = value
        index += 1
        break
      case "--loyalty-card-id":
        parsed.loyaltyCardId = value
        index += 1
        break
      case "--stamps":
        parsed.stampsPerMember = parseNonNegativeInt(value, "--stamps")
        index += 1
        break
      default:
        throw new Error(`Unknown argument: ${token}`)
    }
  }

  if (parsed.clean && !hasExplicitMerchantId) {
    throw new Error("--merchant-id is required with --clean")
  }

  if (parsed.clean && argv.includes("--count")) {
    // Explicit --count with --clean means clean then seed.
  } else if (parsed.clean && !argv.some((token) => token === "--count")) {
    parsed.count = 0
  }

  return parsed
}

function parseMerchantId(value) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error("--merchant-id must be a UUID")
  }
  return value.toLowerCase()
}

function parsePositiveInt(value, flag) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`)
  }
  return parsed
}

function parseNonNegativeInt(value, flag) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 3) {
    throw new Error(`${flag} must be an integer between 0 and 3`)
  }
  return parsed
}

export function stressEmail(index) {
  return `stress+${index}@${STRESS_EMAIL_DOMAIN}`
}

export function stressCustomerId(index) {
  return formatStressUuid("a0000000", index)
}

export function stressMembershipId(index) {
  return formatStressUuid("b0000000", index)
}

export function stressStampId(index, stampOffset = 0) {
  return formatStressUuid("c0000000", index * 4 + stampOffset)
}

export function stressProductEventId(index, kind = 0) {
  return formatStressUuid("d0000000", index * 8 + kind)
}

/** Spread joins, visits, and stamps across ~18 months. */
export const STRESS_HISTORY_DAYS = 540

export function stressDayOffsetFor(index, stampOffset = 0) {
  return (index * 17 + stampOffset * 31) % STRESS_HISTORY_DAYS
}

export function stressTimestampFor(index, stampOffset = 0, minuteSkew = 0) {
  const dayOffset = stressDayOffsetFor(index, stampOffset)
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - dayOffset)
  date.setUTCHours(8 + (index % 11), (index * 13 + minuteSkew) % 60, 0, 0)
  return date
}

export function joinedAtForIndex(index) {
  return stressTimestampFor(index, 0, 0)
}

export function earnedBusinessDateFor(index, stampOffset) {
  return stressTimestampFor(index, stampOffset, stampOffset * 5)
    .toISOString()
    .slice(0, 10)
}

export function stampCreatedAtFor(index, stampOffset, joinedAt) {
  const created = stressTimestampFor(index, stampOffset, stampOffset * 5)
  if (created < joinedAt) {
    return new Date(joinedAt.getTime() + (stampOffset + 1) * 3_600_000)
  }
  return created
}

export function lastVisitAtForIndex(index, joinedAt, stampTimes) {
  const latestStamp = stampTimes.reduce(
    (latest, current) => (current > latest ? current : latest),
    joinedAt
  )

  if (index % 5 === 0) {
    const recent = new Date()
    recent.setUTCDate(recent.getUTCDate() - (index % 21))
    recent.setUTCHours(11 + (index % 7), (index * 5) % 60, 0, 0)
    return recent > latestStamp ? recent : latestStamp
  }

  return latestStamp
}

export function dateOfBirthForIndex(index) {
  const year = 1975 + (index % 28)
  const month = (index % 12) + 1
  const day = (index % 27) + 1
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function formatStressUuid(prefix, index) {
  if (!Number.isInteger(index) || index < 0 || index > 0xffff_ffff_ffff) {
    throw new Error(`Stress seed index out of range: ${index}`)
  }
  return `${prefix}-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
}

async function verifyDatabaseConnection(sql, dbUrl) {
  try {
    await sql`select 1 as ok`
    console.log(`Connected to ${safeDbTarget(dbUrl)}.`)
  } catch (error) {
    if (isDatabaseConnectionRefused(error)) {
      printDatabaseConnectionHelp(
        safeDbTarget(dbUrl),
        "pnpm db:setup && pnpm db:seed:stress"
      )
      process.exit(1)
    }
    throw error
  }
}

async function seedStressData(sql, count, config) {
  await assertMerchantFixture(sql, config.merchantId)

  const startedAt = Date.now()
  let insertedCustomers = 0
  let insertedMemberships = 0
  let insertedStamps = 0
  let insertedEvents = 0

  for (let offset = 1; offset <= count; offset += config.batch) {
    const batchEnd = Math.min(offset + config.batch - 1, count)

    const customers = []
    const memberships = []
    const stamps = []
    const events = []

    for (let index = offset; index <= batchEnd; index += 1) {
      const customerId = stressCustomerId(index)
      const membershipId = stressMembershipId(index)
      const stampCount = config.stampsPerMember
      const joinedAt = joinedAtForIndex(index)
      const stampTimes = []

      customers.push({
        id: customerId,
        email: stressEmail(index),
        emailVerifiedAt: joinedAt,
        fullName: `Stress Member ${index}`,
        dateOfBirth: dateOfBirthForIndex(index),
        phoneLast4: String(index % 10_000).padStart(4, "0"),
      })

      for (let stampIndex = 0; stampIndex < stampCount; stampIndex += 1) {
        const stampCreatedAt = stampCreatedAtFor(index, stampIndex, joinedAt)
        stampTimes.push(stampCreatedAt)
        stamps.push({
          id: stressStampId(index, stampIndex),
          merchantId: config.merchantId,
          customerId,
          membershipId,
          loyaltyCardId: config.loyaltyCardId,
          locationId: config.locationId,
          eventType: "earned",
          stampsDelta: 1,
          cycleNumber: 1,
          earnedBusinessDate: earnedBusinessDateFor(index, stampIndex),
          createdAt: stampCreatedAt,
          metadata: { source: STRESS_SOURCE },
        })
      }

      const lastVisitAt = lastVisitAtForIndex(index, joinedAt, stampTimes)

      memberships.push({
        id: membershipId,
        merchantId: config.merchantId,
        customerId,
        currentStampCount: stampCount,
        totalStampsEarned: stampCount,
        activeCycleNumber: 1,
        lastVisitAt,
        createdAt: joinedAt,
        updatedAt: lastVisitAt,
      })

      if (config.withEvents) {
        events.push({
          id: stressProductEventId(index, 0),
          eventName: "customer_joined",
          merchantId: config.merchantId,
          customerId,
          membershipId,
          actorType: "system",
          actorId: "stress_seed",
          createdAt: joinedAt,
          metadata: { source: STRESS_SOURCE },
        })

        for (let stampIndex = 0; stampIndex < stampCount; stampIndex += 1) {
          events.push({
            id: stressProductEventId(index, 1 + stampIndex),
            eventName: "stamp_issued",
            merchantId: config.merchantId,
            customerId,
            membershipId,
            actorType: "system",
            actorId: "stress_seed",
            createdAt: stampTimes[stampIndex],
            metadata: { source: STRESS_SOURCE, stamps_delta: 1 },
          })
        }
      }
    }

    await sql.begin(async (transaction) => {
      await transaction`
        insert into public.customers ${transaction(customers)}
        on conflict (id) do update set
          email = excluded.email,
          email_verified_at = excluded.email_verified_at,
          full_name = excluded.full_name,
          date_of_birth = excluded.date_of_birth,
          phone_last4 = excluded.phone_last4,
          updated_at = now()
      `

      await transaction`
        insert into public.customer_memberships ${transaction(memberships)}
        on conflict (id) do update set
          current_stamp_count = excluded.current_stamp_count,
          total_stamps_earned = excluded.total_stamps_earned,
          active_cycle_number = excluded.active_cycle_number,
          last_visit_at = excluded.last_visit_at,
          updated_at = now()
      `

      if (stamps.length > 0) {
        await transaction`
          insert into public.stamp_events ${transaction(stamps)}
          on conflict (id) do nothing
        `
      }

      if (events.length > 0) {
        await transaction`
          insert into public.product_events ${transaction(events)}
          on conflict (id) do nothing
        `
      }
    })

    insertedCustomers += customers.length
    insertedMemberships += memberships.length
    insertedStamps += stamps.length
    insertedEvents += events.length

    console.log(
      `Seeded ${batchEnd.toLocaleString()}/${count.toLocaleString()} members ` +
        `(customers ${insertedCustomers.toLocaleString()}, stamps ${insertedStamps.toLocaleString()}, events ${insertedEvents.toLocaleString()})`
    )
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(
    `Inserted ${insertedCustomers.toLocaleString()} customers, ` +
      `${insertedMemberships.toLocaleString()} memberships, ` +
      `${insertedStamps.toLocaleString()} stamp events, ` +
      `${insertedEvents.toLocaleString()} product events in ${elapsedSeconds}s.`
  )
}

async function cleanStressData(sql, merchantId) {
  const startedAt = Date.now()

  await sql.begin(async (transaction) => {
    const [merchant] = await transaction`
      select id
      from public.merchants
      where id = ${merchantId}
      limit 1
    `
    if (!merchant) {
      throw new Error("The selected merchant was not found in this database.")
    }

    await transaction`
      create temporary table stress_cleanup_ownership
      on commit drop
      as
      select memberships.merchant_id,
             memberships.customer_id,
             memberships.id as membership_id
      from public.customer_memberships memberships
      join public.customers customers on customers.id = memberships.customer_id
      where memberships.merchant_id = ${merchantId}
        and customers.email like ${`stress+%@${STRESS_EMAIL_DOMAIN}`}
    `
    const [ownership] = await transaction`
      select (
        (select count(*) from stress_cleanup_ownership
         where merchant_id = ${merchantId})
        + (select count(*) from public.product_events
           where merchant_id = ${merchantId}
             and metadata ->> 'source' = ${STRESS_SOURCE})
        + (select count(*) from public.stamp_events
           where merchant_id = ${merchantId}
             and metadata ->> 'source' = ${STRESS_SOURCE})
        + (select count(*) from public.reward_events
           where merchant_id = ${merchantId}
             and metadata ->> 'source' = ${STRESS_SOURCE})
      )::int as owned_count
    `
    if (ownership.ownedCount === 0) {
      throw new Error(
        "The selected merchant has no stress seed rows to remove."
      )
    }

    await transaction`
      delete from public.product_events
      where merchant_id = ${merchantId}
        and (
          metadata ->> 'source' = ${STRESS_SOURCE}
          or customer_id in (
            select customer_id
            from stress_cleanup_ownership
            where merchant_id = ${merchantId}
          )
        )
    `
    await transaction`
      delete from public.stamp_events
      where merchant_id = ${merchantId}
        and (
          metadata ->> 'source' = ${STRESS_SOURCE}
          or membership_id in (
            select membership_id
            from stress_cleanup_ownership
            where merchant_id = ${merchantId}
          )
        )
    `
    await transaction`
      delete from public.reward_events
      where merchant_id = ${merchantId}
        and (
          metadata ->> 'source' = ${STRESS_SOURCE}
          or membership_id in (
            select membership_id
            from stress_cleanup_ownership
            where merchant_id = ${merchantId}
          )
        )
    `
    await transaction`
      delete from public.customer_memberships
      where merchant_id = ${merchantId}
        and id in (
          select membership_id
          from stress_cleanup_ownership
          where merchant_id = ${merchantId}
        )
    `
    await transaction`
      delete from public.customers
      where id in (
        select customer_id
        from stress_cleanup_ownership
        where merchant_id = ${merchantId}
      )
        and not exists (
          select 1
          from public.customer_memberships memberships
          where memberships.customer_id = customers.id
        )
    `
  })

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`Removed stress seed members in ${elapsedSeconds}s.`)
}

async function assertMerchantFixture(sql, merchantId) {
  const [merchant] = await sql`
    select id, business_name
    from public.merchants
    where id = ${merchantId}
    limit 1
  `

  if (!merchant) {
    throw new Error(
      `Merchant ${merchantId} was not found. Run pnpm db:setup before pnpm db:seed:stress.`
    )
  }

  const [card] = await sql`
    select id
    from public.loyalty_cards
    where merchant_id = ${merchantId}
      and is_active = true
    limit 1
  `

  if (!card) {
    throw new Error(
      `Merchant ${merchant.businessName} has no active loyalty card. Run pnpm db:seed first.`
    )
  }

  console.log(
    `Seeding stress members for ${merchant.businessName} (${merchantId}).`
  )
}

function printDryRunPlan(count, config) {
  console.log("Stress seed dry run:")
  console.log(`- members: ${count.toLocaleString()}`)
  console.log(`- batch size: ${config.batch.toLocaleString()}`)
  console.log(`- merchant: ${config.merchantId}`)
  console.log(`- stamps per member: ${config.stampsPerMember}`)
  console.log(`- product events: ${config.withEvents ? "yes" : "no"}`)
  console.log(
    `- history window: ${STRESS_HISTORY_DAYS} days with varied join/visit/stamp times`
  )
  console.log(`- email pattern: ${stressEmail(1)} … ${stressEmail(count)}`)
}

function readEnvFile(path) {
  if (!existsSync(path)) return {}

  const parsed = {}

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const equalsIndex = trimmed.indexOf("=")
    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    parsed[key] = value
  }

  return parsed
}

function resolveDbUrl(env) {
  const explicitUrl = env.SUPABASE_DB_URL?.trim()
  if (explicitUrl) return explicitUrl

  const password = env.SUPABASE_DB_PASSWORD?.trim()
  const poolerUrlPath = join(projectDir, "supabase/.temp/pooler-url")

  if (!password || !existsSync(poolerUrlPath)) return ""

  try {
    const url = new URL(readFileSync(poolerUrlPath, "utf8").trim())
    url.password = password
    return url.toString()
  } catch {
    return ""
  }
}

function shouldRequireSsl(dbUrl) {
  try {
    const url = new URL(dbUrl)
    return isSupabaseHost(url.hostname)
  } catch {
    return false
  }
}

function isSupabaseHost(hostname) {
  const host = hostname.toLowerCase()
  return host === "supabase.com" || host.endsWith(".supabase.com")
}

function safeDbTarget(dbUrl) {
  try {
    const url = new URL(dbUrl)
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`
  } catch {
    return "configured database"
  }
}

function assertWriteTargetIsSafe(dbUrl) {
  if (!isLocalDbHost(dbUrl)) {
    console.error(
      `Refusing to run stress seed against non-local host "${dbHostLabel(dbUrl)}".`
    )
    console.error(
      "Point SUPABASE_DB_URL at a local disposable database before running this command."
    )
    process.exit(1)
  }

  assertCleanupDatabaseNamespace(dbUrl)
}

function assertCleanupDatabaseNamespace(dbUrl) {
  const databaseName = localDatabaseName(dbUrl)
  if (APPROVED_LOCAL_DATABASE_NAMES.has(databaseName)) return

  console.error(
    "Refusing to run stress seed outside an approved local Supabase database namespace."
  )
  console.error(
    "Use the local Supabase postgres database or the guarded nabaperks_task11 database."
  )
  process.exit(1)
}

function localDatabaseName(dbUrl) {
  try {
    const url = new URL(dbUrl)
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:")
      return ""
    if (!url.pathname.startsWith("/")) return ""
    return url.pathname.slice(1)
  } catch {
    return ""
  }
}

function isLocalDbHost(dbUrl) {
  try {
    const host = new URL(dbUrl).hostname.toLowerCase()
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)
  } catch {
    return false
  }
}

function dbHostLabel(dbUrl) {
  try {
    return new URL(dbUrl).hostname || "unknown host"
  } catch {
    return "unparseable connection URL"
  }
}
