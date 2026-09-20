import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { test } from "node:test"

const migrationsDirectory = resolve(
  import.meta.dirname,
  "../../supabase/migrations"
)
const catalogPath = resolve(
  import.meta.dirname,
  "../../lib/notifications/catalog.ts"
)

test("database and TypeScript notification categories stay identical", () => {
  const migrations = readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
  const latest = migrations
    .map((name) => readFileSync(resolve(migrationsDirectory, name), "utf8"))
    .filter((sql) =>
      /function public\.notification_event_category\s*\(/i.test(sql)
    )
    .at(-1)

  assert.ok(latest, "a notification_event_category migration exists")
  const databaseCategories = new Map(
    [...latest.matchAll(/when\s+'([^']+)'\s+then\s+'([^']+)'/gi)].map(
      ([, eventType, category]) => [eventType, category]
    )
  )
  const catalog = readFileSync(catalogPath, "utf8")
  const categoryBlock = catalog.match(
    /const EVENT_CATEGORY:[\s\S]*?= \{([\s\S]*?)\n\}/
  )?.[1]
  assert.ok(categoryBlock, "catalog exports EVENT_CATEGORY")
  const typescriptCategories = new Map(
    [...categoryBlock.matchAll(/^\s*([a-z0-9_]+): "([a-z_]+)",?$/gm)].map(
      ([, eventType, category]) => [eventType, category]
    )
  )

  assert.deepEqual(databaseCategories, typescriptCategories)
})
