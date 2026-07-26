-- Restore the service-role caller supported by the original admin fraud RPC.
--
-- 20260726100000 preserved authenticated admin execution but inadvertently
-- omitted service_role from its final grant. Keep the existing signature and
-- allowed roles unchanged; this forward-only repair is additive.

grant execute on function public.admin_resolve_fraud_flag(uuid, text, text)
  to service_role;

notify pgrst, 'reload schema';
