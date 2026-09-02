const PLACEHOLDER = /(?:change.?me|example|placeholder|replace.?me)/i

export function isStrongCustomerSessionSecret(value: string) {
  if (value.length < 32 || PLACEHOLDER.test(value)) return false
  if (/\s/.test(value) || new Set(value).size < 12) return false

  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (
    /(?:0123456789|123456789|9876543210|abcdef|fedcba|qwerty)/.test(compact)
  ) {
    return false
  }

  for (
    let period = 1;
    period <= Math.min(16, Math.floor(value.length / 2));
    period += 1
  ) {
    if (
      value.length % period === 0 &&
      value === value.slice(0, period).repeat(value.length / period)
    ) {
      return false
    }
  }

  const structuredChunks = value.match(/[A-Z][a-z]\d[^A-Za-z\d]/g)
  if (
    structuredChunks &&
    structuredChunks.length >= 4 &&
    structuredChunks.join("") === value &&
    structuredChunks.every(
      (chunk) => chunk[0].toLowerCase() === chunk[1].toLowerCase()
    )
  ) {
    const letters = structuredChunks.map((chunk) => chunk.charCodeAt(0))
    const digits = structuredChunks.map((chunk) => Number(chunk[2]))
    const sequentialLetters = letters.every(
      (letter, index) => index === 0 || letter === letters[index - 1] + 1
    )
    const sequentialDigits = digits.every(
      (digit, index) => index === 0 || digit === digits[index - 1] + 1
    )
    if (sequentialLetters || sequentialDigits) return false
  }

  return true
}
