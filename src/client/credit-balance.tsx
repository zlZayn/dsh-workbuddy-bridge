/**
 * Remaining credit, in the composer row immediately left of the model picker.
 *
 * This is the one place the figure is worth carrying: choosing a model is the
 * moment the balance decides anything, and the card's own Credits tab is two
 * clicks away from where the choice is made. It answers "how much have I got?"
 * next to the control that spends it.
 *
 * **It is shown only while the session runs a WorkBuddy model.** The balance
 * belongs to the WorkBuddy account, so it is offered exactly where that account
 * is the one being spent; a session on any other provider renders nothing and
 * reads nothing. That keeps the composer row describing the model sitting in
 * it, and avoids putting a second provider's ledger next to a model it cannot
 * pay for.
 *
 * **It renders nothing rather than a guess.** Three states produce no label: the
 * selection is not a WorkBuddy model, the status read has not answered yet, and
 * the read failed. A blanket `0` or a `—` would be read as a balance, and being
 * wrong about a balance is worse than being quiet — the same rule the message
 * label follows.
 *
 * The seat is `conversation.input.right`, a `list` slot whose occupant becomes
 * the immediate flex sibling of the model seat. Registering there rather than
 * at `conversation.input.model` is deliberate and is pinned by
 * `tests/redlines.spec.ts`: that seat is `single` and already holds the shipped
 * `ModelSelect`, so a second registration at the same priority throws and takes
 * the host's own picker down with it.
 *
 * @module dsh-workbuddy-bridge/client/credit-balance
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { cardVariantFor, type WorkBuddyCardVariant } from './variants.ts'
import { isWorkBuddyWebStatus } from './status-document.ts'
import { formatCredit } from './format.ts'
import type { WorkBuddyTranslate } from './locales.ts'
import css from './credit-balance.module.css'

/** Injected props; `directory` decides whether and which account to read. */
export interface WorkBuddyCreditBalanceProps {
  /** Resolves the session's current model selection, and thus the variant. */
  directory: ModelDirectory['store']
  t: WorkBuddyTranslate
}

/**
 * How often the balance is re-read while the composer is mounted.
 *
 * Two minutes rather than the status card's one: each read is a real billing
 * request upstream, the figure only moves when credit is spent, and a window
 * regaining focus forces a fresh read anyway.
 */
const POLL_INTERVAL_MS = 120_000

/**
 * What the status route said about the account's remaining credit.
 *
 * `unknown` is a state, not a failure: a signed-out account and an unreadable
 * document are both "no balance to show" as far as this label is concerned, and
 * distinguishing them here would only tempt a reader into rendering a sentinel.
 */
type Balance = { kind: 'unknown' } | { kind: 'unlimited' } | { kind: 'total'; total: number }

/** Read one variant's status route and reduce it to a balance. */
async function readBalance(card: WorkBuddyCardVariant, signal: AbortSignal): Promise<Balance> {
  try {
    const response = await fetch(card.statusPath, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal,
    })
    if (!response.ok) return { kind: 'unknown' }
    const value: unknown = await response.json().catch(() => undefined)
    if (!isWorkBuddyWebStatus(value) || value.status !== 'signed-in') return { kind: 'unknown' }
    const credits = value.credits
    if (credits === undefined) return { kind: 'unknown' }
    return credits.unlimited === true
      ? { kind: 'unlimited' }
      : { kind: 'total', total: credits.total }
  } catch {
    // Quiet on purpose: see the module note. "Unknown" simply leaves no label.
    return { kind: 'unknown' }
  }
}

/**
 * Show the signed-in WorkBuddy account's remaining credit beside the picker.
 *
 * The account is not per-session, so this reads the status route rather than
 * the credit route: the balance belongs to whoever is signed in, while the
 * per-message costs belong to the conversation.
 */
export function WorkBuddyCreditBalance({ directory, t }: WorkBuddyCreditBalanceProps): ReactNode {
  const selection = useSyncExternalStore(
    useCallback((listener: () => void) => directory.subscribe(listener), [directory]),
    useCallback(() => directory.getSnapshot(), [directory]),
    useCallback(() => directory.getSnapshot(), [directory]),
  ).current
  // `current` is `null` — not `undefined` — when no model is selected, so the
  // check has to be truthy rather than an identity test against undefined.
  const card = selection === null ? undefined : cardVariantFor(selection.provider)
  const [balance, setBalance] = useState<Balance>({ kind: 'unknown' })
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (card === undefined) {
      // Not this plugin's model: show nothing, and stop reading. Clearing the
      // figure also keeps a stale balance from flashing if the user switches
      // back before the next read lands.
      setBalance({ kind: 'unknown' })
      return
    }
    const controller = new AbortController()
    const read = async (): Promise<void> => {
      const next = await readBalance(card, controller.signal)
      if (!mounted.current || controller.signal.aborted) return
      setBalance(next)
    }
    void read()
    const timer = window.setInterval(() => {
      void read()
    }, POLL_INTERVAL_MS)
    // The figure is most likely stale exactly when the user comes back to it.
    const onFocus = (): void => {
      void read()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      mounted.current = false
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [card])

  if (card === undefined || balance.kind === 'unknown') return null
  const text =
    balance.kind === 'unlimited'
      ? t('creditRemainingUnlimited')
      : t('creditRemaining', { credit: formatCredit(balance.total) })
  return (
    <span className={css.label} title={t('creditBalanceTitle', { product: card.appName })}>
      {text}
    </span>
  )
}
