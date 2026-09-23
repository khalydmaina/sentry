/**
 * A stand-in CIP-0103 wallet, for development only.
 *
 * Grofty is MainNet-only and invitation-gated, so the wallet flow cannot be
 * exercised on LocalNet with a real extension. This mirrors the documented
 * contract as closely as a mock can, so the app's identity path is the real
 * one rather than a convenient fiction:
 *
 *   - announces itself on `canton:announceProvider` AND injects at
 *     `window.cantonWallet`, the two ways wallets are actually found
 *   - `prepareExecuteAndWait` answers `{ tx: { payload: { updateId } } }`,
 *     an update id rather than a ledger transaction
 *   - `ledgerApi` is read-only and serves only the documented paths
 *   - refuses `actAs`, because a wallet submits only as its connected party
 *   - unknown methods fail with -32601, so fallbacks are exercised
 *
 * What it does NOT do is hold a key. It forwards to the local sandbox as the
 * owner's demo user, so it proves the plumbing and nothing about signing.
 *
 * Enabled only in a dev build, and only with `?wallet=mock` in the URL.
 */

import { ledgerEnd, submit as submitAsUser, userParty, type Command, type Transaction } from './api'
import { ANNOUNCE_EVENT, INVALID_PARAMS, METHOD_UNSUPPORTED, REQUEST_EVENT } from './identity'

const INFO = { uuid: 'mock-cip0103-dev', name: 'Mock wallet (dev)', rdns: 'local.sentry.mock' }

/** Stands in for someone reading the request and approving it in the extension. */
const APPROVAL_MS = 400

const fail = (code: number, message: string) => {
  throw { code, message }
}

/** Visible to headless tests so the disclosure path can actually be asserted. */
const mockLog: string[] = []

export function installMockWallet(): void {
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

  const announce = () => window.dispatchEvent(new CustomEvent(ANNOUNCE_EVENT, { detail: { info: INFO, provider } }))
  window.addEventListener(REQUEST_EVENT, announce)
  ;(window as { cantonWallet?: unknown }).cantonWallet = provider
  ;(window as { __mockWalletLog?: string[] }).__mockWalletLog = mockLog
  announce()
}
