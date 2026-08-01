-- abasteci — adiciona a localização (GPS) do posto aos abastecimentos.
-- Rode no SQL Editor se você já tinha criado as tabelas antes desta versão.

alter table public.fuelings add column if not exists latitude  numeric;
alter table public.fuelings add column if not exists longitude numeric;
