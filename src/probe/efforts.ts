/**
 * The one place that decides what thinking levels a model offers, and why.
 *
 * Both halves of the plugin ask this question — the model picker (through the
 * adapter's `thinkingLevelMap`) and the composer's bulb (through the status
 * document) — and a second implementation of it is how the two came to
 * disagree: the picker offered levels for a model the composer showed no
 * control for, so "no bulb" and "switchable" looked unrelated to the user.
 *
 * The rule, in strict order:
 *
 * 1. **A declared set wins.** When the upstream names a non-empty
 *    `supportedEfforts`, exactly those values are offered. No observation ever
 *    widens or narrows it, which is also why such a row is not detectable: a
 *    sweep would spend credit to learn something already known.
 * 2. **A validating observation supplies a set** for rows the upstream left
 *    undeclared. The offered set is "verified accepted", never "verified
 *    effective" — acceptance proves the upstream did not reject the spelling,
 *    not that it changes what the model does.
 * 3. **Otherwise there is no switch.** A `non-validating` observation lands
 *    here deliberately: the upstream accepts values that cannot exist
 *    (measured on `glm-5.2`), so every per-level acceptance it produced would
 *    be a false positive. Such a row stays *detectable*, because that verdict
 *    describes today's upstream rather than the model.
 *
 * `off` is a separate capability, offered only when the upstream declares
 * `canDisableThinking: true` alongside a declared set. It is never probed:
 * disabling thinking cannot be inferred from a row's shape.
 *
 * @module dsh-workbuddy-bridge/probe/efforts
 */

import type { WorkBuddyModelInfo } from '../catalog/index.ts'
import type { WorkBuddyEffort } from '../protocol/client.ts'
import type { WorkBuddyProbeRecord } from '../probe/store.ts'

/** Where a model's offered levels came from. */
export type WorkBuddyEffortSource = 'declared' | 'observed' | 'none'

/** What a model's thinking-level switch looks like right now. */
export interface WorkBuddyEffortResolution {
  /**
   * Levels the picker offers, in upstream order.
   *
   * **Empty means the model cannot switch thinking.** This is the single field
   * both halves key on, so the picker's list and the composer's bulb cannot
   * describe different things.
   */
  efforts: readonly WorkBuddyEffort[]
  /** Where {@link efforts} came from. */
  source: WorkBuddyEffortSource
  /**
   * Whether a detection could change this answer.
   *
   * False for a declared set (the declaration wins) and for a model that does
   * not reason at all.
   */
  detectable: boolean
  /**
   * Whether the picker also offers "off".
   *
   * Declaration-only, and phrased as its own fact rather than a member of
   * {@link efforts}: it is not a thinking level, so counting it as one would
   * make a model with no levels look switchable.
   */
  canDisable: boolean
}

/** The resolution for a model that does not reason: no switch, nothing to detect. */
const NO_SWITCH: WorkBuddyEffortResolution = {
  efforts: [],
  source: 'none',
  detectable: false,
  canDisable: false,
}

/**
 * Resolve one model's thinking-level switch.
 *
 * @param info - the catalog row, whose `reasoning` block carries any declaration.
 * @param observed - this account's recorded detection for the model, if any.
 */
export function resolveEfforts(
  info: WorkBuddyModelInfo,
  observed?: WorkBuddyProbeRecord | undefined,
): WorkBuddyEffortResolution {
  const reasoning = info.reasoning
  if (reasoning === undefined || reasoning.supports !== true) return NO_SWITCH

  const declared = reasoning.supportedEfforts
  if (declared !== undefined && declared.length > 0) {
    return {
      efforts: declared,
      source: 'declared',
      // A declaration always wins, so there is nothing a sweep could add.
      detectable: false,
      canDisable: reasoning.canDisableThinking === true,
    }
  }

  // Undeclared. Only a validating observation may supply a set; anything else
  // (no record, `unknown`, `non-validating`) leaves the model without a switch
  // but still worth detecting — `unknown` because the last run proved nothing,
  // `non-validating` because that verdict can change with the upstream.
  if (observed?.validation === 'validating' && observed.efforts.length > 0) {
    return { efforts: observed.efforts, source: 'observed', detectable: true, canDisable: false }
  }
  return { efforts: [], source: 'none', detectable: true, canDisable: false }
}
