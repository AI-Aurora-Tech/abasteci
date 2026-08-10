-- abasteci — capacidade do tanque de combustível (litros) por veículo.
-- Opcional: usada para referência e futuros cálculos de autonomia.

alter table public.vehicles
  add column if not exists tank_capacity numeric;
