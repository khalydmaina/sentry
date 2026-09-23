// Sentry's contracts as the frontend sees them: decoding, queries and commands.
// Template and choice names mirror main/daml/Wallet/*.daml exactly.

import { activeContracts, disclosureFor, ledgerEnd, LedgerError, submit, userParty, type CreatedEvent, type Node, type Transaction } from './api'
import type { Signer } from './identity'

export const ROLES = ['owner', 'agent', 'bank', 'merchant', 'stranger', 'outsider'] as const
export type Role = (typeof ROLES)[number]
export type Parties = Record<Role, string>

const PKG = '#sentry'
export const TEMPLATES = {
  holding: `${PKG}:Wallet.Holding:WalletHolding`,
  policy: `${PKG}:Wallet.Policy:WalletPolicy`,
  pending: `${PKG}:Wallet.Policy:PendingApproval`,
  executed: `${PKG}:Wallet.Records:ExecutedTransfer`,
  rejected: `${PKG}:Wallet.Records:RejectedTransfer`,
} as const

export type TemplateName = 'WalletHolding' | 'WalletPolicy' | 'PendingApproval' | 'ExecutedTransfer' | 'RejectedTransfer'
export const TEMPLATE_NAMES: TemplateName[] = ['WalletHolding', 'WalletPolicy', 'PendingApproval', 'ExecutedTransfer', 'RejectedTransfer']

export function templateName(templateId: string): string {
  return templateId.split(':').pop() ?? templateId
}

interface Meta {
  cid: string
  createdAt: Date
  signatories: string[]
  observers: string[]
}

export interface Holding extends Meta { issuer: string; owner: string; agent: string; amount: number }
export interface Spend { at: Date; amount: number }
export interface Policy extends Meta {
  owner: string
  agent: string
  issuer: string
  holding: string
  perTxCap: number
  dailyCap: number
  allowed: string[]
  autoApproveThreshold: number
  windowMs: number
  recentSpends: Spend[]
}
export interface Pending extends Meta { owner: string; agent: string; counterparty: string; amount: number; memo: string; reasons: string[]; requestedAt: Date }
export type ExecutionPath = 'AutoApproved' | 'OwnerApproved' | 'OwnerDirect'
export type RejectionPath = 'AutoRejected' | 'OwnerRejected'
export interface Executed extends Meta { owner: string; agent: string; counterparty: string; amount: number; memo: string; via: ExecutionPath; at: Date }
export interface Rejected extends Meta { owner: string; agent: string; counterparty: string; amount: number; memo: string; reasons: string[]; via: RejectionPath; at: Date }

export interface View {
  raw: CreatedEvent[]
  holdings: Holding[]
  policies: Policy[]
  pending: Pending[]
  executed: Executed[]
  rejected: Rejected[]
}

const str = (v: unknown) => String(v)
const dec = (v: unknown) => Number(v)

function meta(e: CreatedEvent): Meta {
  return { cid: e.contractId, createdAt: new Date(e.createdAt), signatories: e.signatories, observers: e.observers }
}

