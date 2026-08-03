-- abasteci — Sincronização em tempo real (Supabase Realtime).
-- Publica as tabelas de dados para o Realtime. O REPLICA IDENTITY FULL faz os
-- eventos de DELETE trazerem todas as colunas (inclui user_id), o que permite
-- ao RLS entregar a cada usuário apenas as próprias mudanças.

alter table public.vehicles     replica identity full;
alter table public.fuelings     replica identity full;
alter table public.expenses     replica identity full;
alter table public.maintenances replica identity full;
alter table public.reminders    replica identity full;

-- Adiciona as tabelas à publicação do Realtime (ignora as que já estiverem).
do $$
declare
  t text;
begin
  foreach t in array array['vehicles', 'fuelings', 'expenses', 'maintenances', 'reminders']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception
      when duplicate_object then null;
    end;
  end loop;
end $$;
