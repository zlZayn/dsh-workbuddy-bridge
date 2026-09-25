/**
 * One variant's live status: the read, the poll, and every write.
 *
 * Three policies this hook exists to hold, each of which was a real defect
 * before it was named:
 *
 * 1. **A failed read never erases a document already on screen.** It is
 *    recorded beside that document instead. Blanking the card over one
 *    transient error loses the account, credits, and model list the reader was
 *    looking at, which is worse than the error.
 * 2. **The newest read wins.** A slow poll begun before a manual action must
 *    not settle after that action's own refresh and restore the older
 *    document, so every read is numbered when it *starts*.
 * 3. **The poll's liveness depends on the last successful read, not on what is
 *    rendered.** A failed read must not disarm the interval, or one blip
 *    leaves the card blank until the user clicks Refresh.
 *
 * Writes (refresh the catalog, detect reasoning levels, hide a model) share the
 * control route and the read-back: each one re-reads afterwards so the host's
 * truth is what stays on screen, and each reports its refusal beside the
 * document rather than in place of it.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { isWorkBuddyWebStatus } from './status-document.ts'
import type { WorkBuddyLocaleKey } from './locales.ts'
import type { WorkBuddyWebStatus } from '../shared/paths.ts'
import type { WorkBuddyCardVariant } from './variants.ts'

/** How often the status document is re-read while a variant is signed in. */
const POLL_INTERVAL_MS = 60_000

/** One control action the host's probe route accepts. */
export type WorkBuddyControlAction =
  | { action: 'refresh' }
  | { action: 'probe'; model: string }
  | { action: 'clear' }
  | { action: 'set-model-visibility'; model: string; visible: boolean; account: string }

/** What a card renders from, and what it can ask for. */
export interface WorkBuddyStatusApi {
  /** The document to render; undefined means *not read yet*, not "signed out". */
  status: WorkBuddyWebStatus | undefined
  /** Why the most recent read or write failed, when one did. */
  readFailure: string | undefined
  /** Whether a whole-card action is in flight. */
  busy: boolean
  /** The model ids whose visibility writes are in flight; only those rows lock. */
  toggling: ReadonlySet<string>
  /** Re-read now, as the user asked. */
  refresh: () => Promise<void>
  /** Re-read the credential and re-fetch this variant's catalog. */
  refreshModels: () => Promise<void>
  /** Detect the reasoning levels one model accepts. */
  detect: (model: string) => Promise<void>
  /** Drop every recorded detection for this variant. */
  clearDetections: () => Promise<void>
  /** Hide or show one model in the picker, for the account the checkboxes were rendered from. */
  setVisibility: (model: string, visible: boolean, account: string) => Promise<void>
}

/**
 * Own one variant's status document.
 * @param variant - which product's routes and copy to use.
 * @param t - the dictionary reader, for the two messages this hook composes itself.
 */
