import { useState } from 'react'
import type { Fueling } from '../types'
import { averageConsumption, brl, num } from '../utils'

const GAS_TYPES = ['Gasolina', 'Gasolina Aditivada']

function latestPrice(fuelings: Fueling[]): number | null {
  const sorted = [...fuelings].sort((a, b) => b.date.localeCompare(a.date))
  return sorted.length ? sorted[0].pricePerLiter : null
}

/**
 * Sugere abastecer com etanol ou gasolina. O ponto de equilíbrio é
 * personalizado pelo consumo real do veículo (km/l de cada combustível,
 * calculado dos abastecimentos). Sem dados suficientes, usa a regra dos 70%.
 */
export function FuelAdvisor({ fuelings }: { fuelings: Fueling[] }) {
  const gasF = fuelings.filter((f) => GAS_TYPES.includes(f.fuelType))
  const ethF = fuelings.filter((f) => f.fuelType === 'Etanol')

  const kmLGas = averageConsumption(gasF)
  const kmLEth = averageConsumption(ethF)
  const personalized = Boolean(kmLGas && kmLEth)
  const breakEven = personalized ? kmLEth! / kmLGas! : 0.7

  const [gasPrice, setGasPrice] = useState(() => {
    const p = latestPrice(gasF)
    return p ? String(p.toFixed(2)) : ''
  })
  const [ethPrice, setEthPrice] = useState(() => {
    const p = latestPrice(ethF)
    return p ? String(p.toFixed(2)) : ''
  })

  const G = parseFloat(gasPrice.replace(',', '.')) || 0
  const E = parseFloat(ethPrice.replace(',', '.')) || 0
  const ready = G > 0 && E > 0

  const useEth = ready && E / G <= breakEven
  const threshold = G * breakEven // preço máximo do etanol que ainda compensa
  const costGas = kmLGas ? G / kmLGas : null
  const costEth = kmLEth ? E / kmLEth : null

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row-between">
        <strong>⛽ Etanol ou gasolina?</strong>
        <span className="badge">{personalized ? 'seu consumo' : 'regra 70%'}</span>
      </div>

      <div className="field-row" style={{ marginTop: 12 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Preço gasolina (R$/L)</label>
          <input inputMode="decimal" value={gasPrice} onChange={(e) => setGasPrice(e.target.value)} placeholder="0,00" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Preço etanol (R$/L)</label>
          <input inputMode="decimal" value={ethPrice} onChange={(e) => setEthPrice(e.target.value)} placeholder="0,00" />
        </div>
      </div>

      {ready ? (
        <>
          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              borderRadius: 12,
              background: useEth ? 'rgba(22,163,74,.12)' : 'var(--primary-soft)',
              color: useEth ? 'var(--success)' : 'var(--primary-dark)',
              fontWeight: 800,
              fontSize: 18,
              textAlign: 'center',
            }}
          >
            Abasteça com {useEth ? 'ETANOL' : 'GASOLINA'}
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
            O etanol compensa quando custa até <strong>{brl(threshold)}</strong> (≈{Math.round(breakEven * 100)}% do preço
            da gasolina).
            {personalized
              ? ` Baseado no seu consumo: ${num(kmLGas!)} km/l na gasolina e ${num(kmLEth!)} km/l no etanol.`
              : ' Usando a regra dos 70% — registre 2+ abastecimentos de tanque cheio de cada tipo para personalizar.'}
          </p>
          {costGas && costEth && (
            <div className="rec-meta" style={{ marginTop: 4 }}>
              <span>Custo/km gasolina: {brl(costGas)}</span>
              <span>Custo/km etanol: {brl(costEth)}</span>
            </div>
          )}
        </>
      ) : (
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          Informe os preços atuais dos dois combustíveis para ver a sugestão.
        </p>
      )}
    </div>
  )
}
