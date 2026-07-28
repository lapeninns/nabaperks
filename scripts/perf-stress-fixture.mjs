const MINIMUM_STRESS_MEMBERS = 1000

export function parseStressFixture(row) {
  if (!row) {
    throw new Error(
      "Old Crown Girton merchant fixture not found. Run pnpm db:setup first."
    )
  }

  const ownerEmail =
    typeof row.owner_email === "string"
      ? row.owner_email.trim().toLowerCase()
      : ""
  if (!ownerEmail) {
    throw new Error("Old Crown Girton merchant fixture has no owner email.")
  }

  if (row.members < MINIMUM_STRESS_MEMBERS) {
    throw new Error(
      `Only ${row.members} members found. Run pnpm db:reseed:stress before perf:stress.`
    )
  }

  return {
    businessName: row.business_name,
    ownerEmail,
    members: row.members,
    events: row.events,
  }
}
