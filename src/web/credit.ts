/**
 * Same-origin route answering what individual messages cost, for the browser
 * half's per-message credit label.
 *
 * Separate from the status route on purpose: the status document describes the
 * *account* (and is re-read when it changes), while this describes one
 * *Session*'s messages over time. Folding them together would make every
 * message's cost re-send the whole account document, and would tie a row's
 * accounting to the account poll's cadence.
 *
 * The route carries no credential material: it answers what the plugin already
 * observed on its own loopback stream. It is guarded exactly like the status
 * route — loopback Host, loopback Origin when a browser sent one — because the
 * data is per-user even though it is not secret.
 *
 * @module dsh-workbuddy-bridge/web/credit
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { hostIsLoopback, originIsLoopback } from '../llm/loopback.ts'
import { WORKBUDDY_CREDIT_PATH } from '../shared/paths.ts'
import type { WorkBuddyWebSessionCredits } from '../shared/paths.ts'
import type { WorkBuddySessionCreditIndex } from '../llm/credit-log.ts'

export { WORKBUDDY_CREDIT_PATH } from '../shared/paths.ts'
export type { WorkBuddyWebSessionCredits } from '../shared/paths.ts'

/** Constructor dependencies. */
export interface WorkBuddyCreditRouteOptions {
  /** The accounting to read from; see {@link WorkBuddySessionCreditIndex}. */
  credits: WorkBuddySessionCreditIndex
  /**
   * Route path to mount, defaulting to the CN variant's. The international
   * variant passes its own so the two halves never share a route: the browser
   * bundle and the host bundle are built independently, and a computed path is
   * one build-config drift away from asking a route that was never mounted.
   */
  path?: string
}

/**
 * The request must be addressed to the loopback interface, and a
 * browser-attached Origin must be loopback too. Identical to the status route's
 * guard: the Host check drops DNS-rebinding pages, and the card's same-origin
 * fetches carry no Origin and pass on Host alone.
 */
function loopbackRequest(req: IncomingMessage): boolean {
  return hostIsLoopback(req.headers.host) && originIsLoopback(req.headers.origin)
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/**
 * One Session's accounting.
 *
 * A missing `sessionId` is answered with an empty document rather than an
 * error: the browser half asks on behalf of whatever Session it is rendering,
 * and "this Session has no recorded costs" is a normal, silent state — the row
 * simply shows no label.
 *
 * @param deps - the accounting index.
 * @param sessionId - the Session to answer for.
 * @returns the document the browser half renders from.
 */
export function workBuddySessionCredits(
  deps: WorkBuddyCreditRouteOptions,
  sessionId: string,
): WorkBuddyWebSessionCredits {
  return { sessionId, credits: deps.credits.forSession(sessionId) }
}

/** The credit route's request handler, extracted so tests can mount it bare. */
export function workBuddyCreditHandler(
  deps: WorkBuddyCreditRouteOptions,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (req.method !== 'GET') {
      json(res, 405, { error: 'method not allowed' })
      return
    }
    if (!loopbackRequest(req)) {
      json(res, 403, { error: 'request-not-trusted' })
      return
    }
    // Read from the URL, not from a header: this is a plain same-origin GET the
    // browser already knows how to make, and the Session id is not a secret.
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const sessionId = url.searchParams.get('sessionId') ?? ''
    json(res, 200, workBuddySessionCredits(deps, sessionId))
  }
}

/** Mount the GET credit route on an optional webServer context. */
export function registerWorkBuddyCreditRoute(
  ctx: Context,
  deps: WorkBuddyCreditRouteOptions,
): void {
  const path = deps.path ?? WORKBUDDY_CREDIT_PATH
  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'exact',
      path,
      handler: workBuddyCreditHandler(deps),
    })
    return () => {
      dispose()
    }
  }, 'dsh-workbuddy-bridge: Web credit route')
}
