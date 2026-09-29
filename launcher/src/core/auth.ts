// Microsoft account → Xbox Live → XSTS → Minecraft token chain.
// https://minecraft.wiki/w/Microsoft_authentication
// The interactive sign-in window lives in the main process; this file is plain HTTP.
//
// Two ways to get the Microsoft token at the start of the chain:
//   'azure'  your own Azure app (brand.json → microsoft.clientId). Needs Mojang's approval
//            (https://aka.ms/mce-reviewappid) before Minecraft accepts it.
//   'live'   Microsoft's own client for Minecraft (the Nintendo Switch edition) through a device code:
//            the player opens microsoft.com/link and approves. No app registration or approval needed;
//            it's the default in open-source tools such as Mineflayer (prismarine-auth). It isn't this
//            launcher's own registration, so Microsoft could restrict it at any time.

import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign, type KeyObject } from 'node:crypto'
import { CancelledError, HttpError, request, sleep } from './http'

const AUTHORIZE_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize'
const TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
const SCOPE = 'XboxLive.signin offline_access'

export type SignInFlow = 'azure' | 'live'

/** Microsoft's client ID for Minecraft for Nintendo Switch. */
export const MINECRAFT_LIVE_CLIENT_ID = '00000000441cc96b'
const LIVE_SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL'
export const LIVE_ENDPOINTS = {
  deviceCode: 'https://login.live.com/oauth20_connect.srf',
  token: 'https://login.live.com/oauth20_token.srf'
}

export type AuthErrorCode =
  | 'CANCELLED'
  | 'MS_REAUTH'
  | 'NO_XBOX_ACCOUNT'
  | 'CHILD_ACCOUNT'
  | 'XBOX_BANNED'
  | 'REGION'
  | 'ADULT_VERIFICATION'
  | 'APP_NOT_APPROVED'
  | 'NO_PROFILE'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'UNKNOWN'

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export interface Pkce {
  verifier: string
  challenge: string
  state: string
}

export function createPkce(): Pkce {
  const verifier = randomBytes(32).toString('base64url')
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
    state: randomBytes(16).toString('hex')
  }
}

export function buildAuthorizeUrl(clientId: string, redirectUri: string, pkce: Pkce): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPE,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    state: pkce.state,
    prompt: 'select_account'
  })
  return `${AUTHORIZE_URL}?${params}`
}

export interface MicrosoftTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

async function tokenRequest(form: Record<string, string>, url = TOKEN_URL): Promise<MicrosoftTokens> {
  let res: Response
  try {
    res = await request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString()
    })
  } catch (e) {
    throw new AuthError('NETWORK', `Couldn't reach Microsoft: ${(e as Error).message}`)
  }
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!res.ok || !body.access_token) {
    if (body.error === 'invalid_grant') throw new AuthError('MS_REAUTH', 'Your Microsoft sign-in expired. Please sign in again.')
    throw new AuthError('UNKNOWN', `Microsoft sign-in failed: ${body.error_description?.split('\r\n')[0] ?? body.error ?? res.status}`)
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? form.refresh_token ?? '',
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000
  }
}

export function exchangeAuthCode(clientId: string, redirectUri: string, code: string, verifier: string): Promise<MicrosoftTokens> {
  return tokenRequest({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier, scope: SCOPE })
}

export function refreshMicrosoftToken(clientId: string, refreshToken: string): Promise<MicrosoftTokens> {
  return tokenRequest({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken, scope: SCOPE })
}

// ---------------------------------------------------------------- 'live' flow (device code)

export interface DeviceCode {
  /** What the player types at `verificationUri` (e.g. "ABCD-EFGH"). */
  userCode: string
  verificationUri: string
  /** Same page with the code already filled in. */
  verificationUriComplete: string
  expiresAt: number
  deviceCode: string
  intervalMs: number
  /** login.live.com ties the polling requests to the code request with a cookie. */
  cookie?: string
}

export async function requestDeviceCode(endpoints = LIVE_ENDPOINTS): Promise<DeviceCode> {
  let res: Response
  try {
    res = await request(endpoints.deviceCode, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: MINECRAFT_LIVE_CLIENT_ID, scope: LIVE_SCOPE, response_type: 'device_code' }).toString()
    })
  } catch (e) {
    throw new AuthError('NETWORK', `Couldn't reach Microsoft: ${(e as Error).message}`)
  }
  const body = (await res.json().catch(() => ({}))) as {
    user_code?: string
    device_code?: string
    verification_uri?: string
    interval?: number
    expires_in?: number
  }
  if (!res.ok || !body.user_code || !body.device_code) throw new AuthError('UNKNOWN', `Microsoft didn't issue a sign-in code (HTTP ${res.status}).`)
  const verificationUri = body.verification_uri ?? 'https://www.microsoft.com/link'
  return {
    userCode: body.user_code,
    verificationUri,
    verificationUriComplete: `${verificationUri}?otc=${encodeURIComponent(body.user_code)}`,
    expiresAt: Date.now() + (body.expires_in ?? 900) * 1000,
    deviceCode: body.device_code,
    intervalMs: Math.max(0.05, body.interval ?? 5) * 1000,
    cookie: res.headers.get('set-cookie')?.split(';')[0]
  }
}

