export async function ensureVerifiedCustomerPhone(tx, customerId) {
  await tx`update public.customers
    set phone_hmac = coalesce(phone_hmac, encode(extensions.digest(id::text, 'sha256'), 'hex')),
        phone_last4 = coalesce(phone_last4, '0123'),
        phone_verified_at = coalesce(phone_verified_at, now())
    where id = ${customerId}::uuid`
}
