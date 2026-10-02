/**
 * One Session's per-message credit accounting, as the browser half reads it.
 *
 * The Host half observes what each response cost on the upstream stream and
 * attributes it to a DSH message id; this hook fetches that map and keeps it
 * fresh. Two surfaces share it — the composer balance label and the per-message
 * credit row — so the fetch policy lives here once rather than in both.
 *
 * **A failure is silent, and that is the intended degradation.** The number is
 * an annotation on a message that already rendered; a failed read must never
 * turn into an error strip over a conversation, and an unreadable map must
 * never be confused with "these messages were free". So a failure leaves the
 * last good map in place and the affected rows simply show no credit.
 *
 * @module dsh-workbuddy-bridge/client/use-session-credits
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { isWorkBuddySessionCredits } from './status-document.ts'

/** How often the map is re-read while a Session is open, in milliseconds. */
const POLL_INTERVAL_MS = 30_000

/** What a credit-reading component renders from. */
export interface WorkBuddySessionCreditsApi {
  /**
   * `messageId → credit` for the current Session, or undefined before the first
   * successful read.
   *
   * Undefined and `{}` mean different things and both are load-bearing: the
   * former is "not read yet", the latter is "read, and nothing is recorded" —
   * so a row can tell "no label yet" from "this message has no cost", and
   * neither is ever rendered as zero.
   */
  credits: Readonly<Record<string, number>> | undefined
}

/**
 * Read and poll one Session's credit map.
 *
 * @param path - the variant's credit route.
 * @param sessionId - the Session to read for; the hook is inert without one.
 * @param enabled - whether the reading surface is currently mounted. The
 * composer label and the message row both come and go, and this stops the poll
 * when neither is showing.
 */
export function useWorkBuddySessionCredits(
  path: string,
  sessionId: string | undefined,
  enabled: boolean,
): WorkBuddySessionCreditsApi {
  const [credits, setCredits] = useState<Readonly<Record<string, number>>>()
  const mounted = useRef(true)
  /** Number of the newest read allowed to write; assigned when a read starts. */
  const readSeq = useRef(0)

  const read = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      if (sessionId === undefined || sessionId === '') return
      const seq = ++readSeq.current
      try {
        const response = await fetch(`${path}?sessionId=${encodeURIComponent(sessionId)}`, {
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
          signal,
        })
        if (!response.ok) return
        const value: unknown = await response.json().catch(() => undefined)
        if (!isWorkBuddySessionCredits(value)) return
        // A superseded read must not restore an older map over a newer one.
        if (!mounted.current || signal.aborted || seq !== readSeq.current) return
        setCredits(value.credits)
      } catch {
        // Deliberately swallowed: see the module note. The last good map stays
        // on screen and the rows keep whatever they were showing.
      }
    },
    [path, sessionId],
  )

  useEffect(() => {
    mounted.current = true
    if (!enabled || sessionId === undefined || sessionId === '') return
    const controller = new AbortController()
    void read(controller.signal)
    const timer = window.setInterval(() => {
      void read(controller.signal)
    }, POLL_INTERVAL_MS)
    // A question about cost is usually asked right after the answer finishes,
    // and the answer finishes while this tab may have been in the background.
    const onFocus = (): void => {
      void read(controller.signal)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      mounted.current = false
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, read, sessionId])

  return { credits }
}
