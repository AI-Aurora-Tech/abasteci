-- abasteci — Integração com a Uber (ganhos do motorista).
-- Guarda a conexão OAuth de cada usuário (tokens ficam SÓ no servidor) e
-- permite deduplicar as receitas importadas.

-- Origem/dedup nas receitas
alter table public.revenues add column if not exists source      text;
alter table public.revenues add column if not exists external_id text;
create unique index if not exists revenues_user_external_uk
  on public.revenues (user_id, external_id);

-- Conexão Uber por usuário. Sem policy para "authenticated": apenas a
-- service_role (Edge Functions) acessa — os tokens nunca vão para o cliente.
create table if not exists public.uber_connections (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  access_token    text,
  refresh_token   text,
  expires_at      timestamptz,
  uber_driver_id  text,
  scope           text,
  last_sync       timestamptz,
  connected_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.uber_connections enable row level security;

-- Estados temporários do OAuth (ligam o callback ao usuário)
create table if not exists public.uber_oauth_states (
  state       text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.uber_oauth_states enable row level security;
