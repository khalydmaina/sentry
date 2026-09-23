/**
 * Shared control over the held queue.
 *
 * Releasing a held request is the owner's decision, and for a treasury that
 * decision should take more than one signature. The threshold lives in
 * BitSafe's `GovernanceRules`, which refuses to execute below it. Nothing here
 * counts confirmations, for the same reason nothing in the agent's client
 * checks a spending cap.
 *
 * Everything is read from the owner's own view: the owner signs the rules, the
 * proposals and, jointly with each confirmer, the confirmations. Members read
 * them by hosting the owner party on their participant, which is why every
 * member command carries `readAs` the owner.
 */

import { submit, type CreatedEvent, type Node, type Transaction } from './api'

const GOV = '#governance-core-v1'
export const GOVERNANCE_TEMPLATES = {
  rules: `${GOV}:Governance.Rules:GovernanceRules`,
  confirmation: `${GOV}:Governance.Confirmation:GovernanceConfirmation`,
  approval: '#sentry-governance:Wallet.Governed:GovernedApproval',
  rejection: '#sentry-governance:Wallet.Governed:GovernedRejection',
} as const

/** What a proposal would do if it reached its threshold. */
export type ProposalKind = 'release' | 'refusal'

/** A governance member, and the node that hosts it. */
export interface Member {
  role: string
  party: string
  node: Node
}

/**
 * Who the demo's members are. Each is hosted by a participant that also hosts
 * the owner, so two confirmations come from two independent nodes rather than
 * two keys on one.
 */
export const MEMBERS: Member[] = [
  { role: 'alice', party: '', node: 'wallet' },
  { role: 'bob', party: '', node: 'governance' },
]

export interface Rules {
  cid: string
  members: string[]
  threshold: number
}

export interface Proposal {
  cid: string
  kind: ProposalKind
  pending: string
  /** Only a release charges a policy; a refusal touches no funds. */
  freshPolicy: string | null
  proposer: string
  memo: string
}

export interface Confirmation {
  cid: string
  confirmer: string
  proposal: string
}

export interface GovernanceView {
  rules: Rules | null
  proposals: Proposal[]
  confirmations: Confirmation[]
}

const name = (t: string) => t.split(':').pop() ?? t

/** Decodes the governance contracts out of an owner's active-contract set. */
export function decodeGovernance(events: CreatedEvent[]): GovernanceView {
  const view: GovernanceView = { rules: null, proposals: [], confirmations: [] }
  for (const e of events) {
    const a = e.createArgument
    switch (name(e.templateId)) {
      case 'GovernanceRules': {
        // DA.Set is a record wrapping a map, so members arrive as pairs.
        const entries = ((a.members as { map?: Array<[string, unknown]> })?.map ?? []) as Array<[string, unknown]>
        view.rules = { cid: e.contractId, members: entries.map(([p]) => p), threshold: Number(a.threshold) }
        break
      }
      case 'GovernedApproval':
      case 'GovernedRejection':
        view.proposals.push({
          cid: e.contractId,
          kind: name(e.templateId) === 'GovernedApproval' ? 'release' : 'refusal',
          pending: String(a.pending),
          freshPolicy: a.freshPolicy === undefined ? null : String(a.freshPolicy),
          proposer: String(a.proposer),
          memo: String(a.memo),
        })
        break
      case 'GovernanceConfirmation':
        view.confirmations.push({
          cid: e.contractId,
          confirmer: String(a.confirmer),
          proposal: String(a.actionProposalCid),
        })
        break
    }
  }
  return view
}

/** The confirmations standing behind one proposal. */
export function confirmationsFor(view: GovernanceView, proposalCid: string): Confirmation[] {
  return view.confirmations.filter((c) => c.proposal === proposalCid)
}

export function proposalFor(view: GovernanceView, pendingCid: string): Proposal | null {
  return view.proposals.find((p) => p.pending === pendingCid) ?? null
}

/** The owner raises a proposal to release one held request. */
export async function proposeRelease(
  owner: string,
  proposer: string,
  pending: string,
  freshPolicy: string,
  memo: string,
): Promise<Transaction> {
  return submit('owner', owner, {
    CreateCommand: {
      templateId: GOVERNANCE_TEMPLATES.approval,
      createArguments: { owner, proposer, pending, freshPolicy, memo },
    },
  })
}

/**
 * A proposal to refuse one held request.
 *
 * Refusing is governed for the same reason releasing is: one member should not
 * be able to block a payment the others want released, any more than they
 * should be able to release one alone.
 */
export async function proposeRefusal(owner: string, proposer: string, pending: string, memo: string): Promise<Transaction> {
  return submit('owner', owner, {
    CreateCommand: {
      templateId: GOVERNANCE_TEMPLATES.rejection,
      createArguments: { owner, proposer, pending, memo },
    },
  })
}

/** A member confirms, from whichever participant hosts it. */
export async function confirmRelease(member: Member, owner: string, rules: string, proposal: string): Promise<Transaction> {
  return submit(
    member.role,
    member.party,
    {
      ExerciseCommand: {
        templateId: GOVERNANCE_TEMPLATES.rules,
        contractId: rules,
        choice: 'GovernanceRules_ConfirmAction',
        choiceArgument: { confirmer: member.party, actionProposalCid: proposal },
      },
    },
    member.node,
    [owner],
  )
}

/**
 * Executes the release. Refused by the contract below the threshold, which is
 * the behaviour worth showing rather than hiding behind a disabled button.
 */
export async function releaseApproved(
  member: Member,
  owner: string,
  rules: string,
  proposal: string,
  confirmations: string[],
): Promise<Transaction> {
  return submit(
    member.role,
    member.party,
    {
      ExerciseCommand: {
        templateId: GOVERNANCE_TEMPLATES.rules,
        contractId: rules,
        choice: 'GovernanceRules_ExecuteConfirmedAction',
        choiceArgument: { executor: member.party, actionProposalCid: proposal, confirmations },
      },
    },
    member.node,
    [owner],
  )
}
