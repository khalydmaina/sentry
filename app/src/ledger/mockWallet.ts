/**
 * A stand-in CIP-0103 wallet, for development only.
 *
 * Grofty is MainNet-only and invitation-gated, so the wallet flow cannot be
 * exercised on LocalNet with a real extension. This mirrors the documented
 * contract as closely as a mock can, so the app's identity path is the real
 * one rather than a convenient fiction:
 *
 *   - `?wallet=mock` behaves like an extension built on Canton's dApp SDK:
 *     it announces `{ id, name, target }`, answers the READY/ACK handshake,
 *     and serves JSON-RPC over `window.postMessage`. The app reaches it
 *     through the SDK's own ExtensionAdapter, so that transport is exercised
 *     end to end.
 *   - `?wallet=mock-injected` is the older shape: a callable provider in the
 *     announcement and at `window.cantonWallet`.
 *   - `prepareExecuteAndWait` answers `{ tx: { payload: { updateId } } }`,
 *     an update id rather than a ledger transaction
 *   - `ledgerApi` is read-only and serves only the documented paths
 *   - refuses `actAs`, because a wallet submits only as its connected party
 *   - unknown methods fail with -32601, so fallbacks are exercised
 *
 * What it does NOT do is hold a key. It forwards to the local sandbox as the
 * founder's demo user, so it proves the plumbing and nothing about signing.
 *
 * Enabled only in a dev build, and only with one of those URL parameters.
 */

import { ledgerEnd, submit as submitAsUser, userParty, type Command, type Transaction } from './api'
import { ANNOUNCE_EVENT, INVALID_PARAMS, METHOD_UNSUPPORTED, REQUEST_EVENT } from './identity'

const INFO = { uuid: 'mock-cip0103-dev', name: 'Mock wallet (dev)', rdns: 'local.sentry.mock' }
/** The postMessage routing key, as an extension would use its runtime id. */
const TARGET = 'sentry-mock-wallet'

/** Stands in for someone reading the request and approving it in the extension. */
const APPROVAL_MS = 400

const fail = (code: number, message: string) => {
  throw { code, message }
}

/** Visible to headless tests so the disclosure path can actually be asserted. */
const mockLog: string[] = []

