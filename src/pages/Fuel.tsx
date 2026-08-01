import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelectedVehicle, useStore } from '../store'
import { EmptyState, Modal, PageHeader, RecordCard } from '../components/ui'
import type { Fueling, FuelType } from '../types'
import { brl, currentOdometer, formatDate, num, todayISO } from '../utils'

const FUEL_TYPES: FuelType[] = [
  'Gasolina',
  'Gasolina Aditivada',
  'Etanol',
  'Diesel',
  'Diesel S10',
  'GNV',
  'Elétrico',
]

export default function Fuel() {
  const { data, removeFueling } = useStore()
  const vehicle = useSelectedVehicle()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Fueling | null>(null)

  const openNew = () => {
    setEditing(null)
    setOpen(true)
  }
  const openEdit = (f: Fueling) => {
    setEditing(f)
    setOpen(true)
  }
  const confirmDelete = (f: Fueling) => {
    if (confirm(`Excluir o abastecimento de ${formatDate(f.date)} (${brl(f.total)})?`)) {
      void removeFueling(f.id)
    }
  }

  const fuelings = useMemo(
    () =>
      data.fuelings
        .filter((f) => f.vehicleId === vehicle?.id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer),
    [data.fuelings, vehicle?.id],
  )

  if (!vehicle) {
    return (
      <>
        <PageHeader title="Abastecimentos" />
        <EmptyState icon="🚗" title="Cadastre um veículo primeiro" action={<Link to="/veiculos" className="btn primary">Veículos</Link>} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Abastecimentos"
        subtitle={`${vehicle.name} · ${fuelings.length} registro(s)`}
        action={
          <button className="btn primary sm" onClick={openNew}>
            + Abastecer
          </button>
        }
      />

      {fuelings.length === 0 ? (
        <EmptyState
          icon="⛽"
          title="Nenhum abastecimento"
          hint="Registre seus abastecimentos para acompanhar consumo médio, gasto e preço do combustível."
          action={
            <button className="btn primary" onClick={openNew}>
              Registrar abastecimento
            </button>
          }
        />
      ) : (
        <div className="card">
          {fuelings.map((f) => (
            <RecordCard
              key={f.id}
              icon="⛽"
              title={formatDate(f.date)}
              subtitle={f.station ? `${f.fuelType} · ${f.station}` : f.fuelType}
              meta={[
                `${f.odometer.toLocaleString('pt-BR')} km`,
                `${num(f.liters)} L`,
                `${num(f.pricePerLiter, 3)} R$/L`,
              ]}
              amount={brl(f.total)}
              badge={<span className={'badge ' + (f.fullTank ? 'green' : '')}>{f.fullTank ? 'Cheio' : 'Parcial'}</span>}
              onEdit={() => openEdit(f)}
              onDelete={() => confirmDelete(f)}
            />
          ))}
        </div>
      )}

      {open && <FuelForm editing={editing} onClose={() => setOpen(false)} />}
    </>
  )
}

function FuelForm({ editing, onClose }: { editing: Fueling | null; onClose: () => void }) {
  const { data, addFueling, updateFueling } = useStore()
  const vehicle = useSelectedVehicle()!
  const [date, setDate] = useState(editing?.date ?? todayISO())
  const [odometer, setOdometer] = useState(String(editing?.odometer ?? (currentOdometer(data, vehicle) || '')))
  const [fuelType, setFuelType] = useState<FuelType>(editing?.fuelType ?? vehicle.fuelType)
  const [liters, setLiters] = useState(editing ? String(editing.liters) : '')
  const [pricePerLiter, setPricePerLiter] = useState(editing ? String(editing.pricePerLiter) : '')
  const [total, setTotal] = useState(editing ? String(editing.total) : '')
  const [fullTank, setFullTank] = useState(editing ? editing.fullTank : true)
  const [station, setStation] = useState(editing?.station ?? '')
  const [lastEdited, setLastEdited] = useState<'liters' | 'price' | 'total' | null>(null)

  const L = parseFloat(liters.replace(',', '.')) || 0
  const P = parseFloat(pricePerLiter.replace(',', '.')) || 0
  const T = parseFloat(total.replace(',', '.')) || 0

  // Auto-completa o terceiro campo a partir de litros × preço = total.
  const computed = useMemo(() => {
    if (lastEdited === 'total' && P > 0) return { liters: T / P }
    if (lastEdited === 'total' && L > 0) return { price: T / L }
    if ((lastEdited === 'liters' || lastEdited === 'price') && L > 0 && P > 0) return { total: L * P }
    return {}
  }, [lastEdited, L, P, T])

  const finalTotal = T || (L && P ? L * P : 0)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const litersFinal = L || (T && P ? T / P : 0)
    const priceFinal = P || (T && L ? T / L : 0)
    if (!litersFinal || !finalTotal) return
    const payload = {
      vehicleId: vehicle.id,
      date,
      odometer: parseInt(odometer, 10) || vehicle.odometer,
      fuelType,
      liters: Number(litersFinal.toFixed(2)),
      pricePerLiter: Number(priceFinal.toFixed(3)),
      total: Number(finalTotal.toFixed(2)),
      fullTank,
      station: station.trim() || undefined,
    }
    if (editing) void updateFueling(editing.id, payload)
    else void addFueling(payload)
    onClose()
  }

  return (
    <Modal title={editing ? 'Editar abastecimento' : 'Novo abastecimento'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>Hodômetro (km)</label>
            <input
              type="number"
              inputMode="numeric"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="field">
          <label>Combustível</label>
          <select value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelType)}>
            {FUEL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Litros</label>
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={computed.liters ? computed.liters.toFixed(2) : liters}
              onChange={(e) => {
                setLiters(e.target.value)
                setLastEdited('liters')
              }}
            />
          </div>
          <div className="field">
            <label>Preço por litro (R$)</label>
            <input
              inputMode="decimal"
              placeholder="0,000"
              value={computed.price ? computed.price.toFixed(3) : pricePerLiter}
              onChange={(e) => {
                setPricePerLiter(e.target.value)
                setLastEdited('price')
              }}
            />
          </div>
        </div>

        <div className="field">
          <label>Valor total (R$)</label>
          <input
            inputMode="decimal"
            placeholder="0,00"
            value={computed.total ? computed.total.toFixed(2) : total}
            onChange={(e) => {
              setTotal(e.target.value)
              setLastEdited('total')
            }}
          />
        </div>

        {finalTotal > 0 && <div className="computed">Total: {brl(finalTotal)}</div>}

        <div className="field">
          <label>Posto (opcional)</label>
          <input value={station} onChange={(e) => setStation(e.target.value)} placeholder="Ex.: Posto Ipiranga" />
        </div>

        <div className="field check-row">
          <input id="fullTank" type="checkbox" checked={fullTank} onChange={(e) => setFullTank(e.target.checked)} />
          <label htmlFor="fullTank" style={{ margin: 0 }}>
            Enchi o tanque (necessário para calcular o consumo)
          </label>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  )
}
