/**
 * The per-message credit label, in the assistant message's action row.
 *
 * WorkBuddy's own client puts "共消耗 X" under a finished answer; this is the
 * same fact for the same reason — the cost of a message is not visible anywhere
 * else, and a user comparing models is asking exactly "what did that one cost
 * me?".
 *
 * **It belongs to the WorkBuddy models and is shown only for them.** When the
 * session's current selection is a model from another provider, the label
 * renders nothing and reads nothing: a WorkBuddy credit figure next to a
 * DeepSeek-account answer would describe a ledger that answer never touched.
 * Gating on the *current* selection (rather than on each message's own
 * provider) is deliberate — the user asked for exactly this, and it keeps the
 * row's meaning consistent with the model picker sitting in the same UI.
 *
 * **It renders nothing when there is nothing to say.** The plugin only shows a
 * number it actually observed on the upstream stream (see
 * `src/llm/credit-log.ts`), so a message predating the feature, a failed
 * stream, or an upstream answer that carried no cost produces an empty row
 * rather than a confident `0`. That choice is deliberate and load-bearing: a
 * fabricated zero is worse than a blank, because the user cannot tell it apart
 * from free.
 *
 * Styling copies the sibling `endInfo` cluster — tertiary label tone at the
 * secondary font size — so the label reads as part of the same row as the clock
 * and the usage pill rather than as something bolted on.
 *
 * @module dsh-workbuddy-bridge/client/credit-label
 */

import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { WORKBUDDY_CREDIT_PATH } from '../shared/paths.ts'
import { cardVariantFor } from './variants.ts'
import { useWorkBuddySessionCredits } from './use-session-credits.ts'
import { formatCredit } from './format.ts'
import type { WorkBuddyTranslate } from './locales.ts'
import css from './credit-label.module.css'

/** Injected props; `directory` says whether this session is on a WorkBuddy model. */
export interface WorkBuddyCreditLabelProps {
  /** The durable message this label accounts for (owner currency). */
  messageId: string
  /** The Session the message belongs to (standard session kit). */
  sessionId: string
  /** Resolves the session's current model selection. */
  directory: ModelDirectory['store']
  t: WorkBuddyTranslate
}

/** Show what one message cost, when this session runs a WorkBuddy model. */
export function WorkBuddyCreditLabel({
  messageId,
  sessionId,
  directory,
  t,
}: WorkBuddyCreditLabelProps): ReactNode {
  const selection = useSyncExternalStore(
    useCallback((listener: () => void) => directory.subscribe(listener), [directory]),
    useCallback(() => directory.getSnapshot(), [directory]),
    useCallback(() => directory.getSnapshot(), [directory]),
  ).current
  // `current` is `null` — not `undefined` — when no model is selected.
  const onWorkBuddy = selection !== null && cardVariantFor(selection.provider) !== undefined
  // `enabled` also gates the fetch, so a session on another provider never asks
  // this route for numbers it will not show.
  const { credits } = useWorkBuddySessionCredits(
    WORKBUDDY_CREDIT_PATH,
    sessionId,
    onWorkBuddy && sessionId !== '',
  )
  if (!onWorkBuddy) return null
  const credit = credits?.[messageId]
  // Absent means unobserved — see the module note. Never rendered as 0.
  if (credit === undefined) return null
  return (
    <span className={css.label} title={t('creditConsumedTitle')}>
      {t('creditConsumed', { credit: formatCredit(credit) })}
    </span>
  )
}