/** Polls until the player approves the code at microsoft.com/link. Throws CancelledError when `signal` aborts. */
export async function waitForDeviceCode(code: DeviceCode, signal?: AbortSignal, endpoints = LIVE_ENDPOINTS): Promise<MicrosoftTokens> {
  let interval = code.intervalMs
  let networkFailures = 0
  while (Date.now() < code.expiresAt) {
    if (signal?.aborted) throw new CancelledError()
    await sleep(interval, signal)
    let res: Response
    try {
      res = await request(`${endpoints.token}?client_id=${MINECRAFT_LIVE_CLIENT_ID}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...(code.cookie ? { cookie: code.cookie } : {}) },
        body: new URLSearchParams({
          client_id: MINECRAFT_LIVE_CLIENT_ID,
          device_code: code.deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        }).toString(),
        signal
      })
    } catch (e) {
      if (signal?.aborted) throw new CancelledError()
      // A dropped request while the player is still signing in isn't fatal; give up after a few in a row.
      if (++networkFailures >= 5) throw new AuthError('NETWORK', `Couldn't reach Microsoft: ${(e as Error).message}`)
      continue
    }
    networkFailures = 0
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      error?: string
      error_description?: string
    }
    if (body.access_token) {
      return { accessToken: body.access_token, refreshToken: body.refresh_token ?? '', expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 }
    }
    if (body.error === 'authorization_pending') continue
    if (body.error === 'slow_down') {
      interval += 5000
      continue
    }
    if (body.error === 'authorization_declined' || body.error === 'access_denied') throw new AuthError('CANCELLED', 'Sign-in was cancelled.')
    if (body.error === 'expired_token' || body.error === 'bad_verification_code') break
    throw new AuthError('UNKNOWN', `Microsoft sign-in failed: ${body.error_description ?? body.error ?? res.status}`)
  }
  throw new AuthError('CANCELLED', 'The sign-in code expired. Please try again.')
}

export function refreshLiveToken(refreshToken: string, endpoints = LIVE_ENDPOINTS): Promise<MicrosoftTokens> {
  return tokenRequest(
    { client_id: MINECRAFT_LIVE_CLIENT_ID, grant_type: 'refresh_token', refresh_token: refreshToken, scope: LIVE_SCOPE },
    endpoints.token
  )
}

export interface MinecraftSession {
  accessToken: string
  expiresAt: number
  profile: { id: string; name: string }
}

const XSTS_ERRORS: Record<string, [AuthErrorCode, string]> = {
  '2148916227': ['XBOX_BANNED', 'This account is banned from Xbox services.'],
  '2148916233': ['NO_XBOX_ACCOUNT', "This Microsoft account doesn't have an Xbox profile yet. Sign in once at xbox.com to create one, then try again."],
  '2148916235': ['REGION', "Xbox Live isn't available in your country or region."],
  '2148916236': ['ADULT_VERIFICATION', 'This account needs adult verification on xbox.com before it can play.'],
  '2148916237': ['ADULT_VERIFICATION', 'This account needs adult verification on xbox.com before it can play.'],
  '2148916238': ['CHILD_ACCOUNT', 'This is a child account. An adult needs to add it to a Microsoft Family group before it can play.']
}

/** `body` may be pre-serialized: a signed request must send exactly the bytes that were signed. */
async function xboxPost<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<{ res: Response; json: T }> {
  let res: Response
  try {
    res = await request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    })
  } catch (e) {
    throw new AuthError('NETWORK', `Couldn't reach ${new URL(url).host}: ${(e as Error).message}`)
  }
  return { res, json: (await res.json().catch(() => ({}))) as T }
}

// ---------------------------------------------------------------- Xbox proof of possession ('live' flow)
// Title client IDs sign in as a device: a throwaway EC key proves that the device token and the XSTS
// request come from the same place. Mirrors prismarine-auth's default path.

export interface ProofKey {
  privateKey: KeyObject
  jwk: Record<string, unknown>
}

export function createProofKey(): ProofKey {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  return { privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), alg: 'ES256', use: 'sig' } }
}

/**
 * Xbox's `Signature` header: policy version 1, a Windows-epoch timestamp, then an ES256 signature over the
 * method, path, authorization header and body, each NUL-terminated.
 */
export function signXboxRequest(key: ProofKey, url: string, body: string, authorization = ''): string {
  const version = Buffer.alloc(4)
  version.writeInt32BE(1)
  const time = Buffer.alloc(8)
  time.writeBigUInt64BE((BigInt(Math.floor(Date.now() / 1000)) + 11_644_473_600n) * 10_000_000n)
  const nul = Buffer.from([0])
  const text = (s: string): Buffer => Buffer.concat([Buffer.from(s, 'utf8'), nul])
  const signed = Buffer.concat([version, nul, time, nul, text('POST'), text(new URL(url).pathname), text(authorization), text(body)])
  const signature = sign('sha256', signed, { key: key.privateKey, dsaEncoding: 'ieee-p1363' })
  return Buffer.concat([version, time, signature]).toString('base64')
}

