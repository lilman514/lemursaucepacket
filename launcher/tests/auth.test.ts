import assert from 'node:assert/strict'
import { createPublicKey, verify, type JsonWebKey } from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import {
  AuthError,
  createProofKey,
  MINECRAFT_LIVE_CLIENT_ID,
  refreshLiveToken,
  requestDeviceCode,
  signXboxRequest,
  waitForDeviceCode
} from '../src/core/auth'
import { CancelledError } from '../src/core/http'

test('Xbox request signatures carry a Windows-epoch timestamp and verify against the proof key', () => {
  const key = createProofKey()
  const url = 'https://xsts.auth.xboxlive.com/xsts/authorize'
  const body = '{"RelyingParty":"rp://api.minecraftservices.com/"}'
  const header = Buffer.from(signXboxRequest(key, url, body), 'base64')
  assert.equal(header.length, 4 + 8 + 64)
  assert.equal(header.readInt32BE(0), 1, 'policy version')
  const stamp = header.readBigUInt64BE(4)
  const now = (BigInt(Math.floor(Date.now() / 1000)) + 11_644_473_600n) * 10_000_000n
  assert.ok(now - stamp < 50_000_000n, 'timestamp is within a few seconds of now, in 100 ns ticks since 1601')

  const nul = Buffer.from([0])
  const text = (s: string): Buffer => Buffer.concat([Buffer.from(s), nul])
  const signed = Buffer.concat([header.subarray(0, 4), nul, header.subarray(4, 12), nul, text('POST'), text('/xsts/authorize'), text(''), text(body)])
  const publicKey = createPublicKey({ key: key.jwk as JsonWebKey, format: 'jwk' })
  assert.ok(verify('sha256', signed, { key: publicKey, dsaEncoding: 'ieee-p1363' }, header.subarray(12)))
})

/** Stand-in for login.live.com: issues one device code, then answers token polls from `tokenReplies`. */
async function fakeLive(tokenReplies: object[]): Promise<{
  endpoints: { deviceCode: string; token: string }
  seen: { path: string; body: URLSearchParams; cookie?: string }[]
  close: () => Promise<void>
}> {
  const seen: { path: string; body: URLSearchParams; cookie?: string }[] = []
  const server = http.createServer((req, res) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      seen.push({ path: req.url ?? '', body: new URLSearchParams(data), cookie: req.headers.cookie })
      res.setHeader('content-type', 'application/json')
      if (req.url?.startsWith('/connect')) {
        res.setHeader('set-cookie', 'MSPOK=abc123; path=/; secure')
        res.end(JSON.stringify({ user_code: 'ABCD-EFGH', device_code: 'dev-123', verification_uri: 'https://www.microsoft.com/link', interval: 0.05, expires_in: 60 }))
        return
      }
      res.end(JSON.stringify(tokenReplies.shift() ?? { error: 'authorization_pending' }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    endpoints: { deviceCode: `http://127.0.0.1:${port}/connect`, token: `http://127.0.0.1:${port}/token` },
    seen,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  }
}

test('device code sign-in waits while the player approves, then returns the tokens', async (t) => {
  const live = await fakeLive([{ error: 'authorization_pending' }, { error: 'authorization_pending' }, { access_token: 'at', refresh_token: 'rt', expires_in: 3600 }])
  t.after(live.close)

  const code = await requestDeviceCode(live.endpoints)
  assert.equal(code.userCode, 'ABCD-EFGH')
  assert.equal(code.verificationUriComplete, 'https://www.microsoft.com/link?otc=ABCD-EFGH')
  assert.equal(live.seen[0].body.get('client_id'), MINECRAFT_LIVE_CLIENT_ID)

  const tokens = await waitForDeviceCode(code, undefined, live.endpoints)
  assert.equal(tokens.accessToken, 'at')
  assert.equal(tokens.refreshToken, 'rt')
  const polls = live.seen.filter((s) => s.path.startsWith('/token'))
  assert.equal(polls.length, 3)
  assert.equal(polls[0].cookie, 'MSPOK=abc123', 'polls carry the cookie from the code request')
  assert.equal(polls[0].body.get('device_code'), 'dev-123')
})

test('device code sign-in stops on cancel and when the player declines', async (t) => {
  const live = await fakeLive([])
  t.after(live.close)
  const abort = new AbortController()
  setTimeout(() => abort.abort(), 150)
  await assert.rejects(waitForDeviceCode(await requestDeviceCode(live.endpoints), abort.signal, live.endpoints), CancelledError)

  const declined = await fakeLive([{ error: 'authorization_declined' }])
  t.after(declined.close)
  await assert.rejects(
    waitForDeviceCode(await requestDeviceCode(declined.endpoints), undefined, declined.endpoints),
    (e: unknown) => e instanceof AuthError && e.code === 'CANCELLED'
  )
})

test('live refresh uses the Minecraft client, and a dead refresh token asks for a new sign-in', async (t) => {
  const live = await fakeLive([{ access_token: 'at2', refresh_token: 'rt2', expires_in: 3600 }, { error: 'invalid_grant' }])
  t.after(live.close)

  const tokens = await refreshLiveToken('rt', live.endpoints)
  assert.equal(tokens.accessToken, 'at2')
  const refresh = live.seen.find((s) => s.path.startsWith('/token'))!
  assert.equal(refresh.body.get('grant_type'), 'refresh_token')
  assert.equal(refresh.body.get('client_id'), MINECRAFT_LIVE_CLIENT_ID)

  await assert.rejects(refreshLiveToken('rt', live.endpoints), (e: unknown) => e instanceof AuthError && e.code === 'MS_REAUTH')
})
