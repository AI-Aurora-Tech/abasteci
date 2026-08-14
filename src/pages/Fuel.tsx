import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelectedVehicle, useStore } from '../store'
import { EmptyState, Modal, PageHeader, PaymentField, RecordCard } from '../components/ui'
import { FuelAdvisor } from '../components/FuelAdvisor'
import type { Fueling, FuelType, PaymentMethod } from '../types'
import { PAYMENT_ICON } from '../constants'
import { brl, consumptionByFuel, currentOdometer, formatDate, num, tankConsumptions, todayISO } from '../utils'
import { locateNearbyStations, mapsLink, type StationResult } from '../geo'

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

  // Consumo por tanque (km/l) mostrado no abastecimento que fecha o tanque,
  // e a média separada por combustível (etanol × gasolina).
  const tankMap = useMemo(() => {
    const m = new Map<string, ReturnType<typeof tankConsumptions>[number]>()
    for (const t of tankConsumptions(fuelings)) m.set(t.closingId, t)
    return m
  }, [fuelings])
  const byFuel = useMemo(() => consumptionByFuel(fuelings), [fuelings])

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

      {(['Gasolina', 'Gasolina Aditivada', 'Etanol'].includes(vehicle.fuelType) ||
        fuelings.some((f) => ['Gasolina', 'Gasolina Aditivada', 'Etanol'].includes(f.fuelType))) && (
        <FuelAdvisor fuelings={fuelings} />
      )}

      {Object.keys(byFuel).length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>📊 Consumo médio por combustível</strong>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 10 }}>
            {(Object.entries(byFuel) as [string, number][]).map(([fuel, kmL]) => (
              <div key={fuel}>
                <div className="muted" style={{ fontSize: 12 }}>{fuel}</div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{num(kmL)} km/l</div>
              </div>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Média dos tanques cheios de cada combustível.
          </div>
        </div>
      )}

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
              subtitle={
                <>
                  {f.station ? `${f.fuelType} · ${f.station}` : f.fuelType}
                  {f.latitude != null && f.longitude != null && ' 📍'}
                </>
              }
              meta={[
                `${f.odometer.toLocaleString('pt-BR')} km`,
                `${num(f.liters)} L`,
                `${num(f.pricePerLiter, 3)} R$/L`,
                ...(tankMap.has(f.id) ? [`📊 ${num(tankMap.get(f.id)!.kmPerLiter)} km/l neste tanque`] : []),
                ...(f.paymentMethod ? [`${PAYMENT_ICON[f.paymentMethod]} ${f.paymentMethod}`] : []),
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
  const [payment, setPayment] = useState<string>(editing?.paymentMethod ?? '')
  const [latitude, setLatitude] = useState<number | undefined>(editing?.latitude)
  const [longitude, setLongitude] = useState<number | undefined>(editing?.longitude)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [geoMsg, setGeoMsg] = useState('')
  const [stations, setStations] = useState<StationResult[]>([])
  const [lastEdited, setLastEdited] = useState<'liters' | 'price' | 'total' | null>(null)

  async function useLocation() {
    setGeoStatus('loading')
    setGeoMsg('Localizando postos próximos…')
    try {
      const { coords, stations: found, label } = await locateNearbyStations()
      setLatitude(coords.lat)
      setLongitude(coords.lng)
      setStations(found)
      if (found.length) {
        const nearest = found[0]
        setStation(nearest.name) // seleciona automaticamente o mais próximo
        const dist = nearest.distance != null ? ` (a ${Math.round(nearest.distance)} m)` : ''
        setGeoMsg(
          found.length > 1
            ? `Posto mais próximo: ${nearest.name}${dist}. Toque em outro abaixo se não for esse.`
            : `Posto encontrado: ${nearest.name}${dist}`,
        )
      } else if (label) {
        setStation(label)
        setGeoMsg('Não achei postos por perto — usei o endereço aproximado.')
      } else {
        setGeoMsg('Localização registrada. Não achei o nome do posto — preencha manualmente.')
      }
      setGeoStatus('ok')
    } catch (err) {
      setGeoStatus('error')
      setGeoMsg(err instanceof Error ? err.message : 'Falha ao obter a localização.')
    }
  }

  function pickStation(s: StationResult) {
    setStation(s.name)
    setLatitude(s.coords.lat)
    setLongitude(s.coords.lng)
  }

  // Ao abrir para um novo abastecimento, tenta localizar o posto sozinho —
  // o usuário já está no posto. (Não faz em edição.)
  useEffect(() => {
    if (!editing) void useLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      latitude,
      longitude,
      paymentMethod: (payment || undefined) as PaymentMethod | undefined,
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
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ flex: 1 }}
              value={station}
              onChange={(e) => setStation(e.target.value)}
              placeholder="Ex.: Posto Ipiranga"
            />
            <button
              type="button"
              className="btn sm"
              onClick={() => void useLocation()}
              disabled={geoStatus === 'loading'}
              title="Usar localização do celular"
            >
              {geoStatus === 'loading' ? '…' : '📍'}
            </button>
          </div>
          {geoMsg && (
            <div
              className="geo-msg"
              style={{ color: geoStatus === 'error' ? 'var(--danger)' : 'var(--text-dim)' }}
            >
              {geoMsg}
              {latitude != null && longitude != null && (
                <>
                  {' · '}
                  <a href={mapsLink(latitude, longitude)} target="_blank" rel="noopener noreferrer">
                    ver no mapa
                  </a>
                </>
              )}
            </div>
          )}
          {stations.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {stations.map((s, i) => {
                const active = s.name === station
                return (
                  <button
                    type="button"
                    key={`${s.name}-${i}`}
                    onClick={() => pickStation(s)}
                    style={{
                      border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: active ? 'var(--primary-soft)' : 'var(--surface-2, transparent)',
                      color: 'var(--text)',
                      borderRadius: 999,
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {s.name}
                    {s.distance != null && (
                      <span className="muted" style={{ fontWeight: 400 }}> · {Math.round(s.distance)} m</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <PaymentField value={payment} onChange={setPayment} />

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