export function decodeView(events: CreatedEvent[]): View {
  const view: View = { raw: events, holdings: [], policies: [], pending: [], executed: [], rejected: [] }
  for (const e of events) {
    const a = e.createArgument
    switch (templateName(e.templateId)) {
      case 'WalletHolding':
        view.holdings.push({ ...meta(e), issuer: str(a.issuer), owner: str(a.owner), agent: str(a.agent), amount: dec(a.amount) })
        break
      case 'WalletPolicy':
        view.policies.push({
          ...meta(e),
          owner: str(a.owner),
          agent: str(a.agent),
          issuer: str(a.issuer),
          holding: str(a.holding),
          perTxCap: dec(a.perTxCap),
          dailyCap: dec(a.dailyCap),
          allowed: (a.allowedCounterparties as string[]) ?? [],
          autoApproveThreshold: dec(a.autoApproveThreshold),
          windowMs: Number((a.windowLength as { microseconds: string }).microseconds) / 1000,
          recentSpends: ((a.recentSpends as Array<{ _1: string; _2: string }>) ?? []).map((s) => ({ at: new Date(s._1), amount: dec(s._2) })),
        })
        break
      case 'PendingApproval':
        view.pending.push({
          ...meta(e),
          owner: str(a.owner),
          agent: str(a.agent),
          counterparty: str(a.counterparty),
          amount: dec(a.amount),
          memo: str(a.memo),
          reasons: (a.reasons as string[]) ?? [],
          requestedAt: new Date(str(a.requestedAt)),
        })
        break
      case 'ExecutedTransfer':
        view.executed.push({
          ...meta(e),
          owner: str(a.owner),
          agent: str(a.agent),
          counterparty: str(a.counterparty),
          amount: dec(a.amount),
          memo: str(a.memo),
          via: str(a.via) as ExecutionPath,
          at: new Date(str(a.executedAt)),
        })
        break
      case 'RejectedTransfer':
        view.rejected.push({
          ...meta(e),
          owner: str(a.owner),
          agent: str(a.agent),
          counterparty: str(a.counterparty),
          amount: dec(a.amount),
          memo: str(a.memo),
          reasons: (a.reasons as string[]) ?? [],
          via: str(a.via) as RejectionPath,
          at: new Date(str(a.rejectedAt)),
        })
        break
    }
  }
  return view
}

/**
 * Which participant node hosts each role. The wallet node holds the owner and
 * the agent; every other party is hosted by the counterparty node, so their
 * contracts arrive over the synchronizer or not at all.
 */
export const ROLE_NODE: Record<Role, Node> = {
  owner: 'wallet',
  agent: 'wallet',
  bank: 'counterparty',
  merchant: 'counterparty',
  stranger: 'counterparty',
  outsider: 'counterparty',
}

/**
 * Which demo roles each node hosts as their primary participant. The owner is
 * additionally hosted by the governance node, which is a topology fact rather
 * than a change of home, so it is not listed twice here.
 */
export const ROLES_ON: Record<Node, Role[]> = {
  wallet: ROLES.filter((r) => ROLE_NODE[r] === 'wallet'),
  counterparty: ROLES.filter((r) => ROLE_NODE[r] === 'counterparty'),
  governance: [],
}

export async function loadParties(): Promise<Parties> {
  const ids = await Promise.all(ROLES.map((r) => userParty(r, ROLE_NODE[r])))
  return Object.fromEntries(ROLES.map((r, i) => [r, ids[i]])) as Parties
}

export async function loadView(party: string, offset?: number, node: Node = 'wallet'): Promise<View> {
  const at = offset ?? (await ledgerEnd(node))
  return decodeView(await activeContracts(party, at, node))
}

/** Each participant keeps its own offsets, so a node is always asked at its own end. */
export async function ledgerEndOf(node: Node): Promise<number> {
  return ledgerEnd(node)
}

/** Asks a role's own node, at that node's own ledger offset. */
export async function loadRoleView(role: Role): Promise<View> {
  const node = ROLE_NODE[role]
  const party = await userParty(role, node)
  return loadView(party, await ledgerEnd(node), node)
}

/** The live policy between this owner and the agent, newest first if several exist. */
export function walletPolicy(view: View, ownerParty: string, agentParty: string): Policy | null {
  const mine = view.policies.filter((p) => p.owner === ownerParty && p.agent === agentParty)
  mine.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return mine[0] ?? null
}

export function liveSpends(policy: Policy, now = Date.now()): Spend[] {
  return policy.recentSpends.filter((s) => now - s.at.getTime() < policy.windowMs)
}

export function windowTotal(policy: Policy, now = Date.now()): number {
  return liveSpends(policy, now).reduce((sum, s) => sum + s.amount, 0)
}

