#!/usr/bin/env node
//
// The agent, as a program rather than a browser tab.
//
// This is the point of Sentry. An agent runs somewhere you do not control,
// holding its own credential, and the only thing it can do with the owner's
// funds is exercise RequestTransfer on a policy the owner signed. Every cap,
// every allowlist entry and every escalation is decided by the ledger when
// the command arrives, not by this file. Delete the checks here and nothing
// about what the agent can spend changes.
//
// Usage:
//   node agent/sentry-agent.mjs status
//   node agent/sentry-agent.mjs request --amount 40 --to merchant --memo "api credits"
//   node agent/sentry-agent.mjs probe
//
// Environment:
//   SENTRY_WALLET_API        wallet participant JSON API   (default http://localhost:6864)
//   SENTRY_COUNTERPARTY_API  counterparty participant API  (default http://localhost:7864)
//   SENTRY_AGENT_USER        the agent's ledger user       (default agent)
//   SENTRY_AGENT_TOKEN       bearer token, when the participant requires one

const WALLET = process.env.SENTRY_WALLET_API ?? 'http://localhost:6864'
const COUNTERPARTY = process.env.SENTRY_COUNTERPARTY_API ?? 'http://localhost:7864'
const AGENT_USER = process.env.SENTRY_AGENT_USER ?? 'agent'
const TOKEN = process.env.SENTRY_AGENT_TOKEN ?? null

const PKG = '#sentry'
const T = {
  holding: `${PKG}:Wallet.Holding:WalletHolding`,
  policy: `${PKG}:Wallet.Policy:WalletPolicy`,
}

class LedgerError extends Error {
  constructor(status, code, cause) {
    super(cause)
    this.status = status
    this.code = code
  }
}

async function call(base, method, path, body) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // A participant that is down answers with plain text.
  }
  if (!res.ok) throw new LedgerError(res.status, json?.code ?? `HTTP_${res.status}`, json?.cause ?? text)
  return json
}

const partyOfUser = async (base, user) => (await call(base, 'GET', `/v2/users/${encodeURIComponent(user)}`)).user.primaryParty

async function activeContracts(base, party) {
  const { offset } = await call(base, 'GET', '/v2/state/ledger-end')
  const rows = await call(base, 'POST', '/v2/state/active-contracts', {
    eventFormat: {
      filtersByParty: { [party]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } }] } },
      verbose: true,
    },
    activeAtOffset: offset,
  })
  return rows.map((r) => r?.contractEntry?.JsActiveContract?.createdEvent).filter(Boolean)
}

/** Submits as the agent. The participant decides whether this credential may. */
async function submit(command) {
  const party = await partyOfUser(WALLET, AGENT_USER)
  const r = await call(WALLET, 'POST', '/v2/commands/submit-and-wait-for-transaction', {
    commands: { commands: [command], commandId: crypto.randomUUID(), userId: AGENT_USER, actAs: [party] },
  })
  return r.transaction
}

const name = (p) => String(p).split('::')[0]
const dec = (n) => Number(n).toFixed(2)
const decimal = (n) => Number(n).toFixed(10)

/** The live policy delegating to this agent. */
async function currentPolicy() {
  const me = await partyOfUser(WALLET, AGENT_USER)
  const events = await activeContracts(WALLET, me)
  const policies = events
    .filter((e) => e.templateId.endsWith('WalletPolicy'))
    .filter((e) => e.createArgument.agent === me)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  if (!policies.length) throw new Error('No policy delegates to this agent. The owner has not signed one, or it was archived.')
  const holdings = events.filter((e) => e.templateId.endsWith('WalletHolding'))
  const p = policies[0]
  return { cid: p.contractId, a: p.createArgument, me, holding: holdings.find((h) => h.contractId === p.createArgument.holding) }
}

/** Resolves a counterparty: a full party id, or the name of a ledger user. */
async function resolveCounterparty(to) {
  if (to.includes('::')) return to
  for (const base of [COUNTERPARTY, WALLET]) {
    try {
      return await partyOfUser(base, to)
    } catch {
      // Try the other participant before giving up.
    }
  }
  throw new Error(`Could not resolve "${to}" to a party. Pass a full party id, or a ledger user name.`)
}

/** Sentry's vocabulary for what the ledger did, read from the events it returned. */
function outcomeOf(tx) {
  for (const e of tx.events) {
    const c = e.CreatedEvent
    if (!c) continue
    const t = c.templateId.split(':').pop()
    if (t === 'ExecutedTransfer') return { kind: 'executed', via: c.createArgument.via, amount: c.createArgument.amount }
    if (t === 'PendingApproval') return { kind: 'held', reasons: c.createArgument.reasons }
    if (t === 'RejectedTransfer') return { kind: 'rejected', reasons: c.createArgument.reasons }
  }
  return { kind: 'unknown' }
}

