import type { ReactNode } from 'react'

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
      {hint && <p style={{ maxWidth: 380, margin: '8px auto 16px' }}>{hint}</p>}
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
    <div className="topbar">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
