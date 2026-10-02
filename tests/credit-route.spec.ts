/**
 * The per-message credit route.
 *
 * The route is the seam between the Host half's accounting and the browser
 * label, so what matters here is not formatting but *trust and absence*: that a
 * non-loopback caller is refused, that only the asked-for Session is answered,
 * and that "nothing recorded" comes back as an empty map rather than as a
 * missing field or a zero.
 */

import { createServer, request } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { workBuddyCreditHandler, workBuddySessionCredits } from '../src/web/credit.ts'
import { WorkBuddySessionCreditIndex } from '../src/llm/credit-log.ts'
import { WORKBUDDY_CREDIT_PATH } from '../src/shared/paths.ts'

const CLEANUP: (() => Promise<void>)[] = []

afterEach(async () => {
  await Promise.all(CLEANUP.splice(0).map((clean) => clean()))
})

/** Raw HTTP request, with the Host/Origin headers under the test's control. */
function requestOnce(options: {
  port: number
  method: string
  path?: string
  headers: Record<string, string>
}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        host: '127.0.0.1',
        port: options.port,
        method: options.method,
        path: options.path ?? WORKBUDDY_CREDIT_PATH,
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }),
        )
      },
    )
    outgoing.on('error', reject)
    outgoing.end()
  })
}

/** Mount the handler on a real port so the tests exercise the HTTP boundary. */
async function startCreditServer(credits: WorkBuddySessionCreditIndex): Promise<number> {
  const handler = workBuddyCreditHandler({ credits })
  const server = createServer((req, res) => {
    void handler(req, res)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  CLEANUP.push(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      }),
  )
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no port')
  return address.port
}

describe('workBuddySessionCredits', () => {
  it('answers one Session’s costs', () => {
    const credits = new WorkBuddySessionCreditIndex()
    credits.set('s1', 'm1', 0.51)
    expect(workBuddySessionCredits({ credits }, 's1')).toEqual({
      sessionId: 's1',
      credits: { m1: 0.51 },
    })
  })

  it('answers an empty map for a Session with nothing recorded', () => {
    // Not `undefined` and not an error: the label renders nothing, which is
    // exactly right for "this message's cost is unknown".
    expect(workBuddySessionCredits({ credits: new WorkBuddySessionCreditIndex() }, 's1')).toEqual({
      sessionId: 's1',
      credits: {},
    })
  })
})

describe('the credit route', () => {
  it('answers the requested Session over HTTP', async () => {
    const credits = new WorkBuddySessionCreditIndex()
    credits.set('s1', 'm1', 0.51)
    credits.set('s1', 'm2', 3)
    credits.set('s2', 'other', 99)
    const port = await startCreditServer(credits)
    const answer = await requestOnce({
      port,
      method: 'GET',
      path: `${WORKBUDDY_CREDIT_PATH}?sessionId=s1`,
      headers: { host: `127.0.0.1:${port}` },
    })
    expect(answer.status).toBe(200)
    expect(JSON.parse(answer.body)).toEqual({ sessionId: 's1', credits: { m1: 0.51, m2: 3 } })
  })

  it('refuses a request whose Host is not loopback', async () => {
    const port = await startCreditServer(new WorkBuddySessionCreditIndex())
    const answer = await requestOnce({
      port,
      method: 'GET',
      headers: { host: 'evil.example.com' },
    })
    expect(answer.status).toBe(403)
    expect(JSON.parse(answer.body)).toEqual({ error: 'request-not-trusted' })
  })

  it('refuses a browser request whose Origin is not loopback', async () => {
    const port = await startCreditServer(new WorkBuddySessionCreditIndex())
    const answer = await requestOnce({
      port,
      method: 'GET',
      headers: { host: `127.0.0.1:${port}`, origin: 'https://evil.example.com' },
    })
    expect(answer.status).toBe(403)
  })

  it('accepts a loopback Origin', async () => {
    const port = await startCreditServer(new WorkBuddySessionCreditIndex())
    const answer = await requestOnce({
      port,
      method: 'GET',
      headers: { host: `127.0.0.1:${port}`, origin: `http://127.0.0.1:${port}` },
    })
    expect(answer.status).toBe(200)
  })

  it('refuses a write', async () => {
    const port = await startCreditServer(new WorkBuddySessionCreditIndex())
    const answer = await requestOnce({
      port,
      method: 'POST',
      headers: { host: `127.0.0.1:${port}` },
    })
    expect(answer.status).toBe(405)
  })

  it('answers an empty map when no sessionId is given', async () => {
    // "No Session named" is a normal state, not a client error: the browser
    // asks on behalf of whatever it is rendering.
    const port = await startCreditServer(new WorkBuddySessionCreditIndex())
    const answer = await requestOnce({
      port,
      method: 'GET',
      headers: { host: `127.0.0.1:${port}` },
    })
    expect(answer.status).toBe(200)
    expect(JSON.parse(answer.body)).toEqual({ sessionId: '', credits: {} })
  })

  it('never caches the answer', async () => {
    // The map grows as messages are sent; a cached answer would strand the
    // label on a stale figure.
    const port = await startCreditServer(new WorkBuddySessionCreditIndex())
    const headers = await new Promise<Record<string, string>>((resolve, reject) => {
      const outgoing = request(
        {
          host: '127.0.0.1',
          port,
          method: 'GET',
          path: WORKBUDDY_CREDIT_PATH,
          headers: { host: `127.0.0.1:${port}` },
        },
        (res) => {
          res.resume()
          res.on('end', () => resolve(res.headers as Record<string, string>))
        },
      )
      outgoing.on('error', reject)
      outgoing.end()
    })
    expect(headers['cache-control']).toBe('no-store')
  })
})