async function cmdStatus() {
  const { a, me, holding } = await currentPolicy()
  const windowMs = Number(a.windowLength.microseconds) / 1000
  const now = Date.now()
  const live = (a.recentSpends ?? []).filter((s) => now - new Date(s._1).getTime() < windowMs)
  const spent = live.reduce((t, s) => t + Number(s._2), 0)
  console.log(`agent          ${name(me)}`)
  console.log(`balance        ${holding ? dec(holding.createArgument.amount) : 'not visible'}`)
  console.log(`per-tx cap     ${dec(a.perTxCap)}`)
  console.log(`rolling cap    ${dec(spent)} of ${dec(a.dailyCap)} used, window ${Math.round(windowMs / 1000)}s`)
  console.log(`auto-approve   at or under ${dec(a.autoApproveThreshold)}`)
  console.log(`allowlist      ${(a.allowedCounterparties ?? []).map(name).join(', ') || '(empty)'}`)
}

async function cmdRequest({ amount, to, memo }) {
  if (!amount || !to) throw new Error('request needs --amount and --to')
  const { cid } = await currentPolicy()
  const counterparty = await resolveCounterparty(to)
  const tx = await submit({
    ExerciseCommand: {
      templateId: T.policy,
      contractId: cid,
      choice: 'RequestTransfer',
      choiceArgument: { amount: decimal(amount), counterparty, memo: memo ?? '' },
    },
  })
  const o = outcomeOf(tx)
  if (o.kind === 'executed') console.log(`EXECUTED   ${dec(amount)} to ${name(counterparty)}   (${o.via})`)
  else if (o.kind === 'held') console.log(`HELD       ${dec(amount)} to ${name(counterparty)}   waiting on the owner: ${o.reasons.join('; ')}`)
  else if (o.kind === 'rejected') console.log(`REJECTED   ${dec(amount)} to ${name(counterparty)}   ${o.reasons.join('; ')}`)
  else console.log('The ledger accepted the command but returned no outcome event.')
  process.exitCode = o.kind === 'executed' ? 0 : o.kind === 'held' ? 2 : 3
}

/**
 * What this credential cannot do.
 *
 * Each of these is a command the agent is free to send. The ledger refuses
 * them because the contracts give the agent exactly one choice, which is the
 * claim worth checking from outside the browser.
 */
async function cmdProbe() {
  const { cid, a, me, holding } = await currentPolicy()
  const attempts = [
    {
      what: 'move the holding directly',
      command: { ExerciseCommand: { templateId: T.holding, contractId: a.holding, choice: 'Transfer', choiceArgument: { to: me, qty: decimal(10) } } },
    },
    {
      what: 'spend as the owner',
      command: { ExerciseCommand: { templateId: T.policy, contractId: cid, choice: 'OwnerTransfer', choiceArgument: { to: me, qty: decimal(10), memo: 'probe' } } },
    },
    {
      what: 'raise its own caps',
      command: {
        ExerciseCommand: {
          templateId: T.policy,
          contractId: cid,
          choice: 'UpdatePolicy',
          choiceArgument: {
            newHolding: a.holding,
            newPerTxCap: decimal(1e9),
            newDailyCap: decimal(1e9),
            newAllowedCounterparties: [me],
            newAutoApproveThreshold: decimal(1e9),
            newWindowLength: a.windowLength,
          },
        },
      },
    },
    {
      what: 'mint itself a holding',
      command: {
        CreateCommand: {
          templateId: T.holding,
          createArguments: { issuer: a.issuer, owner: me, agent: me, amount: decimal(1e6) },
        },
      },
    },
  ]

  console.log(`Probing what ${name(me)} can do with a policy it is only an observer on.`)
  if (holding) console.log(`Balance before: ${dec(holding.createArgument.amount)}\n`)
  let refused = 0
  for (const { what, command } of attempts) {
    try {
      await submit(command)
      console.log(`ALLOWED    ${what}   <- this should not happen`)
    } catch (err) {
      refused++
      console.log(`REFUSED    ${what}`)
      console.log(`           ${err.code}`)
    }
  }
  const after = await currentPolicy()
  console.log(`\nBalance after:  ${after.holding ? dec(after.holding.createArgument.amount) : 'not visible'}`)
  console.log(`${refused} of ${attempts.length} refused by the ledger.`)
  process.exitCode = refused === attempts.length ? 0 : 1
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i]
    else out._.push(a)
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const [command] = args._

try {
  if (command === 'status') await cmdStatus()
  else if (command === 'request') await cmdRequest(args)
  else if (command === 'probe') await cmdProbe()
  else {
    console.log('Usage: sentry-agent <status|request|probe> [--amount N] [--to name|party] [--memo text]')
    process.exitCode = 1
  }
} catch (err) {
  console.error(err instanceof LedgerError ? `${err.code}: ${err.message}` : err.message)
  process.exitCode = 1
}