/** Mirrors RequestTransfer's checks so the console can preview. The ledger decides. */
export function preview(policy: Policy, balance: number, amount: number, counterparty: string, now = Date.now()) {
  const total = windowTotal(policy, now)
  const positive = amount > 0
  const funded = amount <= balance
  const listed = policy.allowed.includes(counterparty)
  const underPerTx = amount <= policy.perTxCap
  const underWindow = total + amount <= policy.dailyCap
  const underThreshold = amount <= policy.autoApproveThreshold
  let expect: 'refused' | 'rejected' | 'held' | 'executed'
  if (!positive) expect = 'refused'
  else if (!funded) expect = 'rejected'
  else if (listed && underPerTx && underWindow && underThreshold) expect = 'executed'
  else expect = 'held'
  return { positive, funded, listed, underPerTx, underWindow, underThreshold, total, expect }
}

export type Outcome =
  | { kind: 'executed'; record: Executed }
  | { kind: 'held'; pending: Pending }
  | { kind: 'rejected'; record: Rejected }

export function outcomeOf(tx: Transaction): Outcome | null {
  const created = tx.events.flatMap((e) => (e.CreatedEvent ? [e.CreatedEvent] : []))
  const view = decodeView(created)
  if (view.executed[0]) return { kind: 'executed', record: view.executed[0] }
  if (view.pending[0]) return { kind: 'held', pending: view.pending[0] }
  if (view.rejected[0]) return { kind: 'rejected', record: view.rejected[0] }
  return null
}

const decimal = (n: number) => n.toFixed(10)
const micros = (ms: number) => ({ microseconds: String(Math.round(ms * 1000)) })

export interface WalletTerms {
  startingBalance: number
  perTxCap: number
  dailyCap: number
  autoApproveThreshold: number
  windowMs: number
  allowed: string[]
}

/**
 * How a command reaches the ledger on the owner's behalf.
 *
 * The default sends it as the sandbox's `owner` demo user, which is only
 * honest on a local ledger with no auth. When a CIP-0103 wallet is connected
 * the app passes that wallet's submit instead, so the signature is made by a
 * key this app never holds.
 */
const asOwner = (parties: Parties): Signer => (command) => submit('owner', parties.owner, command)

/**
 * Whose wallet this is. A connected wallet supplies its own party, which owns
 * nothing until the issuer mints for it, so the owner is a parameter rather
 * than a fixed demo role.
 */
export type OwnerParty = string

/**
 * Contracts a command needs the submitting participant to know about.
 * Only gathered for a signer that says it needs them, since it costs a query
 * and the local sandbox already holds everything.
 */
async function disclose(sign: Signer, party: string, contractIds: Array<string | undefined>) {
  if (!sign.needsDisclosure) return undefined
  return disclosureFor(party, contractIds.filter((c): c is string => !!c))
}

/** Two transactions, two signers: Bank mints the holding, then the owner signs the policy. */
export async function mintHolding(parties: Parties, amount: number, ownerParty: OwnerParty = parties.owner): Promise<string> {
  // The bank is hosted by the counterparty node, so the mint is submitted there.
  const tx = await submit(
    'bank',
    parties.bank,
    {
      CreateCommand: {
        templateId: TEMPLATES.holding,
        createArguments: { issuer: parties.bank, owner: ownerParty, agent: parties.agent, amount: decimal(amount) },
      },
    },
    ROLE_NODE.bank,
  )
  return tx.events.find((e) => e.CreatedEvent)!.CreatedEvent!.contractId
}

export async function signPolicy(parties: Parties, holding: string, terms: WalletTerms, sign: Signer = asOwner(parties), ownerParty: OwnerParty = parties.owner): Promise<string> {
  const tx = await sign({
    CreateCommand: {
      templateId: TEMPLATES.policy,
      createArguments: {
        owner: ownerParty,
        agent: parties.agent,
        issuer: parties.bank,
        holding,
        perTxCap: decimal(terms.perTxCap),
        dailyCap: decimal(terms.dailyCap),
        allowedCounterparties: terms.allowed,
        autoApproveThreshold: decimal(terms.autoApproveThreshold),
        windowLength: micros(terms.windowMs),
        recentSpends: [],
      },
    },
  })
  return tx.events.find((e) => e.CreatedEvent)!.CreatedEvent!.contractId
}

