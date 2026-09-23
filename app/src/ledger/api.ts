// Thin client for the Canton JSON Ledger API v2, proxied under /v2 by Vite.

export interface CreatedEvent {
  contractId: string
  templateId: string
  createArgument: Record<string, unknown>
  createdAt: string
  signatories: string[]
  observers: string[]
  offset: number
}

export interface Transaction {
  updateId: string
  effectiveAt: string
  events: Array<{ CreatedEvent?: CreatedEvent; ArchivedEvent?: { contractId: string; templateId: string } }>
}

export class LedgerError extends Error {
  readonly code: string
  readonly status: number
  constructor(status: number, code: string, cause: string) {
    super(cause)
    this.status = status
    this.code = code
  }
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new LedgerError(0, 'LEDGER_UNREACHABLE', 'The JSON Ledger API did not answer.')
  }
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // The Vite proxy answers with plain text when the ledger is down.
  }
  if (!res.ok) {
    const err = (json ?? {}) as { code?: string; cause?: string }
    if (res.status >= 500 && !err.code) throw new LedgerError(res.status, 'LEDGER_UNREACHABLE', 'The JSON Ledger API did not answer.')
    throw new LedgerError(res.status, err.code ?? `HTTP_${res.status}`, err.cause ?? text)
  }
  return json as T
}

/**
 * Which participant node to ask. Each node serves its own JSON Ledger API and
 * only ever holds contracts its own parties are stakeholders on.
 */
export const NODES = ['wallet', 'counterparty'] as const
export type Node = (typeof NODES)[number]

export const NODE_NAME: Record<Node, string> = { wallet: 'sandbox', counterparty: 'pebblebox' }
export const NODE_PORT: Record<Node, number> = { wallet: 6864, counterparty: 7864 }

/** Dev-server proxy prefix for a node. The wallet node is served at the root. */
function prefix(node: Node): string {
  return node === 'wallet' ? '' : `/${node}`
}

export async function userParty(userId: string, node: Node = 'wallet'): Promise<string> {
  const r = await call<{ user: { primaryParty: string } }>('GET', `${prefix(node)}/v2/users/${encodeURIComponent(userId)}`)
  return r.user.primaryParty
}

export async function ledgerEnd(node: Node = 'wallet'): Promise<number> {
  const r = await call<{ offset: number }>('GET', `${prefix(node)}/v2/state/ledger-end`)
  return r.offset
}

type AcsEntry = { contractEntry?: { JsActiveContract?: { createdEvent: CreatedEvent } } }

/**
 * Every active contract `party` is a stakeholder on, as that party sees it,
 * asked of one participant node. A node answers only from what it holds.
 */
export async function activeContracts(party: string, atOffset: number, node: Node = 'wallet'): Promise<CreatedEvent[]> {
  const r = await call<AcsEntry[]>('POST', `${prefix(node)}/v2/state/active-contracts`, {
    eventFormat: {
      filtersByParty: {
        [party]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } }] },
      },
      verbose: true,
    },
    activeAtOffset: atOffset,
  })
  return r.flatMap((e) => (e.contractEntry?.JsActiveContract ? [e.contractEntry.JsActiveContract.createdEvent] : []))
}

/**
 * A contract handed to another participant explicitly, because it does not
 * hold it. A wallet submits through its own validator, which has never seen
 * Sentry's contracts, so any command touching them must disclose them.
 *
 * All four fields are required. The blob is only returned when asked for, and
 * the synchronizer id sits on the ACS entry rather than on the created event.
 */
export interface DisclosedContract {
  templateId: string
  contractId: string
  createdEventBlob: string
  synchronizerId: string
}

/** Disclosure for specific contracts, as `party` sees them. */
export async function disclosureFor(party: string, contractIds: string[], node: Node = 'wallet'): Promise<DisclosedContract[]> {
  if (!contractIds.length) return []
  const wanted = new Set(contractIds)
  const at = await ledgerEnd(node)
  const r = await call<Array<{ contractEntry?: { JsActiveContract?: { createdEvent: CreatedEvent & { createdEventBlob?: string }; synchronizerId: string } } }>>(
    'POST',
    `${prefix(node)}/v2/state/active-contracts`,
    {
      eventFormat: {
        filtersByParty: { [party]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: true } } } }] } },
        verbose: true,
      },
      activeAtOffset: at,
    },
  )
  const out: DisclosedContract[] = []
  for (const row of r) {
    const entry = row.contractEntry?.JsActiveContract
    const e = entry?.createdEvent
    if (!entry || !e || !wanted.has(e.contractId) || !e.createdEventBlob) continue
    out.push({ templateId: e.templateId, contractId: e.contractId, createdEventBlob: e.createdEventBlob, synchronizerId: entry.synchronizerId })
  }
  return out
}

export type Command =
  | { CreateCommand: { templateId: string; createArguments: Record<string, unknown> } }
  | { ExerciseCommand: { templateId: string; contractId: string; choice: string; choiceArgument: Record<string, unknown> } }

/** Submits as `party`, acting through the ledger user of the same role. */
/**
 * Submits as `party` through the ledger user of the same role.
 *
 * A command must go to the participant that hosts the submitting party: the
 * bank is on the counterparty node, so minting there through the wallet node
 * fails with an unknown user.
 */
export async function submit(userId: string, party: string, command: Command, node: Node = 'wallet'): Promise<Transaction> {
  const r = await call<{ transaction: Transaction }>('POST', `${prefix(node)}/v2/commands/submit-and-wait-for-transaction`, {
    commands: { commands: [command], commandId: crypto.randomUUID(), userId, actAs: [party] },
  })
  return r.transaction
}
