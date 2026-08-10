import type { AppData, Fueling, FuelType, Subscription, Vehicle } from './types'

// ---------- Formatação ----------

export const brl = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const num = (v: number, digits = 2): string =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const km = (v: number): string => `${v.toLocaleString('pt-BR')} km`

export const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export const monthLabel = (iso: string): string => {
  const [y, m] = iso.split('-')
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${meses[Number(m) - 1] ?? m}/${(y ?? '').slice(2)}`
}

export const uid = (): string =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`

// ---------- Cálculos ----------

/**
 * Calcula o consumo médio (km/l) entre abastecimentos de tanque cheio.
 * Só considera trechos entre dois "tanque cheio" consecutivos, que é a
 * forma correta de medir consumo (mesma lógica usada pelo Drivvo).
 */
/** Consumo (km/l) de um tanque específico já consumido. */
export interface TankConsumption {
  closingId: string // id do abastecimento que FECHA o tanque (o "próximo")
  fuel: FuelType // combustível com que o tanque consumido foi abastecido
  kmPerLiter: number
  distance: number
  liters: number
}

/**
 * Consumo por tanque (método tanque a tanque). Cada tanque é delimitado por
 * dois abastecimentos de tanque cheio (A→B): a distância é (odômetro B − A) e
 * os litros são a SOMA de tudo que foi abastecido depois de A até B — ou seja,
 * inclui os abastecimentos PARCIAIS feitos no meio do caminho (todos juntos
 * foram o que reencheu o tanque). Sem isso, um parcial no meio inflaria o
 * km/l (a distância contaria, os litros não). O resultado é atribuído ao
 * combustível abastecido em A, mantendo etanol e gasolina separados, e é
 * exibido no abastecimento que fecha o tanque (B).
 */
export function tankConsumptions(fuelings: Fueling[]): TankConsumption[] {
  const all = [...fuelings].sort((a, b) => a.odometer - b.odometer)
  const out: TankConsumption[] = []
  let prev = -1 // índice do último abastecimento de tanque cheio
  for (let i = 0; i < all.length; i++) {
    if (!all[i].fullTank) continue
    if (prev >= 0) {
      const a = all[prev]
      const b = all[i]
      const d = b.odometer - a.odometer
      // Litros para reencher: tudo abastecido DEPOIS de A até B (inclui os
      // parciais no meio). A não entra — ele já encheu o tanque no início.
      let liters = 0
      for (let k = prev + 1; k <= i; k++) liters += all[k].liters
      if (d > 0 && liters > 0) {
        out.push({ closingId: b.id, fuel: a.fuelType, kmPerLiter: d / liters, distance: d, liters })
      }
    }
    prev = i
  }
  return out
}

// Média ponderada pelos litros de um conjunto de tanques: Σ distância ÷ Σ litros.
function weighted(tanks: TankConsumption[]): number | null {
  let dist = 0
  let liters = 0
  for (const t of tanks) {
    dist += t.distance
    liters += t.liters
  }
  return liters > 0 ? dist / liters : null
}

/** Consumo médio (km/l) — média ponderada pelos litros de todos os tanques. */
export function averageConsumption(fuelings: Fueling[]): number | null {
  return weighted(tankConsumptions(fuelings))
}

/** Consumo médio (km/l) considerando apenas os últimos N tanques fechados. */
export function recentConsumption(fuelings: Fueling[], segments = 5): number | null {
  return weighted(tankConsumptions(fuelings).slice(-segments))
}

/** Consumo do último tanque fechado (km/l), para a "última medição". */
export function lastConsumption(fuelings: Fueling[]): number | null {
  const tanks = tankConsumptions(fuelings)
  return tanks.length ? tanks[tanks.length - 1].kmPerLiter : null
}

/** Média de consumo (km/l) por combustível, separando etanol e gasolina. */
export function consumptionByFuel(fuelings: Fueling[]): Partial<Record<FuelType, number>> {
  const agg: Partial<Record<FuelType, { dist: number; liters: number }>> = {}
  for (const t of tankConsumptions(fuelings)) {
    const g = (agg[t.fuel] ??= { dist: 0, liters: 0 })
    g.dist += t.distance
    g.liters += t.liters
  }
  const res: Partial<Record<FuelType, number>> = {}
  for (const fuel of Object.keys(agg) as FuelType[]) {
    const g = agg[fuel]!
    if (g.liters > 0) res[fuel] = g.dist / g.liters
  }
  return res
}

export function totalSpent(data: AppData, vehicleId: string): number {
  const f = data.fuelings.filter((x) => x.vehicleId === vehicleId).reduce((s, x) => s + x.total, 0)
  const e = data.expenses.filter((x) => x.vehicleId === vehicleId).reduce((s, x) => s + x.value, 0)
  const m = data.maintenances.filter((x) => x.vehicleId === vehicleId).reduce((s, x) => s + x.value, 0)
  return f + e + m
}

/** Custo por km: gasto total dividido pela distância percorrida registrada. */
export function costPerKm(data: AppData, vehicle: Vehicle): number | null {
  const odos = [
    ...data.fuelings.filter((x) => x.vehicleId === vehicle.id).map((x) => x.odometer),
    ...data.maintenances.filter((x) => x.vehicleId === vehicle.id).map((x) => x.odometer),
  ]
  if (odos.length < 2) return null
  const distance = Math.max(...odos) - Math.min(...odos)
  if (distance <= 0) return null
  return totalSpent(data, vehicle.id) / distance
}

export function currentOdometer(data: AppData, vehicle: Vehicle): number {
  const odos = [
    vehicle.odometer,
    ...data.fuelings.filter((x) => x.vehicleId === vehicle.id).map((x) => x.odometer),
    ...data.maintenances.filter((x) => x.vehicleId === vehicle.id).map((x) => x.odometer),
    ...data.expenses.filter((x) => x.vehicleId === vehicle.id && x.odometer).map((x) => x.odometer!),
  ]
  return Math.max(0, ...odos)
}

/** Agrupa um valor por mês (yyyy-mm) somando o campo indicado. */
export function sumByMonth<T>(items: T[], dateOf: (t: T) => string, valueOf: (t: T) => number) {
  const map = new Map<string, number>()
  for (const it of items) {
    const key = dateOf(it).slice(0, 7)
    map.set(key, (map.get(key) ?? 0) + valueOf(it))
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, value]) => ({ month, value }))
}

export const todayISO = (): string => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function daysUntil(iso: string): number {
  const target = new Date(iso + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 86_400_000)
}

/** Data (ISO) até quando o acesso é garantido: renovação ou fim do teste. */
export function accessUntil(sub: Subscription | null | undefined): string | null {
  return sub?.currentPeriodEnd ?? sub?.trialEnd ?? null
}

/**
 * Decide se a assinatura libera o acesso ao app.
 * - `authorized` (inclui teste grátis) → liberado.
 * - `cancelled`/`paused` → liberado somente ATÉ a data de renovação já paga
 *   (período de carência). Depois disso, bloqueia e volta a pedir assinatura.
 * - `pending`/sem assinatura → bloqueado.
 */
export function subscriptionGrantsAccess(sub: Subscription | null | undefined): boolean {
  if (!sub) return false
  if (sub.status === 'authorized') return true
  if (sub.status === 'cancelled' || sub.status === 'paused') {
    const until = accessUntil(sub)
    if (!until) return false
    return new Date(until).getTime() > Date.now()
  }
  return false
}
