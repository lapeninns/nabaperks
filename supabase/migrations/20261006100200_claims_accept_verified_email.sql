-- Loyalty invitations accept an email-verified wallet.
--
-- Once guests can join by email, a wallet may hold a verified email and no
-- phone. The invitation claim body refused such a wallet with 'invalid'
-- because its identity gate demanded a verified phone. The gate now accepts a
-- verified phone OR a verified email (verified email_hmac, the same lookup key
-- email sign-in uses). An invitation is addressed to one recipient and the
-- claim still has to prove that recipient's email, so nothing else about who
-- may claim changes.
--
-- The invitation bind (a wallet with no verified email adopts the invited,
-- already-proven address) now also turns a unique_violation from
-- customers_verified_email_hmac_unique_idx (20261006100000) into the existing
-- 'email_conflict' outcome, so a concurrent bind of the same address by another
-- wallet is refused instead of surfacing as an error.
--
-- Offer campaigns deliberately stay phone-only. Their links are public poster
-- tokens, the claim skips the cap, QR and location checks, and the only
-- duplicate guard is per customer. An SMS-verified number is what makes each
-- extra claim costly; a verified email is not, because one inbox can verify
-- many plus-tagged or dotted aliases, each a separate email_hmac. Widening
-- private.claim_offer_campaign_legacy_v1 needs a per-campaign limit on a
-- canonicalised email or on the device first, and a decision recorded with it.
--
-- The body lives at private.claim_loyalty_invite_legacy_v1 (moved and renamed
-- in 20260924100000_open_next_cycle_on_completion.sql; latest body from
-- 20260722100500_loyalty_invite_claim_member_precedence.sql). It is patched in
-- place (pattern 20260927100100_phone_marketing_consent.sql): each replaced
-- fragment must match exactly, or the migration stops for review.
-- Re-runnable: an already-patched body is left alone. Grants are re-asserted
-- unchanged.

do $migration$
declare
  v_definition text;
  v_old_gate text := $old$  -- The invited customer must be a verified-phone account.
  select cu.id, cu.email, cu.email_hmac, cu.email_verified_at,
         cu.phone_hmac, cu.phone_verified_at
  into v_customer
  from public.customers cu
  where cu.id = p_customer_id;

  if v_customer.id is null
     or v_customer.phone_hmac is null
     or v_customer.phone_verified_at is null then
    return next; return;
  end if;$old$;
  v_new_gate text := $new$  -- The invited customer must hold a verified phone or a verified email.
  select cu.id, cu.email, cu.email_hmac, cu.email_verified_at,
         cu.phone_hmac, cu.phone_verified_at
  into v_customer
  from public.customers cu
  where cu.id = p_customer_id;

  if v_customer.id is null
     or not (
       (v_customer.phone_hmac is not null and v_customer.phone_verified_at is not null)
       or (v_customer.email_hmac is not null and v_customer.email_verified_at is not null)
     ) then
    return next; return;
  end if;$new$;
  v_old_bind text := $old$  if v_bind then
    update public.customers
    set email = p_verified_email,
        email_hmac = p_verified_email_hmac,
        email_verified_at = now()
    where id = p_customer_id;
  end if;$old$;
  v_new_bind text := $new$  if v_bind then
    begin
      update public.customers
      set email = p_verified_email,
          email_hmac = p_verified_email_hmac,
          email_verified_at = now()
      where id = p_customer_id;
    exception when unique_violation then
      -- Another wallet verified this address after the check above.
      status := 'email_conflict';
      return next; return;
    end;
  end if;$new$;
begin
  select pg_get_functiondef(
    'private.claim_loyalty_invite_legacy_v1(uuid,text,text,boolean,text,text)'::regprocedure
  ) into v_definition;

  if position(v_new_gate in v_definition) > 0
     and position(v_new_bind in v_definition) > 0 then
    return;
  end if;
  if position(v_old_gate in v_definition) = 0
     or position(v_old_bind in v_definition) = 0 then
    raise exception 'claim_loyalty_invite_legacy_v1 identity gate changed; review verified email claim migration';
  end if;

  execute replace(replace(v_definition, v_old_gate, v_new_gate), v_old_bind, v_new_bind);
end;
$migration$;

revoke all on function private.claim_loyalty_invite_legacy_v1(uuid,text,text,boolean,text,text)
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
