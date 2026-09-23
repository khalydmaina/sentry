/**
 * Who the app is acting as.
 *
 * Until now the browser simply asserted a role: `submit('owner', ...)` sent a
 * string and the sandbox believed it. That is fine against a local sandbox with
 * no auth, and useless to a real owner.
 *
 * This is the seam. A `Local` identity keeps the demo users working on
 * LocalNet. A `Wallet` identity comes from a CIP-0103 provider, where the party
 * id is whatever the wallet is logged in as and the signature is made by a key
 * the app never sees.
 *
 * CIP-0103 leaves provider announcement out of scope, so discovery follows the
 * EIP-6963 pattern that Canton wallets use in practice: the page asks, the
 * extension answers, and the page also listens in case the extension announced
 * itself before this code ran.
 */

import { submit as submitAsUser, type Command, type DisclosedContract, type Transaction } from './api'
import type { Role } from './sentry'

export const ANNOUNCE_EVENT = 'canton:announceProvider'
export const REQUEST_EVENT = 'canton:requestProvider'

/** CIP-0103 error codes a dApp is expected to handle by name. */
export const USER_REJECTED = 4001
export const UNAUTHORIZED = 4100
/** The method or ledger resource is not supported. Not the same as bad params. */
export const METHOD_UNSUPPORTED = -32601
export const INVALID_PARAMS = -32602
/** Internal error, which is also how an approval that timed out is reported. */
export const INTERNAL_ERROR = -32603

export class WalletError extends Error {
  readonly code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
  /** True when the person clicked reject, which is not a failure worth shouting about. */
  get rejected(): boolean {
    return this.code === USER_REJECTED
  }
  /** An approval left unanswered for three minutes arrives as an internal error, not a rejection. */
  get expired(): boolean {
    return this.code === INTERNAL_ERROR
  }
  /** The site is not connected, or the person is signed out of the wallet: reconnect. */
  get unauthorized(): boolean {
    return this.code === UNAUTHORIZED
  }
  /** This wallet does not implement the method, so a caller may try an older one. */
  get unsupported(): boolean {
    return this.code === METHOD_UNSUPPORTED
  }
}

interface Account {
  partyId: string
  hint?: string
}

interface Provider {
  request(args: { method: string; params?: unknown }): Promise<unknown>
}

export interface ProviderDetail {
  info: { uuid: string; name: string; icon?: string; rdns?: string }
  provider: Provider
}

const found = new Map<string, ProviderDetail>()

function remember(detail: ProviderDetail | undefined) {
  if (detail?.info?.uuid && detail.provider) found.set(detail.info.uuid, detail)
}

if (typeof window !== 'undefined') {
  window.addEventListener(ANNOUNCE_EVENT, (e) => remember((e as CustomEvent<ProviderDetail>).detail))
}

/**
 * Finds CIP-0103 wallets two ways, because wallets use both.
 *
 * The announcement handshake is the discoverable one and works for any number
 * of wallets. A wallet also injects itself at `window.cantonWallet`, and an
 * extension that loaded before this module would have announced to nobody, so
 * the injected object is checked as well. Whichever answers first wins; the
 * map is keyed so the same wallet found twice is still one entry.
 */
export async function discoverProviders(waitMs = 300): Promise<ProviderDetail[]> {
  if (typeof window === 'undefined') return []
  window.dispatchEvent(new Event(REQUEST_EVENT))
  await new Promise((r) => setTimeout(r, waitMs))

  const injected = (window as { cantonWallet?: Provider }).cantonWallet
  if (injected && typeof injected.request === 'function' && ![...found.values()].some((d) => d.provider === injected)) {
    remember({ info: { uuid: 'window.cantonWallet', name: 'Canton wallet' }, provider: injected })
  }
  return [...found.values()]
}

function asWalletError(err: unknown): WalletError {
  const e = err as { code?: number; message?: string }
  if (typeof e?.code === 'number') return new WalletError(e.code, e.message ?? 'The wallet refused the request.')
  return new WalletError(INTERNAL_ERROR, err instanceof Error ? err.message : 'The wallet did not answer.')
}

export interface Signer {
  (command: Command, disclosed?: DisclosedContract[]): Promise<Transaction>
  /** True when the submitting participant has not seen Sentry's contracts. */
  needsDisclosure?: boolean
}

export type Identity =
  | { kind: 'local'; role: Role; partyId: string; label: string; submit: Signer }
  | { kind: 'wallet'; wallet: string; partyId: string; label: string; submit: Signer }

