/**
 * The status-document shape guard.
 *
 * This file exists because of a real crash (2026-10-02): `ProbePanel` read
 * `probe.models.length` and `entry.efforts.length` directly, while
 * `isWorkBuddyWebStatus` only checked the `status` discriminator. A document
 * whose `probe.models` was not an array therefore threw **during render**, and
 * the host's slot boundary latches on failure — so switching to the detection
 * tab blanked the entire configuration area until the plugin was toggled off
 * and on again.
 *
 * The rule these cases pin: **the guard must be deep enough that no reader can
 * throw on a document it accepted.** Two sides of that:
 *
 * - the nested structures a reader *iterates without a guard* must be validated
 *   (below, "rejects");
 * - fields a reader only *compares* must stay optional, or the guard starts
 *   rejecting documents the host legitimately omits (below, "accepts").
 *
 * Both directions are asserted, because a guard that only ever gets stricter
 * trades one failure mode for another: a rejected document renders as "invalid
 * response" and the card never shows anything at all.
 */

import { describe, expect, it } from 'vitest'
import { isWorkBuddyWebStatus } from '../src/client/status-document.ts'

/** A minimal signed-in document; `probe` and `visibility` are added per case. */
function signedIn(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { status: 'signed-in', ...extra }
}

/** One well-formed effort row. */
function row(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'glm-5.3', name: 'GLM-5.3', efforts: ['low'], source: 'declared', ...extra }
}

describe('isWorkBuddyWebStatus', () => {
  describe('accepts what the readers can handle', () => {
    it('accepts a signed-in document with no probe section', () => {
      // The host omits `probe` until the first probe read lands. Rejecting this
      // would blank the card for the whole startup window.
      expect(isWorkBuddyWebStatus(signedIn())).toBe(true)
    })

    it('accepts a signed-in document with an empty probe list', () => {
      expect(
        isWorkBuddyWebStatus(signedIn({ probe: { consent: false, running: false, models: [] } })),
      ).toBe(true)
    })

    it('accepts a row whose optional fields are absent', () => {
      // `validation` and `probedAt` are only read behind `!== undefined`, so
      // their absence is a normal state (a model never detected), not a defect.
      expect(
        isWorkBuddyWebStatus(
          signedIn({ probe: { consent: true, running: false, models: [row()] } }),
        ),
      ).toBe(true)
    })

    it('accepts a visibility section with no hidden list', () => {
      expect(isWorkBuddyWebStatus(signedIn({ visibility: { account: 'uid-a' } }))).toBe(true)
    })

    it('accepts an error document that carries a message', () => {
      expect(isWorkBuddyWebStatus({ status: 'error', message: 'boom' })).toBe(true)
    })

    it('accepts a signed-out document', () => {
      expect(isWorkBuddyWebStatus({ status: 'signed-out' })).toBe(true)
    })
  })

  describe('rejects what would throw during render', () => {
    it('rejects a probe section whose models is not an array', () => {
      // The exact 2026-10-02 crash: `.length` on a non-array.
      expect(
        isWorkBuddyWebStatus(
          signedIn({ probe: { consent: true, running: false, models: undefined } }),
        ),
      ).toBe(false)
      expect(
        isWorkBuddyWebStatus(
          signedIn({ probe: { consent: true, running: false, models: 'glm-5.3' } }),
        ),
      ).toBe(false)
      expect(
        isWorkBuddyWebStatus(signedIn({ probe: { consent: true, running: false, models: {} } })),
      ).toBe(false)
    })

    it('rejects a probe row whose efforts is not an array', () => {
      // The other half of the crash: `entry.efforts.length` and `.join(' / ')`.
      expect(
        isWorkBuddyWebStatus(
          signedIn({
            probe: { consent: true, running: false, models: [row({ efforts: undefined })] },
          }),
        ),
      ).toBe(false)
      expect(
        isWorkBuddyWebStatus(
          signedIn({ probe: { consent: true, running: false, models: [row({ efforts: 'low' })] } }),
        ),
      ).toBe(false)
    })

    it('rejects a probe row that is not an object', () => {
      expect(
        isWorkBuddyWebStatus(
          signedIn({ probe: { consent: true, running: false, models: ['glm-5.3'] } }),
        ),
      ).toBe(false)
      expect(
        isWorkBuddyWebStatus(
          signedIn({ probe: { consent: true, running: false, models: [null] } }),
        ),
      ).toBe(false)
    })

    it('rejects a visibility section whose hidden is not an array', () => {
      // The models panel spreads `hidden` into a `Set`, which throws on a
      // non-iterable.
      expect(isWorkBuddyWebStatus(signedIn({ visibility: { hidden: 'glm-5.3' } }))).toBe(false)
      expect(isWorkBuddyWebStatus(signedIn({ visibility: { hidden: [1, 2] } }))).toBe(false)
    })

    it('rejects a probe section that is not an object', () => {
      expect(isWorkBuddyWebStatus(signedIn({ probe: null }))).toBe(false)
      expect(isWorkBuddyWebStatus(signedIn({ probe: [] }))).toBe(false)
    })
  })

  describe('rejects what is not a status document at all', () => {
    it('rejects non-objects and arrays', () => {
      for (const value of [undefined, null, 42, 'signed-in', []]) {
        expect(isWorkBuddyWebStatus(value)).toBe(false)
      }
    })

    it('rejects an unknown discriminator', () => {
      expect(isWorkBuddyWebStatus({ status: 'something-else' })).toBe(false)
    })

    it('rejects an error document with no message', () => {
      // The error paragraph renders `message`, so its absence is the one
      // optional-looking field this guard must insist on.
      expect(isWorkBuddyWebStatus({ status: 'error' })).toBe(false)
    })
  })
})
