import { isConsoleTab } from "@/lib/navigation/console-tabs"

/**
 * Pure contract for the merchant console's interaction events. The events
 * are raised from client components (tab taps, chart selections, sheet
 * confirmations) and cross to the server through one action that validates
 * them here before `capturePostHogEvent` mirrors them, so no browser code
 * ever names PostHog and no unvalidated payload reaches analytics.
 */
export const CONSOLE_EVENT_NAMES = [
  "console_tab_selected",
  "counter_qr_presented",
  "counter_qr_present_closed",
  "team_code_revealed",
  "team_code_reset_confirmed",
  "team_code_reset_cancelled",
  "numbers_range_changed",
  "numbers_day_selected",
  "numbers_metric_opened",
  "activity_group_expanded",
  "activity_filter_changed",
] as const

export type ConsoleEventName = (typeof CONSOLE_EVENT_NAMES)[number]

export const NUMBERS_RANGES = [7, 14, 28] as const
export const NUMBERS_METRICS = ["members", "stamps", "rewards", "qr"] as const
export const ACTIVITY_SCOPES = ["today", "7d", "28d"] as const

const ACTIVITY_CATEGORIES = ["customer", "stamp", "reward", "qr", "account"]

export type ConsoleEventPayload =
  | {
      name: "console_tab_selected"
      properties: { tab: string; from_tab: string | null }
    }
  | { name: "counter_qr_presented"; properties: { source: "card" } }
  | { name: "counter_qr_present_closed"; properties: { duration_ms: number } }
  | { name: "team_code_revealed"; properties: Record<string, never> }
  | { name: "team_code_reset_confirmed"; properties: Record<string, never> }
  | { name: "team_code_reset_cancelled"; properties: Record<string, never> }
  | {
      name: "numbers_range_changed"
      properties: { range: number; from_range: number }
    }
  | {
      name: "numbers_day_selected"
      properties: { metric: string; method: "column" | "stepper" }
    }
  | { name: "numbers_metric_opened"; properties: { metric: string } }
  | {
      name: "activity_group_expanded"
      properties: { category: string; count: number }
    }
  | {
      name: "activity_filter_changed"
      properties: { filter: string; range: string }
    }

type Validator = (value: unknown) => boolean

const oneOf =
  (values: readonly unknown[]): Validator =>
  (value) =>
    values.includes(value)
const nonNegativeInt: Validator = (value) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0
const tabOrNull: Validator = (value) => value === null || isConsoleTab(value)
const activityFilter: Validator = (value) =>
  value === "all" || ACTIVITY_CATEGORIES.includes(value as string)

/** Exactly these keys, each passing its validator; anything else is rejected. */
const SCHEMAS: Record<ConsoleEventName, Record<string, Validator>> = {
  console_tab_selected: { tab: isConsoleTab, from_tab: tabOrNull },
  counter_qr_presented: { source: oneOf(["card"]) },
  counter_qr_present_closed: { duration_ms: nonNegativeInt },
  team_code_revealed: {},
  team_code_reset_confirmed: {},
  team_code_reset_cancelled: {},
  numbers_range_changed: {
    range: oneOf(NUMBERS_RANGES),
    from_range: oneOf(NUMBERS_RANGES),
  },
  numbers_day_selected: {
    metric: oneOf(NUMBERS_METRICS),
    method: oneOf(["column", "stepper"]),
  },
  numbers_metric_opened: { metric: oneOf(NUMBERS_METRICS) },
  activity_group_expanded: {
    category: oneOf(ACTIVITY_CATEGORIES),
    count: nonNegativeInt,
  },
  activity_filter_changed: {
    filter: activityFilter,
    range: oneOf(ACTIVITY_SCOPES),
  },
}

const consoleEventSet = new Set<string>(CONSOLE_EVENT_NAMES)

export function isConsoleEventName(value: unknown): value is ConsoleEventName {
  return typeof value === "string" && consoleEventSet.has(value)
}

/**
 * Narrow an untrusted `{ name, properties }` object to a known console event.
 * Returns `null` for an unknown name, a missing or extra property, or a
 * property outside its allowed values — the caller drops the event silently.
 */
export function parseConsoleEvent(value: unknown): ConsoleEventPayload | null {
  if (!isRecord(value) || !isConsoleEventName(value.name)) return null

  const schema = SCHEMAS[value.name]
  const properties = isRecord(value.properties) ? value.properties : {}
  const expectedKeys = Object.keys(schema)
  const actualKeys = Object.keys(properties)

  if (actualKeys.length !== expectedKeys.length) return null
  for (const key of expectedKeys) {
    if (!(key in properties) || !schema[key]?.(properties[key])) return null
  }

  return { name: value.name, properties } as ConsoleEventPayload
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
