export async function ensureVerifiedCustomerEmail(tx, customerId) {
  const [customer] = await tx`
    update public.customers
    set
      email_verified_at = coalesce(email_verified_at, now()),
      email_hmac = coalesce(
        email_hmac,
        encode(extensions.digest(lower(email), 'sha256'), 'hex')
      )
    where id = ${customerId}::uuid
      and email is not null
    returning id`

  if (!customer) {
    throw new Error("Verified customer email fixture was not available.")
  }
}
