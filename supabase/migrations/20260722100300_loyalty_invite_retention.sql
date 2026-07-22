-- Bulk Two-Stamp Loyalty Invitations — retention, erasure and export.
--
-- Retention (privacy-retention cron): expire lapsed links and scrub their
-- contact, purge abandoned drafts after 24 hours, belt-and-braces scrub any
-- terminal recipient still holding contact, and hard-delete contact-free
-- terminal recipient records after 365 days. Suppression HMACs live in a
-- separate table and are retained to keep honouring opt-outs.
--
-- Plus admin-gated GDPR companions wired into the existing export/erasure flow
-- (app/admin/actions.ts) so a subject-access request and an erasure also cover
-- invitation data without reproducing the monolithic customer export/erase RPCs.
--
-- Forward-only and idempotent (create or replace).

create or replace function public.expire_and_purge_loyalty_invites(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_affected integer := 0;
  v_count integer;
begin
  -- 1. Expire recipients whose campaign link has lapsed; scrub their contact.
  update public.loyalty_invite_recipients r
  set status = 'expired', expired_at = v_now,
      email_ciphertext = null, email_masked = null,
      claim_token_hash = null, unsubscribe_token_hash = null,
      lease_expires_at = null
  from public.loyalty_invite_campaigns c
  where r.campaign_id = c.id
    and c.link_expires_at is not null
    and c.link_expires_at < v_now
    and r.status in ('queued', 'sending', 'sent', 'delivered', 'opened');
  get diagnostics v_count = row_count;
  v_affected := v_affected + v_count;

  -- Complete campaigns that are fully drained after expiry.
  update public.loyalty_invite_campaigns c
  set status = 'completed', completed_at = coalesce(completed_at, v_now)
  where c.status = 'sending'
    and c.link_expires_at is not null
    and c.link_expires_at < v_now
    and not exists (
      select 1 from public.loyalty_invite_recipients r
      where r.campaign_id = c.id and r.status in ('queued', 'sending')
    );

  -- 2. Purge abandoned drafts after 24 hours (cascade removes recipients).
  delete from public.loyalty_invite_campaigns
  where status = 'draft' and updated_at < v_now - interval '24 hours';
  get diagnostics v_count = row_count;
  v_affected := v_affected + v_count;

  -- 3. Belt-and-braces: scrub any terminal recipient still holding contact.
  update public.loyalty_invite_recipients
  set email_ciphertext = null, email_masked = null,
      claim_token_hash = null, unsubscribe_token_hash = null
  where status in ('joined', 'failed', 'expired', 'cancelled', 'unsubscribed')
    and (email_ciphertext is not null or claim_token_hash is not null
         or unsubscribe_token_hash is not null)
    and updated_at < v_now - interval '7 days';

  -- 4. Hard-delete contact-free terminal recipient records after 365 days.
  delete from public.loyalty_invite_recipients
  where status in ('joined', 'failed', 'expired', 'cancelled', 'unsubscribed')
    and email_ciphertext is null
    and claim_token_hash is null
    and updated_at < v_now - interval '365 days';
  get diagnostics v_count = row_count;
  v_affected := v_affected + v_count;

  return v_affected;
end;
$$;

revoke all on function public.expire_and_purge_loyalty_invites(timestamptz)
  from public, anon, authenticated;
grant execute on function public.expire_and_purge_loyalty_invites(timestamptz)
  to service_role;

-- GDPR erasure companion: scrub + cancel a customer's invitation recipients.
create or replace function public.admin_erase_loyalty_invitations_for_customer(
  p_customer_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email_hmac text;
  v_count integer := 0;
begin
  if not public.is_internal_admin() then
    raise insufficient_privilege using message = 'Admin privilege required';
  end if;

  select email_hmac into v_email_hmac
  from public.customers where id = p_customer_id;

  update public.loyalty_invite_recipients
  set email_ciphertext = null, email_masked = null,
      claim_token_hash = null, unsubscribe_token_hash = null,
      lease_expires_at = null,
      status = case when status in ('queued', 'sending', 'sent', 'delivered', 'opened')
                    then 'cancelled' else status end
  where claimed_customer_id = p_customer_id
     or (v_email_hmac is not null and email_hmac = v_email_hmac);
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

revoke all on function public.admin_erase_loyalty_invitations_for_customer(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_erase_loyalty_invitations_for_customer(uuid)
  to authenticated, service_role;

-- GDPR export companion: masked invitation history for a customer.
create or replace function public.loyalty_invitations_export_for_customer(
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email_hmac text;
  v_result jsonb;
begin
  if not public.is_internal_admin() then
    raise insufficient_privilege using message = 'Admin privilege required';
  end if;

  select email_hmac into v_email_hmac
  from public.customers where id = p_customer_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'campaign_id', r.campaign_id,
    'merchant_id', r.merchant_id,
    'status', r.status,
    'email_masked', r.email_masked,
    'sent_at', r.sent_at,
    'delivered_at', r.delivered_at,
    'opened_at', r.opened_at,
    'joined_at', r.joined_at,
    'unsubscribed_at', r.unsubscribed_at,
    'created_at', r.created_at
  ) order by r.created_at desc), '[]'::jsonb)
  into v_result
  from public.loyalty_invite_recipients r
  where r.claimed_customer_id = p_customer_id
     or (v_email_hmac is not null and r.email_hmac = v_email_hmac);

  return v_result;
end;
$$;

revoke all on function public.loyalty_invitations_export_for_customer(uuid)
  from public, anon, authenticated;
grant execute on function public.loyalty_invitations_export_for_customer(uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
