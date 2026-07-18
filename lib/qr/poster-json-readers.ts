type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function requireRecord(value: unknown, path: string): JsonRecord {
  if (!isRecord(value)) {
    throw new Error(`Expected poster object at ${path}`)
  }
  return value
}

export function requireString(
  record: JsonRecord,
  key: string,
  path: string
): string {
  const value = record[key]
  if (typeof value !== "string") {
    throw new Error(`Expected poster string at ${path}.${key}`)
  }
  return value
}

export function requireNumber(
  record: JsonRecord,
  key: string,
  path: string
): number {
  const value = record[key]
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected poster number at ${path}.${key}`)
  }
  return value
}

export function requireArray(
  record: JsonRecord,
  key: string,
  path: string
): readonly unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`Expected poster array at ${path}.${key}`)
  }
  return value
}

export function requireRecordField(
  record: JsonRecord,
  key: string,
  path: string
): JsonRecord {
  return requireRecord(record[key], `${path}.${key}`)
}
