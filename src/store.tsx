import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  Vehicle,
} from './types'
import * as db from './supabase'
import { isConfigured, supabase } from './supabase'
import { sampleRows } from './seed'

const SELECTED_KEY = 'abasteci:selectedVehicle:v1'
const EMPTY: AppData = { vehicles: [], fuelings: [], expenses: [], maintenances: [], reminders: [] }

interface Store {
  configured: boolean
  sessionLoading: boolean
  session: Session | null
  user: User | null

  dataLoading: boolean
  data: AppData
  refresh: () => Promise<void>

  selectedVehicleId: string | null
  setSelectedVehicleId: (id: string | null) => void

  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>

  addVehicle: (v: Omit<Vehicle, 'id' | 'createdAt'>) => Promise<Vehicle | null>
  updateVehicle: (id: string, patch: Partial<Vehicle>) => Promise<void>
  removeVehicle: (id: string) => Promise<void>

  addFueling: (f: Omit<Fueling, 'id'>) => Promise<void>
  removeFueling: (id: string) => Promise<void>

  addExpense: (e: Omit<Expense, 'id'>) => Promise<void>
  removeExpense: (id: string) => Promise<void>

  addMaintenance: (m: Omit<Maintenance, 'id'>) => Promise<void>
  removeMaintenance: (id: string) => Promise<void>

  addReminder: (r: Omit<Reminder, 'id'>) => Promise<void>
  toggleReminder: (id: string) => Promise<void>
  removeReminder: (id: string) => Promise<void>

  loadSample: () => Promise<void>
  deleteAllData: () => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

async function run(action: () => Promise<void>) {
  try {
    await action()
  } catch (err) {
    console.error(err)
    const msg = err instanceof Error ? err.message : String(err)
    alert('Ocorreu um erro ao salvar no Supabase:\n' + msg)
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [sessionLoading, setSessionLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [data, setData] = useState<AppData>(EMPTY)
  const [dataLoading, setDataLoading] = useState(false)
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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
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

  // Carrega os dados quando há usuário logado; limpa ao sair.
  useEffect(() => {
    if (session?.user) {
      void refresh()
    } else {
      setData(EMPTY)
    }
  }, [session?.user?.id, refresh])

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

  const signUp: Store['signUp'] = useCallback(async (email, password) => {
    if (!supabase) return { error: 'Supabase não configurado' }
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signOut: Store['signOut'] = useCallback(async () => {
    await supabase?.auth.signOut()
    setData(EMPTY)
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
      }))
    })
  }, [])

  const addFueling: Store['addFueling'] = useCallback(async (f) => {
    await run(async () => {
      const row = await db.insertFueling(f)
      setData((d) => ({ ...d, fuelings: [...d.fuelings, row] }))
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
      selectedVehicleId,
      setSelectedVehicleId,
      signIn,
      signUp,
      signOut,
      addVehicle,
      updateVehicle,
      removeVehicle,
      addFueling,
      removeFueling,
      addExpense,
      removeExpense,
      addMaintenance,
      removeMaintenance,
      addReminder,
      toggleReminder,
      removeReminder,
      loadSample,
      deleteAllData,
    }),
    [
      sessionLoading,
      session,
      dataLoading,
      data,
      refresh,
      selectedVehicleId,
      signIn,
      signUp,
      signOut,
      addVehicle,
      updateVehicle,
      removeVehicle,
      addFueling,
      removeFueling,
      addExpense,
      removeExpense,
      addMaintenance,
      removeMaintenance,
      addReminder,
      toggleReminder,
      removeReminder,
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
