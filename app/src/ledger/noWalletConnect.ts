/**
 * Stands in for `@walletconnect/sign-client`.
 *
 * The dApp SDK lists WalletConnect as an optional peer dependency but imports
 * it at the top of its entry module, so leaving it out breaks the import of
 * everything else, ExtensionAdapter included. Sentry uses only the extension
 * transport, so this satisfies the import and refuses loudly if WalletConnect
 * is ever actually reached. Wired up in vite.config.ts.
 */
export default {
  init(): never {
    throw new Error('WalletConnect is not bundled with Sentry. Connect with a browser-extension wallet.')
  },
}
