-- abasteci — suporte ao fluxo de assinatura por LINK de pagamento.
-- Quando a assinatura é feita por um link público (mpago.la), o webhook não
-- recebe o user_id (external_reference). Esta função permite ao webhook
-- descobrir o usuário pelo e-mail do pagador. Só a service_role pode chamá-la.

create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.get_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;
