-- abasteci — Módulo de receitas (motorista de aplicativo).
-- Rode no SQL Editor se você já tinha criado as tabelas antes desta versão.

create table if not exists public.revenues (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id   uuid not null references public.vehicles (id) on delete cascade,
  date         date not null,
  platform     text not null default 'Outro',
  description  text,
  trips        integer,
  value        numeric not null default 0
);

create index if not exists revenues_vehicle_idx on public.revenues (vehicle_id);

alter table public.revenues enable row level security;

drop policy if exists "own rows" on public.revenues;
create policy "own rows" on public.revenues
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Realtime (sincronização entre dispositivos)
alter table public.revenues replica identity full;
do $$
begin
  begin
    alter publication supabase_realtime add table public.revenues;
  exception
    when duplicate_object then null;
  end;
end $$;
