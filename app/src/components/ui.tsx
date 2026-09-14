import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { copy, partyId } from '../lib/format'
import type { Role } from '../ledger/sentry'

type Variant = 'primary' | 'secondary' | 'danger'

export function Button({
  variant = 'secondary',
  busy,
  busyLabel = 'Submitting',
  small,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean; busyLabel?: string; small?: boolean }) {
  const cls = ['btn', variant === 'primary' ? 'primary' : '', variant === 'danger' ? 'danger' : '', small ? 'small' : '', busy ? 'busy' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button className={cls} aria-busy={busy || undefined} {...rest} disabled={rest.disabled || busy}>
      {busy ? (
        <>
          <span className="blink" aria-hidden /> {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  )
}

export type ChipKind = 'executed' | 'held' | 'rejected' | 'flight' | 'stale' | 'refused' | 'hatch' | 'quiet'

const GLYPH: Record<ChipKind, string> = {
  executed: '✓',
  held: '○',
  rejected: '×',
  flight: '○',
  stale: '↻',
  refused: '×',
  hatch: '▨',
  quiet: '·',
}

export function Chip({ kind, children }: { kind: ChipKind; children: ReactNode }) {
  return (
    <span className={`chip ${kind}`}>
      <span aria-hidden>{GLYPH[kind]}</span>
      {children}
    </span>
  )
}

export function Micro({ children, tone }: { children: ReactNode; tone?: 'signal' | 'escalate' }) {
  return <div className={`micro ${tone ?? ''}`}>{children}</div>
}

export function PartyToken({
  role,
  id,
  showRole = true,
  compact,
  onClick,
  pressed,
}: {
  role: Role | null
  id: string
  showRole?: boolean
  /** Party hint only, for pickers and tight rows. The full id stays in the title. */
  compact?: boolean
  onClick?: () => void
  pressed?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const cls = `party ${role === 'agent' ? 'agent' : role === 'bank' ? 'bank' : role === 'outsider' ? 'outsider' : ''}`
  const inner = (
    <>
      <span className="sq" aria-hidden />
      {showRole && role && <span className="role">{role}</span>}
      <span className="pid">{copied ? 'copied' : compact ? id.split('::')[0] : partyId(id)}</span>
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={pressed} title={id}>
        {inner}
      </button>
    )
  }
  return (
    <span
      className={`${cls} copyable`}
      title={`${id}\nClick to copy`}
      onClick={() => {
        copy(id)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {inner}
    </span>
  )
}

export function CopyText({ text, children }: { text: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false)
  return (
    <span
      className="copyable"
      title={`${text}\nClick to copy`}
      onClick={() => {
        copy(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? 'copied' : children}
    </span>
  )
}

type BannerKind = 'allow' | 'escalate' | 'reject' | 'hatch' | 'info'
const BANNER_GLYPH: Record<BannerKind, string> = { allow: '✓', escalate: '▢', reject: '×', hatch: '▨', info: '■' }

export function Banner({ kind, title, children, glyph }: { kind: BannerKind; title: ReactNode; children?: ReactNode; glyph?: string }) {
  return (
    <div className={`banner ${kind}`} role={kind === 'reject' ? 'alert' : 'status'}>
      <span className="glyph" aria-hidden>
        {glyph ?? BANNER_GLYPH[kind]}
      </span>
      <div>
        <strong>{title}</strong> {children}
      </div>
    </div>
  )
}

export function AmountField({
  label,
  value,
  onChange,
  help,
  error,
  unit = 'UNITS',
  id,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  help?: ReactNode
  error?: ReactNode
  unit?: string
  id: string
}) {
  return (
    <div className="field">
      <label className="micro" htmlFor={id}>
        {label}
      </label>
      <div className={`amount ${error ? 'invalid' : ''}`}>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.\-]/g, ''))}
          aria-invalid={Boolean(error)}
        />
        <span className="unit">{unit}</span>
      </div>
      {error ? <div className="help error">× {error}</div> : help ? <div className="help">{help}</div> : null}
    </div>
  )
}

export function Meter({ value, max }: { value: number; max: number }) {
  const pct = max <= 0 ? 100 : Math.min(100, (value / max) * 100)
  return (
    <div className={`meter ${pct >= 100 ? 'full' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}
