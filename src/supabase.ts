import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Expense,
  Fueling,
  Maintenance,
  Reminder,
  Revenue,
  Subscription,
  Vehicle,
} from './types'

// Remove espaços, quebras de linha e BOM que às vezes entram ao salvar o .env
// (principalmente no Windows). Isso evita erros silenciosos de configuração.
function clean(v?: string): string {
  return (v ?? '').replace(/^﻿/, '').trim()
}

const url = clean(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const anonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

/** Indica se as variáveis de ambiente do Supabase foram preenchidas. */
export const isConfigured = Boolean(url && anonKey)

/**
 * Mensagem de erro de configuração (ou null se estiver tudo certo).
 * Detecta credenciais malformadas ANTES de o navegador tentar montar os
 * cabeçalhos HTTP — o que geraria um erro críptico de "ByteString".
 */
export const configError: string | null = (() => {
  if (!isConfigured) return null
  // A anon key é um JWT (base64url): só letras, números, '-', '_' e '.'.
  if (!/^[A-Za-z0-9_.-]+$/.test(anonKey)) {
    return 'A VITE_SUPABASE_ANON_KEY contém caracteres inválidos. Provavelmente o arquivo .env foi salvo com formatação incorreta (aspas, quebra de linha no meio da chave ou caractere especial). Recrie o .env com a anon key em UMA única linha, sem espaços.'
  }
  if (!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(url)) {
    return 'A VITE_SUPABASE_URL parece inválida. Use o formato https://SEU-PROJETO.supabase.co (Project Settings > API).'
  }
  return null
})()

// Cliente único do app. Se não configurado/ inválido, expomos null e a UI
// mostra a tela de configuração pendente.
export const supabase: SupabaseClient | null =
  isConfigured && !configError
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null

function client(): SupabaseClient {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}

// ---------- Mapeadores DB (snake_case) <-> App (camelCase) ----------

/* eslint-disable @typescript-eslint/no-explicit-any */

const toVehicle = (r: any): Vehicle => ({
  id: r.id,
  name: r.name,
  plate: r.plate ?? '',
  make: r.make ?? '',
  model: r.model ?? '',
  year: r.year ?? null,
  fuelType: r.fuel_type,
  odometer: Number(r.odometer) || 0,
  color: r.color,
  createdAt: r.created_at,
})

const toFueling = (r: any): Fueling => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  date: r.date,
  odometer: Number(r.odometer) || 0,
  fuelType: r.fuel_type,
  liters: Number(r.liters) || 0,
  pricePerLiter: Number(r.price_per_liter) || 0,
  total: Number(r.total) || 0,
  fullTank: r.full_tank,
  station: r.station ?? undefined,
  latitude: r.latitude != null ? Number(r.latitude) : undefined,
  longitude: r.longitude != null ? Number(r.longitude) : undefined,
  paymentMethod: r.payment_method ?? undefined,
  note: r.note ?? undefined,
})

const toExpense = (r: any): Expense => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  date: r.date,
  category: r.category,
  description: r.description ?? '',
  odometer: r.odometer != null ? Number(r.odometer) : undefined,
  value: Number(r.value) || 0,
  paymentMethod: r.payment_method ?? undefined,
})

const toMaintenance = (r: any): Maintenance => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  date: r.date,
  type: r.type,
  service: r.service ?? '',
  odometer: Number(r.odometer) || 0,
  value: Number(r.value) || 0,
  workshop: r.workshop ?? undefined,
  paymentMethod: r.payment_method ?? undefined,
  note: r.note ?? undefined,
})

const toRevenue = (r: any): Revenue => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  date: r.date,
  platform: r.platform,
  description: r.description ?? undefined,
  trips: r.trips != null ? Number(r.trips) : undefined,
  value: Number(r.value) || 0,
})

const toReminder = (r: any): Reminder => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  title: r.title,
  basis: r.basis,
  dueDate: r.due_date ?? undefined,
  dueOdometer: r.due_odometer != null ? Number(r.due_odometer) : undefined,
  done: r.done,
  note: r.note ?? undefined,
})

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------- Leitura ----------

export async function fetchAll() {
  const c = client()
  const [v, f, e, m, r, rev] = await Promise.all([
    c.from('vehicles').select('*').order('created_at', { ascending: true }),
    c.from('fuelings').select('*'),
    c.from('expenses').select('*'),
    c.from('maintenances').select('*'),
    c.from('reminders').select('*'),
    c.from('revenues').select('*'),
  ])
  const err = v.error || f.error || e.error || m.error || r.error || rev.error
  if (err) throw err
  return {
    vehicles: (v.data ?? []).map(toVehicle),
    fuelings: (f.data ?? []).map(toFueling),
    expenses: (e.data ?? []).map(toExpense),
    maintenances: (m.data ?? []).map(toMaintenance),
    reminders: (r.data ?? []).map(toReminder),
    revenues: (rev.data ?? []).map(toRevenue),
  }
}

