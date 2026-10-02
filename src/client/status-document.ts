/** Shape check for the status document, shared by the card and the composer control. */

import type { WorkBuddyWebStatus, WorkBuddyWebSessionCredits } from '../shared/paths.ts'

/**
 * Whether a parsed status response really is a status document.
 *
 * A 200 is not a promise about the body: it may be empty, literal `null`, a
 * non-JSON page from a proxy, or an array. Both halves of the browser plugin
 * read the same route, so both must agree on what is valid — storing an
 * unreadable value puts something in state that the next render dereferences.
 *
 * The check is deliberately limited to the discriminator (plus `error`'s
 * `message`, which the error paragraph renders): validating optional fields
 * here would reject documents the host legitimately omits fields from.
 *
 * `reasonCode` is therefore *not* rejected here — a card renders `reason`
 * either way — but every reader must narrow it with
 * `isWorkBuddySignedOutReasonCode` before branching on it, since the wire
 * value is not guaranteed to be inside the enum.
 */
export function isWorkBuddyWebStatus(value: unknown): value is WorkBuddyWebStatus {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const wrapped = value as Record<string, unknown>
  const status = wrapped['status']
  if (status === 'signed-out' || status === 'signed-in') return true
  return status === 'error' && typeof wrapped['message'] === 'string'
}

/**
 * Whether a parsed credit response really is a credit document.
 *
 * Same reasoning as {@link isWorkBuddyWebStatus}: a 200 promises nothing about
 * the body. Stricter about the payload than the status check because this one
 * *is* the data — every entry is read and formatted — so a map holding a string
 * or a `NaN` where a number belongs would reach the label. Entries that are not
 * finite non-negative numbers are dropped rather than rejecting the whole
 * document: one malformed row must not blank every other message's label.
 */
export function isWorkBuddySessionCredits(value: unknown): value is WorkBuddyWebSessionCredits {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const wrapped = value as Record<string, unknown>
  if (typeof wrapped['sessionId'] !== 'string') return false
  const credits = wrapped['credits']
  if (typeof credits !== 'object' || credits === null || Array.isArray(credits)) return false
  // The guard narrows the entry type in place, so the returned document is
  // already clean and no reader repeats this filter.
  const record = credits as Record<string, unknown>
  for (const key of Object.keys(record)) {
    const credit = record[key]
    if (typeof credit !== 'number' || !Number.isFinite(credit) || credit < 0) delete record[key]
  }
  return true
}
