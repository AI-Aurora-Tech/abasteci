import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type {
  AppData,
  Expense,
  Fueling,
  Maintenance,
  Reminder,
  Revenue,
  Subscription,
  Vehicle,
} from './types'
import * as db from './supabase'
import { isConfigured, supabase } from './supabase'
import { sampleRows } from './seed'
import { subscriptionGrantsAccess } from './utils'

const SELECTED_KEY = 'abasteci:selectedVehicle:v1'

// Interruptor mestre da cobrança. Se true, o paywall NUNCA aparece, mesmo
// com VITE_BILLING_ENABLED=true. Deixe false para a cobrança funcionar.
const BILLING_DISABLED = false
const billingEnabled = !BILLING_DISABLED && import.meta.env.VITE_BILLING_ENABLED === 'true'
const EMPTY: AppData = { vehicles: [], fuelings: [], expenses: [], maintenances: [], reminders: [], revenues: [] }

// Aplica uma mudança recebida do Realtime ao estado local.
function upsertInto(d: AppData, table: db.RealtimeTable, row: db.RealtimeRow): AppData {
  const list = d[table] as { id: string }[]
  const exists = list.some((x) => x.id === row.id)
  const next = exists ? list.map((x) => (x.id === row.id ? row : x)) : [...list, row]
  return { ...d, [table]: next } as AppData
}

function removeFrom(d: AppData, table: db.RealtimeTable, id: string): AppData {
  const next = (d[table] as { id: string }[]).filter((x) => x.id !== id)
  return { ...d, [table]: next } as AppData
}

interface Store {
  configured: boolean
  sessionLoading: boolean
  session: Session | null
  user: User | null

  dataLoading: boolean
  data: AppData
  refresh: () => Promise<void>

  billingEnabled: boolean
  subscription: Subscription | null
  subLoading: boolean
  hasAccess: boolean
  refreshSubscription: () => Promise<void>
  startSubscription: () => Promise<void>
  cancelSubscription: () => Promise<void>

  selectedVehicleId: string | null
  setSelectedVehicleId: (id: string | null) => void

  recovery: boolean
  driver: boolean
  driverKnown: boolean
  setDriver: (value: boolean) => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, isDriver?: boolean) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>

  addVehicle: (v: Omit<Vehicle, 'id' | 'createdAt'>) => Promise<Vehicle | null>
  updateVehicle: (id: string, patch: Partial<Vehicle>) => Promise<void>
  removeVehicle: (id: string) => Promise<void>

  addFueling: (f: Omit<Fueling, 'id'>) => Promise<void>
  updateFueling: (id: string, f: Omit<Fueling, 'id'>) => Promise<void>
  removeFueling: (id: string) => Promise<void>

  addExpense: (e: Omit<Expense, 'id'>) => Promise<void>
  updateExpense: (id: string, e: Omit<Expense, 'id'>) => Promise<void>
  removeExpense: (id: string) => Promise<void>

  addMaintenance: (m: Omit<Maintenance, 'id'>) => Promise<void>
  updateMaintenance: (id: string, m: Omit<Maintenance, 'id'>) => Promise<void>
  removeMaintenance: (id: string) => Promise<void>

  addReminder: (r: Omit<Reminder, 'id'>) => Promise<void>
  updateReminder: (id: string, r: Omit<Reminder, 'id'>) => Promise<void>
  toggleReminder: (id: string) => Promise<void>
  removeReminder: (id: string) => Promise<void>

  addRevenue: (r: Omit<Revenue, 'id'>) => Promise<void>
  updateRevenue: (id: string, r: Omit<Revenue, 'id'>) => Promise<void>
  removeRevenue: (id: string) => Promise<void>

  loadSample: () => Promise<void>
  deleteAllData: () => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

// Erros do Supabase (PostgrestError/AuthError) são objetos simples, não
// instâncias de Error — por isso precisamos extrair os campos manualmente,
// senão o alert mostraria "[object Object]".
function formatError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    const parts = [e.message, e.details, e.hint]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
    if (e.code) parts.push(`(código ${String(e.code)})`)
    if (parts.length) return parts.join(' — ')
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }
  return String(err)
}

