import type { AppData, Fueling, Vehicle } from './types'

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
export function averageConsumption(fuelings: Fueling[]): number | null {
  const full = [...fuelings]
    .filter((f) => f.fullTank)
    .sort((a, b) => a.odometer - b.odometer)

  if (full.length < 2) return null

  let distance = 0
  let liters = 0
  for (let i = 1; i < full.length; i++) {
    const d = full[i].odometer - full[i - 1].odometer
    if (d > 0) {
      distance += d
      liters += full[i].liters
    }
  }
  if (liters <= 0) return null
  return distance / liters
}

/** Consumo do último trecho fechado (km/l), para exibir a "última medição". */
export function lastConsumption(fuelings: Fueling[]): number | null {
  const full = [...fuelings]
    .filter((f) => f.fullTank)
    .sort((a, b) => a.odometer - b.odometer)
  if (full.length < 2) return null
  const a = full[full.length - 2]
  const b = full[full.length - 1]
  const d = b.odometer - a.odometer
  if (d <= 0 || b.liters <= 0) return null
  return d / b.liters
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
