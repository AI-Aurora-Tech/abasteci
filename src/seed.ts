import type { Expense, Fueling, Maintenance, Reminder, Vehicle } from './types'

export interface SampleVehicle {
  vehicle: Omit<Vehicle, 'id' | 'createdAt'>
  fuelings: Omit<Fueling, 'id' | 'vehicleId'>[]
  expenses: Omit<Expense, 'id' | 'vehicleId'>[]
  maintenances: Omit<Maintenance, 'id' | 'vehicleId'>[]
  reminders: Omit<Reminder, 'id' | 'vehicleId'>[]
}

/**
 * Dados de exemplo inseridos no Supabase quando o usuário clica em
 * "Popular com dados de exemplo" em Configurações. Ajuda a visualizar o
 * painel preenchido logo após criar a conta.
 */
export function sampleRows(): SampleVehicle[] {
  return [
    {
      vehicle: {
        name: 'Onix LT',
        plate: 'RPA-2C34',
        make: 'Chevrolet',
        model: 'Onix',
        year: 2021,
        fuelType: 'Gasolina',
        odometer: 48200,
        color: '#0ea5e9',
      },
      fuelings: [
        { date: '2026-04-05', odometer: 46100, fuelType: 'Gasolina', liters: 38.2, pricePerLiter: 5.79, total: 221.18, fullTank: true, station: 'Posto Ipiranga' },
        { date: '2026-04-22', odometer: 46540, fuelType: 'Gasolina', liters: 34.6, pricePerLiter: 5.85, total: 202.41, fullTank: true, station: 'Shell Select' },
        { date: '2026-05-11', odometer: 47010, fuelType: 'Gasolina', liters: 37.1, pricePerLiter: 5.72, total: 212.21, fullTank: true, station: 'Posto Ipiranga' },
        { date: '2026-06-01', odometer: 47480, fuelType: 'Gasolina', liters: 36.4, pricePerLiter: 5.99, total: 218.04, fullTank: true, station: 'BR Petrobras' },
        { date: '2026-06-20', odometer: 47950, fuelType: 'Gasolina', liters: 35.9, pricePerLiter: 6.05, total: 217.2, fullTank: true, station: 'Shell Select' },
        { date: '2026-07-09', odometer: 48200, fuelType: 'Gasolina', liters: 19.8, pricePerLiter: 5.95, total: 117.81, fullTank: false, station: 'Posto Ipiranga' },
      ],
      expenses: [
        { date: '2026-01-15', category: 'IPVA', description: 'IPVA 2026', value: 1240.0 },
        { date: '2026-03-10', category: 'Seguro', description: 'Parcela seguro anual', value: 380.5 },
        { date: '2026-05-02', category: 'Pedágio', description: 'Viagem litoral', odometer: 46900, value: 42.8 },
      ],
      maintenances: [
        { date: '2026-02-18', type: 'Preventiva', service: 'Troca de óleo e filtro', odometer: 45000, value: 320.0, workshop: 'Oficina do Zé' },
        { date: '2026-06-05', type: 'Corretiva', service: 'Troca de pastilhas de freio', odometer: 47600, value: 480.0, workshop: 'Auto Center Silva' },
      ],
      reminders: [
        { title: 'Próxima troca de óleo', basis: 'odometer', dueOdometer: 50000, done: false },
        { title: 'Licenciamento anual', basis: 'date', dueDate: '2026-09-30', done: false },
      ],
    },
    {
      vehicle: {
        name: 'CG 160',
        plate: 'RPB-7J88',
        make: 'Honda',
        model: 'CG 160 Fan',
        year: 2022,
        fuelType: 'Gasolina',
        odometer: 21540,
        color: '#f97316',
      },
      fuelings: [
        { date: '2026-06-15', odometer: 21200, fuelType: 'Gasolina', liters: 11.5, pricePerLiter: 5.89, total: 67.74, fullTank: true, station: 'Ipiranga' },
        { date: '2026-07-05', odometer: 21540, fuelType: 'Gasolina', liters: 9.8, pricePerLiter: 6.02, total: 59.0, fullTank: true, station: 'Shell' },
      ],
      expenses: [{ date: '2026-02-20', category: 'IPVA', description: 'IPVA 2026', value: 210.0 }],
      maintenances: [
        { date: '2026-05-30', type: 'Preventiva', service: 'Ajuste de corrente e relação', odometer: 21000, value: 150.0, workshop: 'Moto Peças Center' },
      ],
      reminders: [{ title: 'Revisão dos 24.000 km', basis: 'both', dueDate: '2026-10-15', dueOdometer: 24000, done: false }],
    },
  ]
}
