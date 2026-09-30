-- QA BUG-001 (38c42a1..2c45031): the preset picker sends `requires_age_check`
-- on every preset, but the public wrapper forwarded the whole payload to the
-- strict private allow-list (preset_id, reward_name, reward_terms only), so
-- every batch failed with 22023 before any insert.
--
-- The wrapper now validates the optional flag, passes the private function a
-- copy of each preset without it, and still reads the flag from the original
-- payload afterwards (missing or null keeps the safe default: age check on).
-- Signature, result shape, owner, SECURITY DEFINER, search_path and grants are
-- unchanged, so the deployed app and the previous app both keep working.

create or replace function public.add_reward_pool_presets(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_presets jsonb
)
returns table (
  preset_id text, reward_pool_item_id uuid, reward_name text, reward_terms text,
  weight integer, is_active boolean, display_order integer, saved_action text,
  active_reward_count integer, requires_age_check boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_row record;
  v_private_presets jsonb := p_presets;
begin
  if p_presets is not null and pg_catalog.jsonb_typeof(p_presets) = 'array' then
    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(p_presets) as entries(value)
      where pg_catalog.jsonb_typeof(entries.value) = 'object'
        and entries.value ? 'requires_age_check'
        and pg_catalog.jsonb_typeof(entries.value -> 'requires_age_check')
          not in ('boolean', 'null')
    ) then
      raise exception using
        errcode = '22023',
        message = 'Invalid preset payload: age check must be true or false';
    end if;

    -- Non-object elements pass through unchanged so the private function
    -- keeps owning the batch-shape errors.
    select coalesce(
      pg_catalog.jsonb_agg(
        case
          when pg_catalog.jsonb_typeof(entries.value) = 'object'
            then entries.value - 'requires_age_check'
          else entries.value
        end
        order by entries.ordinality
      ),
      '[]'::jsonb
    )
    into v_private_presets
    from pg_catalog.jsonb_array_elements(p_presets)
      with ordinality as entries(value, ordinality);
  end if;

  for v_row in select * from private.add_reward_pool_presets(
    p_merchant_id, p_loyalty_card_id, v_private_presets
  ) loop
    select coalesce((entry ->> 'requires_age_check')::boolean, true)
    into requires_age_check
    from pg_catalog.jsonb_array_elements(p_presets) entry
    where entry ->> 'preset_id' = v_row.preset_id
    limit 1;
    requires_age_check := coalesce(requires_age_check, true);
    update public.reward_pool_items items
    set requires_age_check = add_reward_pool_presets.requires_age_check
    where items.id = v_row.reward_pool_item_id;
    preset_id := v_row.preset_id;
    reward_pool_item_id := v_row.reward_pool_item_id;
    reward_name := v_row.reward_name;
    reward_terms := v_row.reward_terms;
    weight := v_row.weight;
    is_active := v_row.is_active;
    display_order := v_row.display_order;
    saved_action := v_row.saved_action;
    active_reward_count := v_row.active_reward_count;
    return next;
  end loop;
end;
$function$;

revoke all on function public.add_reward_pool_presets(uuid,uuid,jsonb)
  from public, anon;
grant execute on function public.add_reward_pool_presets(uuid,uuid,jsonb)
  to authenticated, service_role;

notify pgrst, 'reload schema';
