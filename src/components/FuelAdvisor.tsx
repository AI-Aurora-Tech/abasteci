import { useState } from 'react'
import type { Fueling } from '../types'
import { averageConsumption, brl, num } from '../utils'

const GAS_TYPES = ['Gasolina', 'Gasolina Aditivada']
const RECENT = 6

/** Média do preço/litro dos últimos N abastecimentos de um combustível. */
function avgRecentPrice(fuelings: Fueling[], n = RECENT): { avg: number | null; count: number } {
  const recent = [...fuelings]
    .sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer)
    .slice(0, n)
  if (!recent.length) return { avg: null, count: 0 }
  const sum = recent.reduce((s, f) => s + f.pricePerLiter, 0)
  return { avg: sum / recent.length, count: recent.length }
}

/**
 * Sugere abastecer com etanol ou gasolina. Preenche os preços com a média
 * dos últimos 6 abastecimentos de cada combustível (editável). O ponto de
 * equilíbrio é personalizado pelo consumo real do veículo (km/l de cada
 * combustível); sem dados suficientes, usa a regra dos 70%.
 */
export function FuelAdvisor({ fuelings }: { fuelings: Fueling[] }) {
  const gasF = fuelings.filter((f) => GAS_TYPES.includes(f.fuelType))
  const ethF = fuelings.filter((f) => f.fuelType === 'Etanol')

  const kmLGas = averageConsumption(gasF)
  const kmLEth = averageConsumption(ethF)
  const personalized = Boolean(kmLGas && kmLEth)
  const breakEven = personalized ? kmLEth! / kmLGas! : 0.7

  const gasAvg = avgRecentPrice(gasF)
  const ethAvg = avgRecentPrice(ethF)

  const [gasPrice, setGasPrice] = useState(gasAvg.avg ? gasAvg.avg.toFixed(2) : '')
  const [ethPrice, setEthPrice] = useState(ethAvg.avg ? ethAvg.avg.toFixed(2) : '')

  const useAverages = () => {
    if (gasAvg.avg) setGasPrice(gasAvg.avg.toFixed(2))
    if (ethAvg.avg) setEthPrice(ethAvg.avg.toFixed(2))
  }

  const G = parseFloat(gasPrice.replace(',', '.')) || 0
  const E = parseFloat(ethPrice.replace(',', '.')) || 0
  const ready = G > 0 && E > 0

  const useEth = ready && E / G <= breakEven
  const threshold = G * breakEven // preço máximo do etanol que ainda compensa
  const costGas = kmLGas ? G / kmLGas : null
  const costEth = kmLEth ? E / kmLEth : null

  const hasAverages = Boolean(gasAvg.avg || ethAvg.avg)

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
          {gasAvg.avg && (
            <div className="advisor-hint">média de {gasAvg.count} · {brl(gasAvg.avg)}</div>
          )}
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Preço etanol (R$/L)</label>
          <input inputMode="decimal" value={ethPrice} onChange={(e) => setEthPrice(e.target.value)} placeholder="0,00" />
          {ethAvg.avg && (
            <div className="advisor-hint">média de {ethAvg.count} · {brl(ethAvg.avg)}</div>
          )}
        </div>
      </div>

      {hasAverages && (
        <button className="link-btn" style={{ marginTop: 8 }} onClick={useAverages} type="button">
          ↻ usar médias dos últimos {RECENT}
        </button>
      )}

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
