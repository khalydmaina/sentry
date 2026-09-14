export function amount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** `Owner-9b3970be::1220b5bf…2aa7`: the hint in full, the namespace fingerprint shortened. */
export function partyId(id: string): string {
  const [hint, ns] = id.split('::')
  if (!ns) return id
  return `${hint}::${ns.slice(0, 8)}…${ns.slice(-4)}`
}

export function cid(id: string): string {
  return `#${id.slice(0, 8)}`
}

export function clock(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour12: false })
}

export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  return `${h}h ${String(m % 60).padStart(2, '0')}m`
}

export function windowLabel(ms: number): string {
  const s = ms / 1000
  if (s % 3600 === 0) return `${s / 3600}h`
  if (s % 60 === 0) return `${s / 60}m`
  return `${s}s`
}

export function copy(text: string) {
  void navigator.clipboard?.writeText(text)
}
