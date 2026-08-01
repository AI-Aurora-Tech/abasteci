// Domínio do abasteci — modelos de dados

export type FuelType =
  | 'Gasolina'
  | 'Gasolina Aditivada'
  | 'Etanol'
  | 'Diesel'
  | 'Diesel S10'
  | 'GNV'
  | 'Elétrico'

export interface Vehicle {
  id: string
  name: string
  plate: string
  make: string
  model: string
  year: number | null
  fuelType: FuelType
  odometer: number // km atual (atualizado pelos registros)
  color: string // cor de identificação no app
  createdAt: string
}

export interface Fueling {
  id: string
  vehicleId: string
  date: string // ISO (yyyy-mm-dd)
  odometer: number // km no momento do abastecimento
  fuelType: FuelType
  liters: number
  pricePerLiter: number
  total: number
  fullTank: boolean
  station?: string
  latitude?: number
  longitude?: number
  note?: string
}

export type ExpenseCategory =
  | 'IPVA'
  | 'Seguro'
  | 'Multa'
  | 'Pedágio'
  | 'Estacionamento'
  | 'Lavagem'
  | 'Financiamento'
  | 'Outro'

export interface Expense {
  id: string
  vehicleId: string
  date: string
  category: ExpenseCategory
  description: string
  odometer?: number
  value: number
}

export type MaintenanceType = 'Preventiva' | 'Corretiva'

export interface Maintenance {
  id: string
  vehicleId: string
  date: string
  type: MaintenanceType
  service: string
  odometer: number
  value: number
  workshop?: string
  note?: string
}

export type ReminderBasis = 'date' | 'odometer' | 'both'

export interface Reminder {
  id: string
  vehicleId: string
  title: string
  basis: ReminderBasis
  dueDate?: string
  dueOdometer?: number
  done: boolean
  note?: string
}

export interface AppData {
  vehicles: Vehicle[]
  fuelings: Fueling[]
  expenses: Expense[]
  maintenances: Maintenance[]
  reminders: Reminder[]
}
