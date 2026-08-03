-- abasteci — assinaturas (Mercado Pago).
-- Guarda o status da assinatura de cada usuário. As gravações são feitas
-- pelas Edge Functions usando a service_role (que ignora o RLS); o app
-- apenas LÊ a própria linha.

create table if not exists public.subscriptions (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  status             text not null default 'pending', -- pending | authorized | paused | cancelled
  mp_preapproval_id  text,
  trial_end          timestamptz,
  current_period_end timestamptz,
  updated_at         timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- O usuário só pode LER a própria assinatura. Escrita só via service_role.
drop policy if exists "own subscription" on public.subscriptions;
create policy "own subscription" on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);
