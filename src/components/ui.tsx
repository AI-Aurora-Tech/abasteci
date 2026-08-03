import type { ReactNode } from 'react'
import { PAYMENT_METHODS } from '../constants'

export function PaymentField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label>Forma de pagamento</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— não informado —</option>
        {PAYMENT_METHODS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn ghost" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="page-head">
      <div className="row">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}

export function Kpi({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: string
}) {
  return (
    <div className="card">
      <div className="kpi-label">
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  )
}

export function RecordCard({
  icon,
  title,
  subtitle,
  meta,
  amount,
  badge,
  onEdit,
  onDelete,
}: {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode[]
  amount?: ReactNode
  badge?: ReactNode
  onEdit?: () => void
  onDelete?: () => void
}) {
  const editable = typeof onEdit === 'function'
  return (
    <div className="rec">
      {icon != null && <div className="rec-icon">{icon}</div>}
      <div
        className={'rec-main' + (editable ? ' tappable' : '')}
        onClick={editable ? onEdit : undefined}
        role={editable ? 'button' : undefined}
        tabIndex={editable ? 0 : undefined}
        onKeyDown={
          editable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onEdit!()
                }
              }
            : undefined
        }
      >
        <div className="rec-title">{title}</div>
        {subtitle && <div className="rec-sub">{subtitle}</div>}
        {meta && meta.length > 0 && (
          <div className="rec-meta">
            {meta.map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </div>
        )}
      </div>
      <div className="rec-side">
        {badge}
        {amount != null && <div className="rec-amount">{amount}</div>}
        {onDelete && (
          <button className="rec-del" onClick={onDelete} aria-label="Excluir">
            🗑
          </button>
        )}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: string
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="card empty">
      <div className="big">{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{title}</div>
      {hint && <p style={{ maxWidth: 340, margin: '8px auto 16px' }}>{hint}</p>}
      {action}
    </div>
  )
}

export interface BarDatum {
  label: string
  value: number
}

export function BarChart({ data, format }: { data: BarDatum[]; format: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div className="bar-col" key={i}>
          <div className="bar-val">{d.value > 0 ? format(d.value) : ''}</div>
          <div className="bar" style={{ height: `${(d.value / max) * 100}%` }} title={format(d.value)} />
          <div className="bar-lbl">{d.label}</div>
        </div>
      ))}
    </div>
  )
}