const XBOX_SIGNED_HEADERS = { 'cache-control': 'no-store, must-revalidate, no-cache', 'x-xbl-contract-version': '1' }

/** A device token for the proof key. Needs no account, so it doubles as a connectivity check. */
export async function xboxDeviceToken(key: ProofKey): Promise<string> {
  const url = 'https://device.auth.xboxlive.com/device/authenticate'
  const body = JSON.stringify({
    Properties: {
      AuthMethod: 'ProofOfPossession',
      Id: `{${randomUUID()}}`,
      DeviceType: 'Nintendo',
      SerialNumber: `{${randomUUID()}}`,
      Version: '0.0.0',
      ProofKey: key.jwk
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT'
  })
  const res = await xboxPost<{ Token?: string }>(url, body, { ...XBOX_SIGNED_HEADERS, signature: signXboxRequest(key, url, body) })
  if (!res.res.ok || !res.json.Token) throw new AuthError('UNKNOWN', `Xbox device sign-in failed (HTTP ${res.res.status}).`)
  return res.json.Token
}

/** Trade a Microsoft access token for a Minecraft session + profile. */
export async function loginMinecraft(msAccessToken: string, flow: SignInFlow = 'azure'): Promise<MinecraftSession> {
  type XboxToken = { Token: string; DisplayClaims: { xui: { uhs: string }[] } }

  const proof = flow === 'live' ? createProofKey() : null
  const deviceToken = proof ? await xboxDeviceToken(proof) : undefined

  const xbl = await xboxPost<XboxToken>(
    'https://user.auth.xboxlive.com/user/authenticate',
    {
      // Azure (v2 endpoint) tokens are "delegated" tickets; login.live.com tokens are plain RPS tickets.
      Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `${flow === 'live' ? 't' : 'd'}=${msAccessToken}` },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    },
    { 'x-xbl-contract-version': '1' }
  )
  if (!xbl.res.ok) throw new AuthError('UNKNOWN', `Xbox Live sign-in failed (HTTP ${xbl.res.status}).`)

  const xstsUrl = 'https://xsts.auth.xboxlive.com/xsts/authorize'
  const xstsBody = JSON.stringify({
    Properties: proof
      ? { SandboxId: 'RETAIL', UserTokens: [xbl.json.Token], DeviceToken: deviceToken, ProofKey: proof.jwk }
      : { SandboxId: 'RETAIL', UserTokens: [xbl.json.Token] },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT'
  })
  const xsts = await xboxPost<XboxToken & { XErr?: number }>(
    xstsUrl,
    xstsBody,
    proof ? { ...XBOX_SIGNED_HEADERS, signature: signXboxRequest(proof, xstsUrl, xstsBody) } : {}
  )
  if (!xsts.res.ok) {
    const known = XSTS_ERRORS[String(xsts.json.XErr ?? '')]
    if (known) throw new AuthError(known[0], known[1])
    throw new AuthError('UNKNOWN', `Xbox authorization failed (HTTP ${xsts.res.status}).`)
  }
  const uhs = xsts.json.DisplayClaims.xui[0].uhs

  const mc = await xboxPost<{ access_token?: string; expires_in?: number }>(
    'https://api.minecraftservices.com/authentication/login_with_xbox',
    { identityToken: `XBL3.0 x=${uhs};${xsts.json.Token}` }
  )
  if (mc.res.status === 403) {
    throw new AuthError(
      'APP_NOT_APPROVED',
      flow === 'live'
        ? "Minecraft refused Microsoft's shared sign-in for this launcher. (Admin: set up your own Azure app, see README → Microsoft sign-in.)"
        : "Mojang hasn't approved this launcher's Microsoft app yet, so it can't sign in to Minecraft. (Admin: see README → Microsoft sign-in.)"
    )
  }
  if (mc.res.status === 429) throw new AuthError('RATE_LIMITED', 'Too many sign-in attempts. Wait a minute and try again.')
  if (!mc.res.ok || !mc.json.access_token) throw new AuthError('UNKNOWN', `Minecraft sign-in failed (HTTP ${mc.res.status}).`)
  const accessToken = mc.json.access_token

  let profileRes: Response
  try {
    profileRes = await request('https://api.minecraftservices.com/minecraft/profile', { headers: { authorization: `Bearer ${accessToken}` } })
  } catch (e) {
    throw new AuthError('NETWORK', `Couldn't reach Minecraft services: ${(e as Error).message}`)
  }
  if (profileRes.status === 404) {
    throw new AuthError(
      'NO_PROFILE',
      "This Microsoft account doesn't own Minecraft: Java Edition, or hasn't picked a username yet. Game Pass players: open the official launcher once, then try again."
    )
  }
  if (!profileRes.ok) throw new HttpError(profileRes.url, profileRes.status, '')
  const profile = (await profileRes.json()) as { id: string; name: string }
  return { accessToken, expiresAt: Date.now() + (mc.json.expires_in ?? 86_400) * 1000, profile: { id: profile.id, name: profile.name } }
}
