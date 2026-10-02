/** Shape check for the status document, shared by the card and the composer control. */

import type { WorkBuddyWebStatus, WorkBuddyWebSessionCredits } from '../shared/paths.ts'

/**
 * Whether one probe row is safe to read.
 *
 * `efforts` is the field the readers actually dereference (`.length`, `.join`),
 * so it is the one that must be an array — a row whose `efforts` is absent or a
 * string would throw inside the panel rather than degrade.
 */
function isEffortRow(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return typeof row['id'] === 'string' && Array.isArray(row['efforts'])
}

/**
 * Whether the `probe` section is safe to read.
 *
 * Validated to the depth the readers go, and no further. `consent` and `running`
 * are only ever compared, so a missing value degrades correctly on its own;
 * `models` is iterated and each row's `efforts` is measured, so those two must
 * actually be arrays.
 *
 * The depth matters in both directions. Too shallow and a malformed document
 * throws inside the panel — which the host's slot boundary turns into a
 * *latched* failure, so the whole configuration area disappears until the plugin
 * is toggled (2026-10-02, reached through a client-bundle hot reload that
 * changed the document shape under a mounted component). Too deep and the guard
 * starts rejecting documents the host legitimately omits fields from.
 */
function isProbeSection(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const section = value as Record<string, unknown>
  const models = section['models']
  return Array.isArray(models) && models.every(isEffortRow)
}

/**
 * Whether the `visibility` section is safe to read.
 *
 * `hidden` is spread into a `Set` by the models panel, which throws on a
 * non-iterable; the account key is only compared, so it is left alone.
 */
function isVisibilitySection(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const section = value as Record<string, unknown>
  const hidden = section['hidden']
  return (
    hidden === undefined || (Array.isArray(hidden) && hidden.every((id) => typeof id === 'string'))
  )
}

/**
 * Whether a parsed status response really is a status document.
 *
 * A 200 is not a promise about the body: it may be empty, literal `null`, a
 * non-JSON page from a proxy, or an array. Both halves of the browser plugin
 * read the same route, so both must agree on what is valid — storing an
 * unreadable value puts something in state that the next render dereferences.
 *
 * Beyond the discriminator this validates the two nested structures a reader
 * iterates **without** a guard: `probe.models` and `visibility.hidden`. Those
 * are the ones that turn a malformed document into a thrown render rather than
 * a degraded one. Everything else stays optional on purpose — validating
 * optional fields would reject documents the host legitimately omits fields
 * from, and a reader that only compares a value degrades correctly without help.
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
  if (status === 'error') return typeof wrapped['message'] === 'string'
  if (status !== 'signed-out' && status !== 'signed-in') return false
  // Absent is fine: the host omits `probe` until the first probe read lands, and
  // every reader already tolerates that. Present-but-malformed is a rejection.
  const probe = wrapped['probe']
  if (probe !== undefined && !isProbeSection(probe)) return false
  const visibility = wrapped['visibility']
  return visibility === undefined || isVisibilitySection(visibility)
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