export function installMockWallet(transport: 'extension' | 'injected' = 'extension'): void {
  let party: string | null = null
  const submitted = new Map<string, Transaction>()

  // Deliberately NOT the demo owner. A real wallet arrives with its own party
  // owning nothing, and that is the path worth exercising.
  const whoami = async () => (party ??= await userParty('founder').catch(() => userParty('owner')))

  const provider = {
    async request({ method, params }: { method: string; params?: unknown }): Promise<unknown> {
      switch (method) {
        case 'connect':
        case 'isConnected':
          await whoami()
          return { isConnected: true }

        case 'getPrimaryAccount':
          return { partyId: await whoami(), hint: 'founder' }

        case 'listAccounts':
          return [{ partyId: await whoami(), hint: 'founder' }]

        case 'getActiveNetwork':
          return { networkId: 'canton:da-mainnet' }

        case 'disconnect':
          party = null
          return null

        case 'prepareExecuteAndWait': {
          const me = await whoami()
          const { commands, actAs } = (params ?? {}) as { commands?: Command[]; actAs?: string[] }
          // A wallet submits as itself. Refusing this here keeps the app honest.
          if (actAs) fail(INVALID_PARAMS, 'actAs is refused: a wallet submits only as the connected party.')
          const command = commands?.[0]
          if (!command) fail(INVALID_PARAMS, 'No command supplied.')
          // A real wallet submits through a validator that has never seen
          // Sentry's contracts, so exercising one without disclosing it would
          // fail there. Enforced here so the gap shows up on LocalNet instead.
          const { disclosedContracts } = (params ?? {}) as { disclosedContracts?: Array<Record<string, unknown>> }
          if ('ExerciseCommand' in command!) {
            const bad = (disclosedContracts ?? []).find((d) => !d.templateId || !d.contractId || !d.createdEventBlob || !d.synchronizerId)
            if (!disclosedContracts?.length) fail(INVALID_PARAMS, 'ExerciseCommand without disclosedContracts: this participant does not hold the contract.')
            if (bad) fail(INVALID_PARAMS, 'A disclosed contract is missing one of templateId, contractId, createdEventBlob, synchronizerId.')
            mockLog.push(`disclosed ${disclosedContracts!.length} contract(s)`)
          }
          await new Promise((r) => setTimeout(r, APPROVAL_MS))
          const tx = await submitAsUser('founder', me, command!)
          submitted.set(tx.updateId, tx)
          // The real provider also carries completionOffset on the payload.
          return { tx: { payload: { updateId: tx.updateId, completionOffset: 0 } } }
        }

        case 'ledgerApi': {
          const me = await whoami()
          // The documented envelope: { requestMethod, resource, body }. Anything
          // else is rejected so the app cannot drift back to a guessed shape.
          const { requestMethod, resource, body } = (params ?? {}) as {
            requestMethod?: string
            resource?: string
            body?: { updateId?: string; updateFormat?: Record<string, unknown> }
          }
          if (requestMethod !== undefined && requestMethod !== requestMethod.toLowerCase()) {
            fail(INVALID_PARAMS, 'requestMethod is lowercase, per CIP-0103.')
          }
          if (!resource) fail(INVALID_PARAMS, 'ledgerApi needs a resource, not a path.')
          switch (resource) {
            case '/v2/updates/update-by-id': {
              // The reader is scoped to the connected party, so a filter naming
              // anyone else is refused rather than quietly honoured.
              const shape = (body?.updateFormat as { includeTransactions?: { eventFormat?: { filtersByParty?: Record<string, unknown> } } } | undefined)
                ?.includeTransactions
              const parties = Object.keys(shape?.eventFormat?.filtersByParty ?? {})
              if (!parties.length) fail(INVALID_PARAMS, 'updateFormat.includeTransactions.eventFormat.filtersByParty is required.')
              if (parties.some((p) => p !== me)) fail(INVALID_PARAMS, 'ledgerApi reads are scoped to the connected party.')
              const id = body?.updateId
              const tx = id ? submitted.get(id) : undefined
              if (!tx) fail(METHOD_UNSUPPORTED, `No update ${id} readable by this party.`)
              return { transaction: tx }
            }
            case '/v2/state/ledger-end':
              return { offset: await ledgerEnd() }
            default:
              // The real reader serves a short allowlist and nothing else.
              return fail(METHOD_UNSUPPORTED, `ledgerApi does not serve ${resource}.`)
          }
        }

        default:
          return fail(METHOD_UNSUPPORTED, `Mock wallet does not implement ${method}.`)
      }
    },
  }

  ;(window as { __mockWalletLog?: string[] }).__mockWalletLog = mockLog

  if (transport === 'injected') {
    const announce = () => window.dispatchEvent(new CustomEvent(ANNOUNCE_EVENT, { detail: { info: INFO, provider } }))
    window.addEventListener(REQUEST_EVENT, announce)
    ;(window as { cantonWallet?: unknown }).cantonWallet = provider
    announce()
    return
  }

  // The dApp SDK's extension protocol. Messages are addressed by `target`, and
  // one aimed at a different extension is not ours to answer.
  window.addEventListener(REQUEST_EVENT, () =>
    window.dispatchEvent(new CustomEvent(ANNOUNCE_EVENT, { detail: { id: TARGET, name: INFO.name, target: TARGET } })),
  )
  window.addEventListener('message', async (event: MessageEvent) => {
    const m = event.data as { type?: string; target?: string; request?: { id?: string | number; method: string; params?: unknown } }
    if (event.source !== window || (m?.target && m.target !== TARGET)) return
    if (m?.type === 'SPLICE_WALLET_EXT_READY') {
      window.postMessage({ type: 'SPLICE_WALLET_EXT_ACK', target: TARGET }, '*')
      return
    }
    if (m?.type !== 'SPLICE_WALLET_REQUEST' || !m.request || m.request.id == null) return
    const { id, method, params } = m.request
    let response
    try {
      response = { jsonrpc: '2.0', id, result: await provider.request({ method, params }) }
    } catch (err) {
      const e = err as { code?: number; message?: string }
      response = { jsonrpc: '2.0', id, error: { code: e.code ?? -32603, message: e.message ?? String(err) } }
    }
    window.postMessage({ type: 'SPLICE_WALLET_RESPONSE', response }, '*')
  })
}
