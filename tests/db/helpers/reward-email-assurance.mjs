export async function grantRewardEmailAssurance(tx, rewardId, customerId) {
  await tx`
    update public.customers
    set email_hmac = coalesce(
      email_hmac,
      encode(extensions.digest(lower(email), 'sha256'), 'hex')
    )
    where id = ${customerId}::uuid
      and email is not null
      and email_verified_at is not null`
  await tx`
    insert into public.customer_reward_email_assurances (
      reward_event_id, customer_id, email_hmac
    )
    select ${rewardId}::uuid, customers.id, customers.email_hmac
    from public.customers
    where customers.id = ${customerId}::uuid
      and customers.email_verified_at is not null
      and customers.email_hmac is not null
    on conflict (reward_event_id) do update
    set email_hmac = excluded.email_hmac,
        verified_at = now(),
        expires_at = now() + interval '30 minutes'`
}
