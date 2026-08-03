-- abasteci — RESET + SETUP (rode ISTO no SQL Editor se as tabelas ja existiam
-- com estrutura divergente, ex.: erro PGRST204 'column not found').
-- ATENCAO: apaga as 5 tabelas e recria do zero. Use so na fase de setup.

drop table if exists public.reminders, public.maintenances, public.expenses, public.fuelings, public.vehicles cascade;

-- usuário só acesse os próprios dados (auth.uid() = user_id).

-- ---------- Tabelas ----------

create table if not exists public.vehicles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  plate       text not null default '',
  make        text not null default '',
  model       text not null default '',
  year        integer,
  fuel_type   text not null default 'Gasolina',
  odometer    numeric not null default 0,
  color       text not null default '#0ea5e9',
  created_at  timestamptz not null default now()
);

create table if not exists public.fuelings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id      uuid not null references public.vehicles (id) on delete cascade,
  date            date not null,
  odometer        numeric not null default 0,
  fuel_type       text not null default 'Gasolina',
  liters          numeric not null default 0,
  price_per_liter numeric not null default 0,
  total           numeric not null default 0,
  full_tank       boolean not null default true,
  station         text,
  latitude        numeric,
  longitude       numeric,
  payment_method  text,
  note            text
);

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id  uuid not null references public.vehicles (id) on delete cascade,
  date        date not null,
  category    text not null default 'Outro',
  description text not null default '',
  odometer    numeric,
  value       numeric not null default 0,
  payment_method text
);

create table if not exists public.maintenances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id  uuid not null references public.vehicles (id) on delete cascade,
  date        date not null,
  type        text not null default 'Preventiva',
  service     text not null default '',
  odometer    numeric not null default 0,
  value       numeric not null default 0,
  workshop    text,
  payment_method text,
  note        text
);

create table if not exists public.reminders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id    uuid not null references public.vehicles (id) on delete cascade,
  title         text not null,
  basis         text not null default 'date',
  due_date      date,
  due_odometer  numeric,
  done          boolean not null default false,
  note          text
);

-- ---------- Índices ----------

create index if not exists fuelings_vehicle_idx     on public.fuelings (vehicle_id);
create index if not exists expenses_vehicle_idx     on public.expenses (vehicle_id);
create index if not exists maintenances_vehicle_idx on public.maintenances (vehicle_id);
create index if not exists reminders_vehicle_idx    on public.reminders (vehicle_id);

-- ---------- Row Level Security ----------

alter table public.vehicles     enable row level security;
alter table public.fuelings     enable row level security;
alter table public.expenses     enable row level security;
alter table public.maintenances enable row level security;
alter table public.reminders    enable row level security;

-- Uma política por tabela cobrindo todas as operações (select/insert/update/delete).
-- O usuário só enxerga e altera linhas em que user_id = auth.uid().

do $$
declare
  t text;
begin
  foreach t in array array['vehicles', 'fuelings', 'expenses', 'maintenances', 'reminders']
  loop
    execute format('drop policy if exists "own rows" on public.%I;', t);
    execute format(
      'create policy "own rows" on public.%I
         for all
         to authenticated
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id);', t);
  end loop;
end $$;