export function useWorkBuddyStatus(
  variant: WorkBuddyCardVariant,
  t: (key: WorkBuddyLocaleKey, params?: Record<string, unknown>) => string,
): WorkBuddyStatusApi {
  const [status, setStatus] = useState<WorkBuddyWebStatus>()
  const [readFailure, setReadFailure] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [toggling, setToggling] = useState<ReadonlySet<string>>(() => new Set())
  /**
   * Whether the last read that *stated* the session found none — a genuine
   * signed-out answer, as opposed to a read that failed. Kept apart from
   * `status` on purpose: a failed read leaves it untouched, so a transient
   * failure cannot silence the poll, while a real signed-out stops the asking.
   *
   * A ref, not state: making it a dependency would re-arm the interval on every
   * sign-in, restarting the minute and re-reading immediately on top of the
   * read that just changed it.
   */
  const signedOut = useRef(false)

  const mounted = useRef(true)
  /** Number of the newest read that may write; assigned when a read starts. */
  const readSeq = useRef(0)
  /** Manual requests in flight, so unmount can abort them like the poll's. */
  const inFlight = useRef(new Set<AbortController>())

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      for (const controller of inFlight.current) controller.abort()
      inFlight.current.clear()
    }
  }, [])

  /** Register a manual request so unmount aborts it. */
  const track = useCallback((): AbortController => {
    const controller = new AbortController()
    inFlight.current.add(controller)
    return controller
  }, [])

  /**
   * Read the status document and apply it.
   * @returns whether this read produced the document now on screen.
   */
  const read = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    const seq = ++readSeq.current
    // Superseded or unmounted: write nothing, report nothing. A dropped
    // response must not surface as a failure of its own.
    const current = (): boolean => mounted.current && signal?.aborted !== true && seq === readSeq.current
    try {
      const response = await fetch(variant.statusPath, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        ...signal === undefined ? {} : { signal },
      })
      const value: unknown = await response.json().catch(() => undefined)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!isWorkBuddyWebStatus(value)) throw new Error(t('statusResponseInvalid'))
      if (!current()) return false
      setStatus(value)
      // Only a document that states the session may move the poll gate. An
      // `error` document says nothing about the account, so it must not stop
      // the interval — that would strand the card on a state it cannot leave.
      if (value.status === 'signed-in') signedOut.current = false
      else if (value.status === 'signed-out') signedOut.current = true
      setReadFailure(undefined)
      return true
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('requestFailed')
      if (current()) {
        setReadFailure(message)
        // Nothing on screen to preserve: the failure is all there is to show.
        setStatus(previous => previous ?? { status: 'error', message })
      }
      return false
    }
  }, [t, variant.statusPath])

  /**
   * POST one control action, then re-read so the host's truth is what stays.
   *
   * The key travels in a header, not the body: it authorizes the write, and
   * the host never accepts a prompt, a sentinel, or a model outside its own
   * catalog from here.
   */
  const control = useCallback(async (action: WorkBuddyControlAction): Promise<void> => {
    const key = status?.status === 'signed-in' ? status.probeKey : undefined
    if (key === undefined) return
    // A visibility toggle runs on its own per-row in-flight set, so the Refresh
    // buttons keep their idle labels and untouched rows stay clickable; every
    // other action takes the card-wide `busy` those labels report.
    const perRow = action.action === 'set-model-visibility'
    if (perRow) setToggling(previous => new Set(previous).add(action.model))
    else setBusy(true)
    const controller = track()
    try {
      const response = await fetch(variant.probePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WorkBuddy-Probe-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify(action),
      })
      const value: unknown = await response.json().catch(() => undefined)
      if (!response.ok) throw new Error(errorMessage(value, response.status))
      // A visibility write must confirm itself: a `failed` state means the host
      // did not persist the toggle, and the checkbox must not be left claiming
      // it did — the thrown reason lands beside the list and the next read
      // restores the honest state.
      if (action.action === 'set-model-visibility' && fieldOf(value, 'state') !== 'updated') {
        // A stale write (the account switched under the open card) is its own
        // outcome: explain it and re-read now, so the checkboxes converge on
        // the new account's section instead of waiting for the next poll while
        // still showing the departed account's list.
        if (fieldOf(value, 'state') === 'stale-account') {
          await read(controller.signal)
          throw new Error(t('visibilityStaleAccount'))
        }
        throw new Error(fieldOf(value, 'reason') ?? t('requestFailed'))
      }
      await read(controller.signal)
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setReadFailure(error instanceof Error ? error.message : t('requestFailed'))
      }
    } finally {
      inFlight.current.delete(controller)
      if (mounted.current) {
        if (perRow) setToggling(previous => {
          const next = new Set(previous)
          if (action.action === 'set-model-visibility') next.delete(action.model)
          return next
        })
        else setBusy(false)
      }
    }
  }, [read, status, t, track, variant.probePath])

  /**
   * The poll. Armed on mount and disarmed on unmount; a genuine signed-out
   * answer makes it skip its turns rather than clear itself, so signing in on
   * the desktop is picked up within the minute instead of needing a click.
   */
  useEffect(() => {
    const controller = new AbortController()
    void read(controller.signal)
    const timer = window.setInterval(() => {
      if (signedOut.current) return
      void read(controller.signal)
    }, POLL_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
      controller.abort()
    }
  }, [read])

  const refresh = useCallback(async (): Promise<void> => {
    setBusy(true)
    const controller = track()
    try {
      await read(controller.signal)
    } finally {
      inFlight.current.delete(controller)
      if (mounted.current) setBusy(false)
    }
  }, [read, track])

  return {
    status,
    readFailure,
    busy,
    toggling,
    refresh,
    refreshModels: useCallback(() => control({ action: 'refresh' }), [control]),
    detect: useCallback((model: string) => control({ action: 'probe', model }), [control]),
    clearDetections: useCallback(() => control({ action: 'clear' }), [control]),
    setVisibility: useCallback(
      (model: string, visible: boolean, account: string) =>
        control({ action: 'set-model-visibility', model, visible, account }),
      [control],
    ),
  }
}

/** Read one string field out of an unknown JSON body. */
function fieldOf(value: unknown, field: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const found = (value as Record<string, unknown>)[field]
  return typeof found === 'string' ? found : undefined
}

/** The reason a rejected control response carries, or the HTTP status. */
function errorMessage(value: unknown, status: number): string {
  return fieldOf(value, 'error') ?? fieldOf(value, 'reason') ?? `HTTP ${status}`
}
