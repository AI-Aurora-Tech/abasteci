-- abasteci — adiciona a forma de pagamento aos lançamentos financeiros.
-- Rode no SQL Editor se você já tinha criado as tabelas antes desta versão.

alter table public.fuelings     add column if not exists payment_method text;
alter table public.expenses     add column if not exists payment_method text;
alter table public.maintenances add column if not exists payment_method text;
