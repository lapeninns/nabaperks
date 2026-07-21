import { parse } from "dotenv"

export function parseEnvText(content) {
  return parse(content)
}

export function serializeEnvValue(value) {
  const raw = String(value ?? "")

  // dotenv normalises carriage returns before parsing. Refuse values that
  // cannot survive that transformation byte-for-byte.
  if (raw.includes("\r")) {
    throw new Error(
      "Environment value cannot be represented safely in dotenv format."
    )
  }

  if (!raw.includes("'")) return `'${raw}'`
  if (!raw.includes("`")) return `\`${raw}\``
  if (!raw.includes('"') && !/\\[nr]/.test(raw)) return `"${raw}"`
  if (raw === raw.trim() && !/[#\r\n]/.test(raw)) return raw

  throw new Error(
    "Environment value cannot be represented safely in dotenv format."
  )
}
