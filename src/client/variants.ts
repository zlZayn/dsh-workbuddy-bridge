/**
 * The two product variants the browser half renders.
 *
 * A variant is the browser-visible half of {@link WorkBuddyVariant}: the routes
 * the card polls and writes, and the copy keys that name the product. It is
 * deliberately NOT the host's variant record — that one carries filesystem
 * paths and platform facts a browser bundle must never see.
 */

import { WORKBUDDY_AI_PROBE_PATH, WORKBUDDY_AI_STATUS_PATH, WORKBUDDY_PROBE_PATH, WORKBUDDY_STATUS_PATH } from '../shared/paths.ts'
import type { WorkBuddyLocaleKey } from './locales.ts'

/** One variant, as a card renders it. */
export interface WorkBuddyCardVariant {
  /** Provider id; also the key the composer control matches a selection on. */
  readonly id: string
  /** Locale key for the card title. */
  readonly titleKey: WorkBuddyLocaleKey
  /** Locale key for the card's one-line description. */
  readonly introKey: WorkBuddyLocaleKey
  /** Locale key for the not-signed-in hint. */
  readonly signedOutKey: WorkBuddyLocaleKey
  /** Status document route. */
  readonly statusPath: string
  /** Control route (write actions: refresh, probe, visibility). */
  readonly probePath: string
  /**
   * The product's own name, used verbatim inside the Agent prompt. Taken from
   * the variant rather than derived from a reason code: the two products fail
   * in the same shapes, so nothing in the failure says which name is right.
   */
  readonly appName: string
  /** Locale key for "no decryption program is configured" on this product. */
  readonly unavailableKey: WorkBuddyLocaleKey
}

/** CN WorkBuddy; the plugin's long-standing card and the default. */
export const CN_CARD_VARIANT: WorkBuddyCardVariant = {
  id: 'workbuddy',
  titleKey: 'title',
  introKey: 'intro',
  signedOutKey: 'signedOutHint',
  statusPath: WORKBUDDY_STATUS_PATH,
  probePath: WORKBUDDY_PROBE_PATH,
  appName: 'WorkBuddy',
  unavailableKey: 'assistUnavailableCN',
}

/** International WorkBuddy AI. */
export const AI_CARD_VARIANT: WorkBuddyCardVariant = {
  id: 'workbuddy-ai',
  titleKey: 'titleAI',
  introKey: 'introAI',
  signedOutKey: 'signedOutHintAI',
  statusPath: WORKBUDDY_AI_STATUS_PATH,
  probePath: WORKBUDDY_AI_PROBE_PATH,
  appName: 'WorkBuddy AI',
  unavailableKey: 'assistUnavailableAI',
}

/** Both variants, in display order. */
export const CARD_VARIANTS: readonly WorkBuddyCardVariant[] = [CN_CARD_VARIANT, AI_CARD_VARIANT]

/** The card (and therefore the routes) a selected provider belongs to. */
export function cardVariantFor(provider: string): WorkBuddyCardVariant | undefined {
  return CARD_VARIANTS.find(card => card.id === provider)
}