export async function requestTransfer(parties: Parties, policyCid: string, amount: number, counterparty: string, memo: string) {
  const tx = await submit('agent', parties.agent, {
    ExerciseCommand: {
      templateId: TEMPLATES.policy,
      contractId: policyCid,
      choice: 'RequestTransfer',
      choiceArgument: { amount: decimal(amount), counterparty, memo },
    },
  })
  return outcomeOf(tx)
}

async function freshPolicy(parties: Parties, ownerParty: OwnerParty = parties.owner): Promise<Policy> {
  const policy = walletPolicy(await loadView(ownerParty), ownerParty, parties.agent)
  if (!policy) throw new LedgerError(404, 'NO_POLICY', 'No live WalletPolicy for this owner and agent.')
  return policy
}

/** Looks the policy up immediately before the call: every spend replaces it. */
export async function approve(parties: Parties, pendingCid: string, sign: Signer = asOwner(parties), ownerParty: OwnerParty = parties.owner) {
  const policy = await freshPolicy(parties, ownerParty)
  // Approve reads the policy and its holding, so all three must be disclosed.
  const disclosed = await disclose(sign, ownerParty, [pendingCid, policy.cid, policy.holding])
  const tx = await sign(
    { ExerciseCommand: { templateId: TEMPLATES.pending, contractId: pendingCid, choice: 'Approve', choiceArgument: { freshPolicy: policy.cid } } },
    disclosed,
  )
  return outcomeOf(tx)
}

export async function reject(parties: Parties, pendingCid: string, sign: Signer = asOwner(parties), ownerParty: OwnerParty = parties.owner) {
  const disclosed = await disclose(sign, ownerParty, [pendingCid])
  const tx = await sign({ ExerciseCommand: { templateId: TEMPLATES.pending, contractId: pendingCid, choice: 'Reject', choiceArgument: {} } }, disclosed)
  return outcomeOf(tx)
}

export async function updatePolicy(parties: Parties, changes: Omit<WalletTerms, 'startingBalance'>, sign: Signer = asOwner(parties), ownerParty: OwnerParty = parties.owner) {
  const policy = await freshPolicy(parties, ownerParty)
  const disclosed = await disclose(sign, ownerParty, [policy.cid, policy.holding])
  await sign(
    {
    ExerciseCommand: {
      templateId: TEMPLATES.policy,
      contractId: policy.cid,
      choice: 'UpdatePolicy',
      choiceArgument: {
        newHolding: policy.holding,
        newPerTxCap: decimal(changes.perTxCap),
        newDailyCap: decimal(changes.dailyCap),
        newAllowedCounterparties: changes.allowed,
        newAutoApproveThreshold: decimal(changes.autoApproveThreshold),
        newWindowLength: micros(changes.windowMs),
      },
    },
    },
    disclosed,
  )
}

export async function ownerTransfer(
  parties: Parties,
  to: string,
  qty: number,
  memo: string,
  sign: Signer = asOwner(parties),
  ownerParty: OwnerParty = parties.owner,
) {
  const policy = await freshPolicy(parties, ownerParty)
  const disclosed = await disclose(sign, ownerParty, [policy.cid, policy.holding])
  const tx = await sign(
    { ExerciseCommand: { templateId: TEMPLATES.policy, contractId: policy.cid, choice: 'OwnerTransfer', choiceArgument: { to, qty: decimal(qty), memo } } },
    disclosed,
  )
  return outcomeOf(tx)
}

const STALE_CODES = ['CONTRACT_NOT_FOUND', 'LOCAL_VERDICT_LOCKED_CONTRACTS', 'LOCAL_VERDICT_INACTIVE_CONTRACTS', 'INCONSISTENT_CONTRACTS', 'ABORTED_DUE_TO_SHUTDOWN']

/** A command aimed at a policy or holding that another transaction already replaced. */
export function isStale(err: unknown): boolean {
  if (!(err instanceof LedgerError)) return false
  return STALE_CODES.includes(err.code) || /locked|inactive|could not be found/i.test(err.message)
}

