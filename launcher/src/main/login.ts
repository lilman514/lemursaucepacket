// Interactive Microsoft sign-in in a dedicated window (OAuth2 authorization code + PKCE).

import { BrowserWindow, shell } from 'electron'
import { AuthError, buildAuthorizeUrl, createPkce } from '../core/auth'

export interface AuthCode {
  code: string
  verifier: string
}

export function interactiveMicrosoftLogin(parent: BrowserWindow | null, clientId: string, redirectUri: string): Promise<AuthCode> {
  const pkce = createPkce()
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 520,
      height: 700,
      parent: parent ?? undefined,
      modal: Boolean(parent),
      show: false,
      title: 'Sign in with Microsoft',
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
      webPreferences: { partition: 'persist:microsoft-login', sandbox: true, contextIsolation: true, nodeIntegration: false }
    })

    let settled = false
    const finish = (error: Error | null, result?: AuthCode): void => {
      if (settled) return
      settled = true
      win.webContents.session.webRequest.onBeforeRequest(null)
      if (!win.isDestroyed()) win.close()
      if (error) reject(error)
      else resolve(result!)
    }

    const handleRedirect = (url: string): boolean => {
      if (!url.startsWith(redirectUri)) return false
      const params = new URL(url).searchParams
      const error = params.get('error')
      const code = params.get('code')
      if (error) {
        finish(error === 'access_denied' ? new AuthError('CANCELLED', 'Sign-in was cancelled.') : new AuthError('UNKNOWN', params.get('error_description') ?? error))
      } else if (params.get('state') !== pkce.state) {
        finish(new AuthError('UNKNOWN', 'Sign-in response did not match this request. Please try again.'))
      } else if (!code) {
        finish(new AuthError('UNKNOWN', 'Microsoft did not return a sign-in code.'))
      } else {
        finish(null, { code, verifier: pkce.verifier })
      }
      return true
    }

    // Catch the final redirect however it happens (HTTP 302 or script navigation) and never load it.
    win.webContents.session.webRequest.onBeforeRequest({ urls: [`${redirectUri}*`] }, (details, callback) => {
      callback({ cancel: true })
      handleRedirect(details.url)
    })
    win.webContents.on('will-redirect', (event, url) => {
      if (handleRedirect(url)) event.preventDefault()
    })
    win.webContents.on('will-navigate', (event, url) => {
      if (handleRedirect(url)) event.preventDefault()
    })
    // "Help", "Privacy" and similar links open in the real browser.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url)
      return { action: 'deny' }
    })
    win.once('ready-to-show', () => win.show())
    win.on('closed', () => finish(new AuthError('CANCELLED', 'Sign-in window was closed.')))

    win.loadURL(buildAuthorizeUrl(clientId, redirectUri, pkce)).catch((e: Error) => {
      // Cancelling the redirect aborts the navigation; that's expected once we have the code.
      if (!settled && !/ERR_ABORTED|ERR_BLOCKED_BY_CLIENT/.test(e.message)) {
        finish(new AuthError('NETWORK', `Couldn't open the Microsoft sign-in page: ${e.message}`))
      }
    })
  })
}
