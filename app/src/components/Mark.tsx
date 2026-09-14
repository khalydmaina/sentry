// The gate mark: a square body with a slot, and one detached block.
// Static logo is always "held" (block outside). "passed" puts the block in the slot.

type MarkState = 'logo' | 'held' | 'passed'

const BODY = 'M0 0H24V9H12V15H24V24H0V0Z'

export function Mark({ size = 24, state = 'logo', animate }: { size?: number; state?: MarkState; animate?: boolean }) {
  const body = state === 'logo' ? 'var(--signal)' : 'var(--bone)'
  const block = state === 'logo' ? 'var(--signal)' : state === 'passed' ? 'var(--signal)' : 'var(--escalate)'
  const cls = ['mark', animate && state === 'passed' ? 'anim-pass' : '', animate && state === 'held' ? 'anim-hold' : ''].filter(Boolean).join(' ')
  const passedStatic = state === 'passed' && !animate
  return (
    <svg className={cls} width={(size * 32) / 24} height={size} viewBox="0 0 32 24" aria-hidden>
      <path d={BODY} fill={body} />
      <rect className="block" x={passedStatic ? 17 : 26} y="9" width="6" height="6" fill={block} />
    </svg>
  )
}

export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="brand">
      <Mark size={size} />
      <span className="wordmark" style={{ fontSize: size }}>
        sentry
      </span>
    </span>
  )
}