/** The ledger's own words for why it refused, without the submission context. */
export function refusalText(err: unknown): string {
  if (!(err instanceof LedgerError)) return String(err)
  const msg = err.message
  const assertion = msg.match(/AssertionFailed[^:]*:[^:]*:\s*(.+)$/)
  if (assertion) return assertion[1]
  return msg
    .replace(/^Interpretation error: Error:\s*/, '')
    .replace(/^node NodeId\(\d+\) \(([^)]+)\)/, (_, t: string) => templateName(t))
    .replace(/([A-Za-z0-9_-]+)::1220[0-9a-f]{64}/g, '$1')
    .replace(/\b(00[0-9a-f]{8})[0-9a-f]{60,}\b/g, '#$1')
}

export interface Attempt {
  id: string
  what: string
  choice: string
  run: (parties: Parties, policy: Policy, pending: Pending | undefined) => Promise<Transaction>
  needsPending?: boolean
}

/** Things an agent might try instead of RequestTransfer. Each is sent to the ledger as the agent. */
export const ATTEMPTS: Attempt[] = [
  {
    id: 'transfer',
    what: 'Move the holding to itself',
    choice: 'WalletHolding.Transfer',
    run: (p, policy) =>
      submit('agent', p.agent, { ExerciseCommand: { templateId: TEMPLATES.holding, contractId: policy.holding, choice: 'Transfer', choiceArgument: { to: p.agent, qty: decimal(10) } } }),
  },
  {
    id: 'raise',
    what: 'Raise its own caps',
    choice: 'WalletPolicy.UpdatePolicy',
    run: (p, policy) =>
      submit('agent', p.agent, {
        ExerciseCommand: {
          templateId: TEMPLATES.policy,
          contractId: policy.cid,
          choice: 'UpdatePolicy',
          choiceArgument: {
            newHolding: policy.holding,
            newPerTxCap: decimal(1_000_000),
            newDailyCap: decimal(1_000_000),
            newAllowedCounterparties: [...policy.allowed, p.agent],
            newAutoApproveThreshold: decimal(1_000_000),
            newWindowLength: micros(policy.windowMs),
          },
        },
      }),
  },
  {
    id: 'pay-direct',
    what: 'Pay like the owner does',
    choice: 'WalletPolicy.OwnerTransfer',
    run: (p, policy) =>
      submit('agent', p.agent, { ExerciseCommand: { templateId: TEMPLATES.policy, contractId: policy.cid, choice: 'OwnerTransfer', choiceArgument: { to: p.agent, qty: decimal(10), memo: 'bypass' } } }),
  },
  {
    id: 'self-approve',
    what: 'Approve its own held request',
    choice: 'PendingApproval.Approve',
    needsPending: true,
    run: (p, policy, pending) =>
      submit('agent', p.agent, { ExerciseCommand: { templateId: TEMPLATES.pending, contractId: pending!.cid, choice: 'Approve', choiceArgument: { freshPolicy: policy.cid } } }),
  },
  {
    id: 'archive',
    what: 'Archive the policy',
    choice: 'WalletPolicy.Archive',
    run: (p, policy) => submit('agent', p.agent, { ExerciseCommand: { templateId: TEMPLATES.policy, contractId: policy.cid, choice: 'Archive', choiceArgument: {} } }),
  },
  {
    id: 'forge',
    what: 'Write an ExecutedTransfer record',
    choice: 'create ExecutedTransfer',
    run: (p) =>
      submit('agent', p.agent, {
        CreateCommand: {
          templateId: TEMPLATES.executed,
          createArguments: { owner: p.owner, agent: p.agent, counterparty: p.agent, amount: decimal(10), memo: 'forged', via: 'AutoApproved', executedAt: new Date().toISOString() },
        },
      }),
  },
  {
    id: 'mint',
    what: 'Mint itself a holding',
    choice: 'create WalletHolding',
    run: (p) =>
      submit('agent', p.agent, {
        CreateCommand: { templateId: TEMPLATES.holding, createArguments: { issuer: p.bank, owner: p.agent, agent: p.agent, amount: decimal(1_000_000) } },
      }),
  },
]
