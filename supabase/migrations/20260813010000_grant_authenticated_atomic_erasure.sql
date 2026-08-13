-- The admin action calls this RPC with the signed-in human's JWT so the
-- function body can enforce active internal-admin membership and stepped-up
-- assurance when that admin has an enrolled factor.
revoke execute on function public.admin_erase_customer_pii(uuid, uuid, text, text)
  from public, anon;
grant execute on function public.admin_erase_customer_pii(uuid, uuid, text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
