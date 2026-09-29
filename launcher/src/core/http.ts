// Small fetch helpers shared by every network call the launcher makes.

let userAgent = 'smp-launcher/0.0.0'

/** Modrinth asks API clients to send an identifying User-Agent. */
export function setUserAgent(value: string): void {
  userAgent = value
}

export function getUserAgent(): string {
  return userAgent
}

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
    readonly body: string
  ) {
    super(`HTTP ${status} from ${new URL(url).host}`)
    this.name = 'HttpError'
  }
}

export interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  signal?: AbortSignal
  /** Total time allowed for the request (default 30s). */
  timeoutMs?: number
}

export async function request(url: string, opts: RequestOptions = {}): Promise<Response> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 30_000)
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout
  return fetch(url, {
    method: opts.method ?? 'GET',
    headers: { 'user-agent': userAgent, ...opts.headers },
    body: opts.body,
    signal
  })
}

export async function getJson<T>(url: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(url, { ...opts, headers: { accept: 'application/json', ...opts.headers } })
  if (!res.ok) throw new HttpError(url, res.status, await res.text().catch(() => ''))
  return (await res.json()) as T
}

export async function postJson<T>(url: string, body: unknown, opts: RequestOptions = {}): Promise<T> {
  const res = await request(url, {
    ...opts,
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...opts.headers },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new HttpError(url, res.status, await res.text().catch(() => ''))
  return (await res.json()) as T
}

export async function getBuffer(url: string, opts: RequestOptions = {}): Promise<Buffer> {
  const res = await request(url, { timeoutMs: 120_000, ...opts })
  if (!res.ok) throw new HttpError(url, res.status, await res.text().catch(() => ''))
  return Buffer.from(await res.arrayBuffer())
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || e.name === 'CancelledError')
}

export class CancelledError extends Error {
  constructor() {
    super('Cancelled')
    this.name = 'CancelledError'
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CancelledError()
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new CancelledError())
      },
      { once: true }
    )
  })
}

/** Retry transient failures (network errors, 5xx, 429) with exponential backoff. */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  { retries = 2, baseDelayMs = 600, signal }: { retries?: number; baseDelayMs?: number; signal?: AbortSignal } = {}
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    throwIfAborted(signal)
    try {
      return await fn(attempt)
    } catch (e) {
      lastError = e
      if (signal?.aborted) throw new CancelledError()
      const retryable = !(e instanceof HttpError) || e.status >= 500 || e.status === 429 || e.status === 408
      if (!retryable || attempt === retries) break
      await sleep(baseDelayMs * 2 ** attempt, signal)
    }
  }
  throw lastError
}