async function run(action: () => Promise<void>) {
  try {
    await action()
  } catch (err) {
    console.error(err)
    alert('Ocorreu um erro ao salvar no Supabase:\n' + formatError(err))
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [sessionLoading, setSessionLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [recovery, setRecovery] = useState(false)
  const [data, setData] = useState<AppData>(EMPTY)
  const [dataLoading, setDataLoading] = useState(false)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [subLoading, setSubLoading] = useState(billingEnabled)
  // Espelha a assinatura para leitura dentro de listeners (sem stale closure).
  const subRef = useRef<Subscription | null>(null)
  useEffect(() => {
    subRef.current = subscription
  }, [subscription])
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    () => localStorage.getItem(SELECTED_KEY) || null,
  )

  // Sessão de autenticação
  useEffect(() => {
    if (!supabase) {
      setSessionLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setSessionLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    if (!supabase) return
    setDataLoading(true)
    try {
      setData(await db.fetchAll())
    } catch (err) {
      console.error(err)
    } finally {
      setDataLoading(false)
    }
  }, [])

  const refreshSubscription = useCallback(async () => {
    if (!supabase || !billingEnabled) {
      setSubscription(null)
      setSubLoading(false)
      return
    }
    setSubLoading(true)
    try {
      // Status salvo localmente (rápido).
      let sub = await db.fetchSubscription()
      // Baixa automática: se não estiver ativo, consulta o status REAL no
      // Mercado Pago. Cobre ativação após o checkout e cancelamento (durante
      // ou depois do teste grátis) quando o webhook não chegou.
      if (!sub || sub.status !== 'authorized') {
        try {
          const reconciled = await db.reconcileSubscription()
          if (reconciled) sub = reconciled
        } catch (err) {
          console.error('reconcileSubscription', err)
        }
      }
      setSubscription(sub)
    } finally {
      setSubLoading(false)
    }
  }, [])

  const startSubscription = useCallback(async () => {
    // Modo simples: link de pagamento público do Mercado Pago (assinatura).
    const linkUrl = import.meta.env.VITE_MP_CHECKOUT_URL as string | undefined
    if (linkUrl) {
      window.location.href = linkUrl
      return
    }
    // Modo API: Edge Function cria a assinatura por usuário (plano + trial).
    const { initPoint, alreadyActive } = await db.startCheckout()
    if (alreadyActive) {
      await refreshSubscription()
      return
    }
    if (initPoint) window.location.href = initPoint
  }, [refreshSubscription])

  const cancelSubscription = useCallback(async () => {
    await db.cancelSubscription()
    await refreshSubscription()
  }, [refreshSubscription])

  // Carrega os dados quando há usuário logado; limpa ao sair.
  useEffect(() => {
    if (session?.user) {
      void refresh()
      void refreshSubscription()
    } else {
      setData(EMPTY)
      setSubscription(null)
    }
  }, [session?.user?.id, refresh, refreshSubscription])

  // Ao voltar para o app (ex.: retornando do checkout do Mercado Pago) faz a
  // baixa automática: se ainda não tem acesso, reconsulta o status no MP e
  // libera o login assim que a assinatura é confirmada — sem ação manual.
  useEffect(() => {
    if (!billingEnabled || !session?.user) return
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return
      if (!subscriptionGrantsAccess(subRef.current)) void refreshSubscription()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [billingEnabled, session?.user?.id, refreshSubscription])

  // Sincronização em tempo real: reflete mudanças feitas em outros dispositivos.
  useEffect(() => {
    if (!supabase || !session?.user) return
    const userId = session.user.id
    const channel = db.subscribeToUserData(
      userId,
      (table, row) => setData((d) => upsertInto(d, table, row)),
      (table, id) => setData((d) => removeFrom(d, table, id)),
    )
    return () => db.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  useEffect(() => {
    if (selectedVehicleId) localStorage.setItem(SELECTED_KEY, selectedVehicleId)
    else localStorage.removeItem(SELECTED_KEY)
  }, [selectedVehicleId])

  // Mantém sempre um veículo selecionado, se existir algum.
  useEffect(() => {
    if (data.vehicles.length === 0) {
      if (selectedVehicleId !== null) setSelectedVehicleId(null)
      return
    }
    if (!data.vehicles.some((v) => v.id === selectedVehicleId)) {
      setSelectedVehicleId(data.vehicles[0].id)
    }
  }, [data.vehicles, selectedVehicleId])

  // ---------- Auth ----------

  const signIn: Store['signIn'] = useCallback(async (email, password) => {
    if (!supabase) return { error: 'Supabase não configurado' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signUp: Store['signUp'] = useCallback(async (email, password, isDriver) => {
    if (!supabase) return { error: 'Supabase não configurado' }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: isDriver === undefined ? undefined : { data: { is_driver: isDriver } },
    })
    return { error: error?.message ?? null }
  }, [])

  const setDriver: Store['setDriver'] = useCallback(async (value) => {
    if (!supabase) return
    const { error } = await supabase.auth.updateUser({ data: { is_driver: value } })
    if (error) {
      console.error(error)
      alert('Não foi possível salvar sua preferência: ' + error.message)
    }
  }, [])

  const signInWithGoogle: Store['signInWithGoogle'] = useCallback(async () => {
    if (!supabase) return { error: 'Supabase não configurado' }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
    return { error: error?.message ?? null }
  }, [])

  const resetPassword: Store['resetPassword'] = useCallback(async (email) => {
    if (!supabase) return { error: 'Supabase não configurado' }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    })
    return { error: error?.message ?? null }
  }, [])

  const updatePassword: Store['updatePassword'] = useCallback(async (password) => {
    if (!supabase) return { error: 'Supabase não configurado' }
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) setRecovery(false)
    return { error: error?.message ?? null }
  }, [])

  const signOut: Store['signOut'] = useCallback(async () => {
    await supabase?.auth.signOut()
    setData(EMPTY)
    setSubscription(null)
  }, [])

  // ---------- CRUD ----------

  const addVehicle: Store['addVehicle'] = useCallback(async (v) => {
    let created: Vehicle | null = null
    await run(async () => {
      created = await db.insertVehicle(v)
      setData((d) => ({ ...d, vehicles: [...d.vehicles, created!] }))
      setSelectedVehicleId(created!.id)
    })
    return created
  }, [])

  const updateVehicle: Store['updateVehicle'] = useCallback(async (id, patch) => {
    await run(async () => {
      const updated = await db.updateVehicleRow(id, patch)
      setData((d) => ({ ...d, vehicles: d.vehicles.map((v) => (v.id === id ? updated : v)) }))
    })
  }, [])

  const removeVehicle: Store['removeVehicle'] = useCallback(async (id) => {
    await run(async () => {
      await db.deleteRow('vehicles', id)
      setData((d) => ({
        vehicles: d.vehicles.filter((v) => v.id !== id),
        fuelings: d.fuelings.filter((f) => f.vehicleId !== id),
        expenses: d.expenses.filter((e) => e.vehicleId !== id),
        maintenances: d.maintenances.filter((m) => m.vehicleId !== id),
        reminders: d.reminders.filter((r) => r.vehicleId !== id),
        revenues: d.revenues.filter((r) => r.vehicleId !== id),
      }))
    })
  }, [])

  const addFueling: Store['addFueling'] = useCallback(async (f) => {
    await run(async () => {
      const row = await db.insertFueling(f)
      setData((d) => ({ ...d, fuelings: [...d.fuelings, row] }))
    })
  }, [])
  const updateFueling: Store['updateFueling'] = useCallback(async (id, f) => {
    await run(async () => {
      const row = await db.updateFuelingRow(id, f)
      setData((d) => ({ ...d, fuelings: d.fuelings.map((x) => (x.id === id ? row : x)) }))
    })
  }, [])
  const removeFueling: Store['removeFueling'] = useCallback(async (id) => {
    await run(async () => {
      await db.deleteRow('fuelings', id)
      setData((d) => ({ ...d, fuelings: d.fuelings.filter((x) => x.id !== id) }))
    })
  }, [])

  const addExpense: Store['addExpense'] = useCallback(async (e) => {
    await run(async () => {
      const row = await db.insertExpense(e)
      setData((d) => ({ ...d, expenses: [...d.expenses, row] }))
    })
  }, [])
  const updateExpense: Store['updateExpense'] = useCallback(async (id, e) => {
    await run(async () => {
      const row = await db.updateExpenseRow(id, e)
      setData((d) => ({ ...d, expenses: d.expenses.map((x) => (x.id === id ? row : x)) }))
    })
  }, [])
  const removeExpense: Store['removeExpense'] = useCallback(async (id) => {
    await run(async () => {
      await db.deleteRow('expenses', id)
      setData((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== id) }))
    })
  }, [])

  const addMaintenance: Store['addMaintenance'] = useCallback(async (m) => {
    await run(async () => {
      const row = await db.insertMaintenance(m)
      setData((d) => ({ ...d, maintenances: [...d.maintenances, row] }))
    })
  }, [])
  const updateMaintenance: Store['updateMaintenance'] = useCallback(async (id, m) => {
    await run(async () => {
      const row = await db.updateMaintenanceRow(id, m)
      setData((d) => ({ ...d, maintenances: d.maintenances.map((x) => (x.id === id ? row : x)) }))
    })
  }, [])
  const removeMaintenance: Store['removeMaintenance'] = useCallback(async (id) => {
    await run(async () => {
      await db.deleteRow('maintenances', id)
      setData((d) => ({ ...d, maintenances: d.maintenances.filter((x) => x.id !== id) }))
    })
  }, [])

  const addReminder: Store['addReminder'] = useCallback(async (r) => {
    await run(async () => {
      const row = await db.insertReminder(r)
      setData((d) => ({ ...d, reminders: [...d.reminders, row] }))
    })
  }, [])
  const updateReminder: Store['updateReminder'] = useCallback(async (id, r) => {
    await run(async () => {
      const row = await db.updateReminderRow(id, r)
      setData((d) => ({ ...d, reminders: d.reminders.map((x) => (x.id === id ? row : x)) }))
    })
  }, [])
  const toggleReminder: Store['toggleReminder'] = useCallback(
    async (id) => {
      const current = data.reminders.find((r) => r.id === id)
      if (!current) return
      await run(async () => {
        await db.setReminderDone(id, !current.done)
        setData((d) => ({
          ...d,
          reminders: d.reminders.map((r) => (r.id === id ? { ...r, done: !current.done } : r)),
        }))
      })
    },
    [data.reminders],
  )
  const removeReminder: Store['removeReminder'] = useCallback(async (id) => {
    await run(async () => {
      await db.deleteRow('reminders', id)
      setData((d) => ({ ...d, reminders: d.reminders.filter((x) => x.id !== id) }))
    })
  }, [])

  const addRevenue: Store['addRevenue'] = useCallback(async (r) => {
    await run(async () => {
      const row = await db.insertRevenue(r)
      setData((d) => ({ ...d, revenues: [...d.revenues, row] }))
    })
  }, [])
  const updateRevenue: Store['updateRevenue'] = useCallback(async (id, r) => {
    await run(async () => {
      const row = await db.updateRevenueRow(id, r)
      setData((d) => ({ ...d, revenues: d.revenues.map((x) => (x.id === id ? row : x)) }))
    })
  }, [])
  const removeRevenue: Store['removeRevenue'] = useCallback(async (id) => {
    await run(async () => {
      await db.deleteRow('revenues', id)
      setData((d) => ({ ...d, revenues: d.revenues.filter((x) => x.id !== id) }))
    })
  }, [])

  const loadSample: Store['loadSample'] = useCallback(async () => {
    await run(async () => {
      const rows = sampleRows()
      for (const sv of rows) {
        const vehicle = await db.insertVehicle(sv.vehicle)
        await Promise.all([
          ...sv.fuelings.map((f) => db.insertFueling({ ...f, vehicleId: vehicle.id })),
          ...sv.expenses.map((e) => db.insertExpense({ ...e, vehicleId: vehicle.id })),
          ...sv.maintenances.map((m) => db.insertMaintenance({ ...m, vehicleId: vehicle.id })),
          ...sv.reminders.map((r) => db.insertReminder({ ...r, vehicleId: vehicle.id })),
        ])
      }
    })
    await refresh()
  }, [refresh])

  const deleteAllData: Store['deleteAllData'] = useCallback(async () => {
    await run(async () => {
      await db.deleteAllForUser()
      setData(EMPTY)
    })
  }, [])

  const value = useMemo<Store>(
    () => ({
      configured: isConfigured,
      sessionLoading,
      session,
      user: session?.user ?? null,
      dataLoading,
      data,
      refresh,
      billingEnabled,
      subscription,
      subLoading,
      hasAccess: !billingEnabled || subscriptionGrantsAccess(subscription),
      refreshSubscription,
      startSubscription,
      cancelSubscription,
      selectedVehicleId,
      setSelectedVehicleId,
      recovery,
      driver: session?.user?.user_metadata?.is_driver === true,
      driverKnown: typeof session?.user?.user_metadata?.is_driver === 'boolean',
      setDriver,
      signIn,
      signUp,
      signInWithGoogle,
      resetPassword,
      updatePassword,
      signOut,
      addVehicle,
      updateVehicle,
      removeVehicle,
      addFueling,
      updateFueling,
      removeFueling,
      addExpense,
      updateExpense,
      removeExpense,
      addMaintenance,
      updateMaintenance,
      removeMaintenance,
      addReminder,
      updateReminder,
      toggleReminder,
      removeReminder,
      addRevenue,
      updateRevenue,
      removeRevenue,
      loadSample,
      deleteAllData,
    }),
    [
      sessionLoading,
      session,
      dataLoading,
      data,
      refresh,
      subscription,
      subLoading,
      refreshSubscription,
      startSubscription,
      cancelSubscription,
      selectedVehicleId,
      recovery,
      setDriver,
      signIn,
      signUp,
      signInWithGoogle,
      resetPassword,
      updatePassword,
      signOut,
      addVehicle,
      updateVehicle,
      removeVehicle,
      addFueling,
      updateFueling,
      removeFueling,
      addExpense,
      updateExpense,
      removeExpense,
      addMaintenance,
      updateMaintenance,
      removeMaintenance,
      addReminder,
      updateReminder,
      toggleReminder,
      removeReminder,
      addRevenue,
      updateRevenue,
      removeRevenue,
      loadSample,
      deleteAllData,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore deve ser usado dentro de <StoreProvider>')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSelectedVehicle(): Vehicle | null {
  const { data, selectedVehicleId } = useStore()
  return data.vehicles.find((v) => v.id === selectedVehicleId) ?? null
}
