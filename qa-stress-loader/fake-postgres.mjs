export default function postgres() {
  const sql = async (strings) => {
    const statement = strings.join("")
    if (statement.includes("from public.merchants"))
      return [{ business_slug: "old-crown-girton" }]
    if (statement.includes("from public.customer_memberships"))
      return [{ n: 1000 }]
    return []
  }
  sql.begin = async (callback) => callback({ unsafe: async () => [] })
  sql.unsafe = async (statement) => {
    if (statement.includes("from public.stamp_events"))
      throw new Error("TEST_CONTROLLED_DB_BOUNDARY")
    return []
  }
  sql.end = async () => {}
  return sql
}
