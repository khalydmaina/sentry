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

export async function userParty(userId: string): Promise<string> {
  const r = await call<{ user: { primaryParty: string } }>('GET', `/v2/users/${encodeURIComponent(userId)}`)
  return r.user.primaryParty
}

export async function ledgerEnd(): Promise<number> {
  const r = await call<{ offset: number }>('GET', '/v2/state/ledger-end')
  return r.offset
}

type AcsEntry = { contractEntry?: { JsActiveContract?: { createdEvent: CreatedEvent } } }

/** Every active contract `party` is a stakeholder on, as that party sees it. */
export async function activeContracts(party: string, atOffset: number): Promise<CreatedEvent[]> {
  const r = await call<AcsEntry[]>('POST', '/v2/state/active-contracts', {
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

export type Command =
  | { CreateCommand: { templateId: string; createArguments: Record<string, unknown> } }
  | { ExerciseCommand: { templateId: string; contractId: string; choice: string; choiceArgument: Record<string, unknown> } }

/** Submits as `party`, acting through the ledger user of the same role. */
export async function submit(userId: string, party: string, command: Command): Promise<Transaction> {
  const r = await call<{ transaction: Transaction }>('POST', '/v2/commands/submit-and-wait-for-transaction', {
    commands: { commands: [command], commandId: crypto.randomUUID(), userId, actAs: [party] },
  })
  return r.transaction
}