// ---------- Escrita (o user_id é preenchido pelo default auth.uid() no banco) ----------

export async function insertVehicle(v: Omit<Vehicle, 'id' | 'createdAt'>): Promise<Vehicle> {
  const { data, error } = await client()
    .from('vehicles')
    .insert({
      name: v.name,
      plate: v.plate,
      make: v.make,
      model: v.model,
      year: v.year,
      fuel_type: v.fuelType,
      odometer: v.odometer,
      color: v.color,
    })
    .select()
    .single()
  if (error) throw error
  return toVehicle(data)
}

export async function updateVehicleRow(id: string, patch: Partial<Vehicle>): Promise<Vehicle> {
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.plate !== undefined) row.plate = patch.plate
  if (patch.make !== undefined) row.make = patch.make
  if (patch.model !== undefined) row.model = patch.model
  if (patch.year !== undefined) row.year = patch.year
  if (patch.fuelType !== undefined) row.fuel_type = patch.fuelType
  if (patch.odometer !== undefined) row.odometer = patch.odometer
  if (patch.color !== undefined) row.color = patch.color
  const { data, error } = await client().from('vehicles').update(row).eq('id', id).select().single()
  if (error) throw error
  return toVehicle(data)
}

export async function insertFueling(f: Omit<Fueling, 'id'>): Promise<Fueling> {
  const { data, error } = await client()
    .from('fuelings')
    .insert({
      vehicle_id: f.vehicleId,
      date: f.date,
      odometer: f.odometer,
      fuel_type: f.fuelType,
      liters: f.liters,
      price_per_liter: f.pricePerLiter,
      total: f.total,
      full_tank: f.fullTank,
      station: f.station ?? null,
      latitude: f.latitude ?? null,
      longitude: f.longitude ?? null,
      payment_method: f.paymentMethod ?? null,
      note: f.note ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return toFueling(data)
}

export async function insertExpense(e: Omit<Expense, 'id'>): Promise<Expense> {
  const { data, error } = await client()
    .from('expenses')
    .insert({
      vehicle_id: e.vehicleId,
      date: e.date,
      category: e.category,
      description: e.description,
      odometer: e.odometer ?? null,
      value: e.value,
      payment_method: e.paymentMethod ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return toExpense(data)
}

export async function insertMaintenance(m: Omit<Maintenance, 'id'>): Promise<Maintenance> {
  const { data, error } = await client()
    .from('maintenances')
    .insert({
      vehicle_id: m.vehicleId,
      date: m.date,
      type: m.type,
      service: m.service,
      odometer: m.odometer,
      value: m.value,
      workshop: m.workshop ?? null,
      payment_method: m.paymentMethod ?? null,
      note: m.note ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return toMaintenance(data)
}

export async function insertReminder(r: Omit<Reminder, 'id'>): Promise<Reminder> {
  const { data, error } = await client()
    .from('reminders')
    .insert({
      vehicle_id: r.vehicleId,
      title: r.title,
      basis: r.basis,
      due_date: r.dueDate ?? null,
      due_odometer: r.dueOdometer ?? null,
      done: r.done,
      note: r.note ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return toReminder(data)
}

export async function insertRevenue(r: Omit<Revenue, 'id'>): Promise<Revenue> {
  const { data, error } = await client()
    .from('revenues')
    .insert({
      vehicle_id: r.vehicleId,
      date: r.date,
      platform: r.platform,
      description: r.description ?? null,
      trips: r.trips ?? null,
      value: r.value,
    })
    .select()
    .single()
  if (error) throw error
  return toRevenue(data)
}

export async function updateRevenueRow(id: string, r: Omit<Revenue, 'id'>): Promise<Revenue> {
  const { data, error } = await client()
    .from('revenues')
    .update({
      vehicle_id: r.vehicleId,
      date: r.date,
      platform: r.platform,
      description: r.description ?? null,
      trips: r.trips ?? null,
      value: r.value,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toRevenue(data)
}

export async function setReminderDone(id: string, done: boolean): Promise<void> {
  const { error } = await client().from('reminders').update({ done }).eq('id', id)
  if (error) throw error
}

// ---------- Edição (update de linha existente) ----------

export async function updateFuelingRow(id: string, f: Omit<Fueling, 'id'>): Promise<Fueling> {
  const { data, error } = await client()
    .from('fuelings')
    .update({
      vehicle_id: f.vehicleId,
      date: f.date,
      odometer: f.odometer,
      fuel_type: f.fuelType,
      liters: f.liters,
      price_per_liter: f.pricePerLiter,
      total: f.total,
      full_tank: f.fullTank,
      station: f.station ?? null,
      latitude: f.latitude ?? null,
      longitude: f.longitude ?? null,
      payment_method: f.paymentMethod ?? null,
      note: f.note ?? null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toFueling(data)
}

export async function updateExpenseRow(id: string, e: Omit<Expense, 'id'>): Promise<Expense> {
  const { data, error } = await client()
    .from('expenses')
    .update({
      vehicle_id: e.vehicleId,
      date: e.date,
      category: e.category,
      description: e.description,
      odometer: e.odometer ?? null,
      value: e.value,
      payment_method: e.paymentMethod ?? null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toExpense(data)
}

export async function updateMaintenanceRow(id: string, m: Omit<Maintenance, 'id'>): Promise<Maintenance> {
  const { data, error } = await client()
    .from('maintenances')
    .update({
      vehicle_id: m.vehicleId,
      date: m.date,
      type: m.type,
      service: m.service,
      odometer: m.odometer,
      value: m.value,
      workshop: m.workshop ?? null,
      payment_method: m.paymentMethod ?? null,
      note: m.note ?? null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toMaintenance(data)
}

export async function updateReminderRow(id: string, r: Omit<Reminder, 'id'>): Promise<Reminder> {
  const { data, error } = await client()
    .from('reminders')
    .update({
      vehicle_id: r.vehicleId,
      title: r.title,
      basis: r.basis,
      due_date: r.dueDate ?? null,
      due_odometer: r.dueOdometer ?? null,
      done: r.done,
      note: r.note ?? null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toReminder(data)
}

export async function deleteRow(
  table: 'vehicles' | 'fuelings' | 'expenses' | 'maintenances' | 'reminders' | 'revenues',
  id: string,
): Promise<void> {
  const { error } = await client().from(table).delete().eq('id', id)
  if (error) throw error
}

// ---------- Realtime (sincronização entre dispositivos) ----------

export type RealtimeTable = 'vehicles' | 'fuelings' | 'expenses' | 'maintenances' | 'reminders' | 'revenues'

export type RealtimeRow = Vehicle | Fueling | Expense | Maintenance | Reminder | Revenue

/* eslint-disable @typescript-eslint/no-explicit-any */
const REALTIME_MAPPERS: Record<RealtimeTable, (r: any) => RealtimeRow> = {
  vehicles: toVehicle,
  fuelings: toFueling,
  expenses: toExpense,
  maintenances: toMaintenance,
  reminders: toReminder,
  revenues: toRevenue,
}

/**
 * Assina as mudanças (insert/update/delete) das tabelas do usuário logado.
 * O RLS garante que só chegam as linhas do próprio usuário; ainda filtramos
 * por user_id por segurança. Retorna o canal para ser encerrado depois.
 */
export function subscribeToUserData(
  userId: string,
  onUpsert: (table: RealtimeTable, row: RealtimeRow) => void,
  onRemove: (table: RealtimeTable, id: string) => void,
): RealtimeChannel {
  const c = client()
  const channel = c.channel(`user-data-${userId}`)
  ;(Object.keys(REALTIME_MAPPERS) as RealtimeTable[]).forEach((table) => {
    channel.on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table },
      (payload: any) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old
          if (old?.id) onRemove(table, old.id)
        } else {
          const row = payload.new
          if (row && row.user_id === userId) onUpsert(table, REALTIME_MAPPERS[table](row))
        }
      },
    )
  })
  channel.subscribe()
  return channel
}

export function removeChannel(channel: RealtimeChannel): void {
  supabase?.removeChannel(channel)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------- Assinatura (Mercado Pago) ----------

export async function fetchSubscription(): Promise<Subscription | null> {
  try {
    const { data, error } = await client().from('subscriptions').select('*').maybeSingle()
    if (error) return null // tabela ausente / não configurado
    if (!data) return null
    return {
      status: data.status,
      mpPreapprovalId: data.mp_preapproval_id ?? undefined,
      trialEnd: data.trial_end ?? undefined,
      currentPeriodEnd: data.current_period_end ?? undefined,
    }
  } catch {
    return null
  }
}

/** Chama a Edge Function que cria a assinatura e retorna o link de checkout. */
export async function startCheckout(): Promise<{ initPoint?: string; alreadyActive?: boolean }> {
  const { data, error } = await client().functions.invoke('subscribe')
  if (error) throw error
  const d = data as { init_point?: string; alreadyActive?: boolean }
  return { initPoint: d.init_point, alreadyActive: d.alreadyActive }
}

/** Cancela a assinatura do usuário (Edge Function cancel-subscription). */
export async function cancelSubscription(): Promise<void> {
  const { error } = await client().functions.invoke('cancel-subscription')
  if (error) throw error
}

export async function deleteAllForUser(): Promise<void> {
  // Apagar os veículos remove tudo em cascata (ON DELETE CASCADE).
  const { error } = await client().from('vehicles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw error
}