/** The demo path: the sandbox trusts the role name, which is why it is local only. */
export function localIdentity(role: Role, partyId: string): Identity {
  return {
    kind: 'local',
    role,
    partyId,
    label: role,
    submit: (c) => submitAsUser(role, partyId, c),
  }
}

/**
 * Connects a CIP-0103 wallet and returns the identity it is logged in as.
 *
 * The party id comes from the wallet, not from us, and commands are submitted
 * through `prepareExecute`, so the signature is made by a key held in the
 * extension. Note that a wallet submits only as its own connected party:
 * `actAs` is refused, which is why nothing here passes one.
 */
export async function connectWallet(detail: ProviderDetail): Promise<Identity> {
  const { provider, info } = detail
  try {
    const conn = (await provider.request({ method: 'connect' })) as { isConnected?: boolean } | undefined
    if (conn && conn.isConnected === false) throw new WalletError(UNAUTHORIZED, 'The wallet did not authorise this site.')

    const account = (await provider.request({ method: 'getPrimaryAccount' })) as Account | null
    if (!account?.partyId) throw new WalletError(UNAUTHORIZED, 'The wallet returned no party.')

    return {
      kind: 'wallet',
      wallet: info.name,
      partyId: account.partyId,
      label: account.hint ?? account.partyId.split('::')[0],
      submit: walletSigner(provider),
    }
  } catch (err) {
    throw asWalletError(err)
  }
}


/** The CIP-0103 envelope for a generic Daml command. */
interface CommandEnvelope {
  commands: Command[]
  commandId: string
  disclosedContracts?: DisclosedContract[]
  synchronizerId?: string
  readAs?: string[]
}


/**
 * Submits and returns the update id.
 *
 * `prepareExecuteAndWait` is preferred because it answers directly.
 * `prepareExecute` resolves with nothing and reports the result separately,
 * so it is only a fallback for a wallet that lacks the former, which is
 * reported as -32601 and nothing else.
 */
function walletSigner(provider: Provider): Signer {
  // A wallet does not hand back a ledger transaction. It returns the update id
  // of what it submitted, so the events are read back through its own reader.
  const sign: Signer = async (command, disclosed) => {
    const updateId = await execute(provider, command, disclosed?.length ? { disclosedContracts: disclosed } : undefined)
    return readUpdate(provider, updateId)
  }
  sign.needsDisclosure = true
  return sign
}

async function execute(provider: Provider, command: Command, extra?: Partial<CommandEnvelope>): Promise<string> {
  const params: CommandEnvelope = { commands: [command], commandId: crypto.randomUUID(), ...extra }
  try {
    const r = (await provider.request({ method: 'prepareExecuteAndWait', params })) as { tx?: { payload?: { updateId?: string } } } | undefined
    const updateId = r?.tx?.payload?.updateId
    if (updateId) return updateId
    throw new WalletError(INTERNAL_ERROR, 'The wallet approved the command but returned no update id.')
  } catch (err) {
    const e = asWalletError(err)
    if (!e.unsupported) throw e
  }
  await provider.request({ method: 'prepareExecute', params })
  throw new WalletError(
    METHOD_UNSUPPORTED,
    'This wallet only supports prepareExecute, which reports results out of band. Sentry needs prepareExecuteAndWait.',
  )
}

/**
 * Reads a submitted update back through the wallet.
 *
 * `ledgerApi` is a narrow read-only reader scoped to the connected party,
 * which is enough: every command Sentry sends through a wallet is one the
 * connected party is a stakeholder on.
 */
async function readUpdate(provider: Provider, updateId: string): Promise<Transaction> {
  const r = (await provider.request({
    method: 'ledgerApi',
    params: { path: `/v2/updates/update-by-id`, method: 'POST', body: { updateId, updateFormat: { includeTransactions: { transactionShape: 'TRANSACTION_SHAPE_ACS_DELTA' } } } },
  })) as { transaction?: Transaction; update?: { Transaction?: { value?: Transaction } } } | undefined

  const tx = r?.transaction ?? r?.update?.Transaction?.value
  if (!tx) throw new WalletError(INTERNAL_ERROR, `The wallet submitted update ${updateId} but its events could not be read back.`)
  return tx
}

export async function disconnectWallet(detail: ProviderDetail): Promise<void> {
  try {
    await detail.provider.request({ method: 'disconnect' })
  } catch {
    // A wallet that does not implement disconnect is still disconnected for us.
  }
}
