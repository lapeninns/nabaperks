type LoyaltyEarningTerms = {
  readonly minimumSpendPence: number | null
  readonly oneTransactionPerStamp: boolean
}

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function loyaltyEarningTermsText(terms: LoyaltyEarningTerms): string {
  const transaction = terms.oneTransactionPerStamp
    ? ", one transaction per stamp"
    : ""
  const minimumSpend =
    terms.minimumSpendPence === null
      ? ""
      : ` Minimum spend ${GBP.format(terms.minimumSpendPence / 100)}.`

  return `One stamp per visit${transaction}.${minimumSpend}`
}

export function loyaltyEarningTermsFromRewardSnapshot(
  snapshot: unknown
): string | null {
  if (!isRecord(snapshot)) return null
  const minimumSpend = snapshot.minimum_spend_pence
  if (
    minimumSpend !== null &&
    minimumSpend !== undefined &&
    (typeof minimumSpend !== "number" || !Number.isInteger(minimumSpend))
  ) {
    return null
  }
  if (typeof snapshot.one_transaction_per_stamp !== "boolean") return null

  return loyaltyEarningTermsText({
    minimumSpendPence: minimumSpend ?? null,
    oneTransactionPerStamp: snapshot.one_transaction_per_stamp,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
