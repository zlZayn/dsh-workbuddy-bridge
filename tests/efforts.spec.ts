import { describe, expect, it } from 'vitest'
import { resolveEfforts } from '../src/probe/efforts.ts'
import { reasoningFields } from '../src/llm/adapter.ts'
import type { WorkBuddyModelInfo } from '../src/catalog/index.ts'
import type { WorkBuddyProbeRecord } from '../src/probe/store.ts'

/**
 * The single rule that decides what thinking levels a model offers.
 *
 * This is the seam the whole bulb redesign rests on: the model picker and the
 * composer's bulb both read this answer, so a case that resolves wrongly here
 * shows up as two halves of the UI disagreeing — which is exactly the defect
 * these tests exist to prevent from returning. Every case therefore asserts the
 * *pair* (what the picker would offer, what the bulb would show), not one side.
 *
 * The rule it pins, in order: a declared set always wins; otherwise a
 * `validating` observation supplies one; otherwise there is no switch. A
 * `non-validating` observation is deliberately in the last group — it must never
 * be read as "this model has no levels" (a capability claim) nor as "levels
 * exist but are hidden" (a false positive).
 */

/** A catalog row. `reasoning` is omitted entirely when not given. */
function model(overrides: Partial<WorkBuddyModelInfo> = {}): WorkBuddyModelInfo {
  return {
    id: 'm',
    name: 'M',
    contextWindow: 1000,
    maxTokens: 100,
    ...overrides,
  } as WorkBuddyModelInfo
}

/** A recorded observation for model `m`. */
function record(
  validation: WorkBuddyProbeRecord['validation'],
  efforts: readonly string[],
): WorkBuddyProbeRecord {
  return {
    fingerprint: 'f',
    validation,
    efforts: efforts as WorkBuddyProbeRecord['efforts'],
    probedAtMs: 1,
    pluginVersion: 'test',
    account: 'uid-a:ent-1',
  }
}

/** What the composer's bulb would do with a resolution. */
function bulbLit(efforts: readonly string[]): boolean {
  return efforts.length > 0
}

describe('resolveEfforts', () => {
  it('uses the declared set and never offers to detect over it', () => {
    const info = model({
      reasoning: {
        supports: true,
        onlyReasoning: true,
        supportedEfforts: ['low', 'high', 'max'],
        defaultEffort: 'high',
        canDisableThinking: false,
      },
    })
    const resolved = resolveEfforts(info)
    expect(resolved.efforts).toEqual(['low', 'high', 'max'])
    expect(resolved.source).toBe('declared')
    // The declaration is already the answer: a sweep would spend credit to
    // learn nothing, so the row must not offer one.
    expect(resolved.detectable).toBe(false)
    expect(bulbLit(resolved.efforts)).toBe(true)
  })

  it('lets a declaration win over an observation that disagrees', () => {
    const info = model({
      reasoning: {
        supports: true,
        onlyReasoning: true,
        supportedEfforts: ['high'],
        canDisableThinking: false,
      },
    })
    // A stale observation claims a wider set; the declaration still wins.
    const resolved = resolveEfforts(info, record('validating', ['low', 'medium']))
    expect(resolved.efforts).toEqual(['high'])
    expect(resolved.source).toBe('declared')
  })

  it('supplies levels from a validating observation when nothing is declared', () => {
    const info = model({
      reasoning: { supports: true, onlyReasoning: true, canDisableThinking: false },
    })
    const resolved = resolveEfforts(info, record('validating', ['low', 'medium', 'high']))
    expect(resolved.efforts).toEqual(['low', 'medium', 'high'])
    expect(resolved.source).toBe('observed')
    expect(bulbLit(resolved.efforts)).toBe(true)
    // Still detectable: the upstream may widen the set later.
    expect(resolved.detectable).toBe(true)
  })

  it('gives a non-validating model no levels but keeps it detectable', () => {
    // The measured `glm-5.2`/`glm-5.3` shape: the upstream accepts values that
    // cannot exist, so every per-level acceptance would be a false positive.
    const info = model({
      reasoning: { supports: true, onlyReasoning: true, canDisableThinking: false },
    })
    const resolved = resolveEfforts(info, record('non-validating', []))
    expect(resolved.efforts).toEqual([])
    expect(resolved.source).toBe('none')
    // The bulb stays dark — there is nothing to switch — but the row stays
    // actionable, because that verdict describes today's upstream.
    expect(bulbLit(resolved.efforts)).toBe(false)
    expect(resolved.detectable).toBe(true)
  })

  it('leaves an unprobed undeclared model unlit but detectable', () => {
    const info = model({
      reasoning: { supports: true, onlyReasoning: true, canDisableThinking: false },
    })
    const resolved = resolveEfforts(info)
    expect(resolved.efforts).toEqual([])
    expect(resolved.source).toBe('none')
    expect(bulbLit(resolved.efforts)).toBe(false)
    expect(resolved.detectable).toBe(true)
  })

  it('treats an unknown observation as "nothing learned", not as a finding', () => {
    const info = model({
      reasoning: { supports: true, onlyReasoning: true, canDisableThinking: false },
    })
    const resolved = resolveEfforts(info, record('unknown', []))
    expect(resolved.efforts).toEqual([])
    // Still detectable: an `unknown` run proved nothing, so asking again is
    // exactly the right next action.
    expect(resolved.detectable).toBe(true)
  })

  it('ignores a validating observation that carries no levels', () => {
    const info = model({
      reasoning: { supports: true, onlyReasoning: true, canDisableThinking: false },
    })
    const resolved = resolveEfforts(info, record('validating', []))
    expect(resolved.efforts).toEqual([])
    expect(resolved.source).toBe('none')
  })

  it('gives a non-reasoning model no switch and nothing to detect', () => {
    const info = model({
      reasoning: { supports: false, onlyReasoning: false, canDisableThinking: true },
    })
    const resolved = resolveEfforts(info)
    expect(resolved.efforts).toEqual([])
    expect(resolved.source).toBe('none')
    expect(resolved.detectable).toBe(false)
  })

  it('treats a row with no reasoning block at all as non-reasoning', () => {
    const resolved = resolveEfforts(model())
    expect(resolved.efforts).toEqual([])
    expect(resolved.detectable).toBe(false)
  })

  it('offers "off" only alongside a declared set', () => {
    const declarer = model({
      reasoning: {
        supports: true,
        onlyReasoning: true,
        supportedEfforts: ['high'],
        canDisableThinking: true,
      },
    })
    expect(resolveEfforts(declarer).canDisable).toBe(true)

    // An observation never grants it: disabling thinking is a separate
    // capability, and the upstream must declare it.
    const observed = model({
      reasoning: {
        supports: true,
        onlyReasoning: true,
        supportedEfforts: ['high'],
        canDisableThinking: false,
      },
    })
    expect(resolveEfforts(observed).canDisable).toBe(false)

    const undeclared = model({
      reasoning: { supports: true, onlyReasoning: true, canDisableThinking: true },
    })
    expect(resolveEfforts(undeclared, record('validating', ['low'])).canDisable).toBe(false)
  })
})

describe('reasoningFields', () => {
  /**
   * The adapter and the status document must not be able to disagree: the bulb
   * is lit from `resolveEfforts`, and the picker's control comes from here. This
   * asserts the two are one decision rather than two implementations that happen
   * to match today.
   */
  const CASES: { name: string; info: WorkBuddyModelInfo; observed?: WorkBuddyProbeRecord }[] = [
    {
      name: 'declared set',
      info: model({
        reasoning: {
          supports: true,
          onlyReasoning: true,
          supportedEfforts: ['low', 'high'],
          canDisableThinking: true,
        },
      }),
    },
    {
      name: 'validating observation',
      info: model({
        reasoning: { supports: true, onlyReasoning: true, canDisableThinking: false },
      }),
      observed: record('validating', ['medium']),
    },
    {
      name: 'non-validating observation',
      info: model({
        reasoning: { supports: true, onlyReasoning: true, canDisableThinking: false },
      }),
      observed: record('non-validating', []),
    },
    {
      name: 'undeclared and unprobed',
      info: model({
        reasoning: { supports: true, onlyReasoning: true, canDisableThinking: false },
      }),
    },
    {
      name: 'non-reasoning',
      info: model({
        reasoning: { supports: false, onlyReasoning: false, canDisableThinking: true },
      }),
    },
  ]

  for (const { name, info, observed } of CASES) {
    it(`lights the picker exactly when the bulb is lit: ${name}`, () => {
      const resolved = resolveEfforts(info, observed)
      const fields = reasoningFields(info, observed)
      // "the picker offers a control" is `reasoning: true` with a map that has
      // at least one non-null switchable level.
      const switchable =
        fields.thinkingLevelMap === undefined
          ? false
          : (['low', 'medium', 'high', 'xhigh', 'max'] as const).some(
              (level) => fields.thinkingLevelMap?.[level] != null,
            )
      expect(fields.reasoning).toBe(resolved.efforts.length > 0)
      expect(switchable).toBe(bulbLit(resolved.efforts))
    })
  }

  it('maps each declared spelling to itself and leaves the rest unset', () => {
    const info = model({
      reasoning: {
        supports: true,
        onlyReasoning: true,
        supportedEfforts: ['low', 'max'],
        canDisableThinking: false,
      },
    })
    const fields = reasoningFields(info)
    expect(fields.reasoning).toBe(true)
    expect(fields.thinkingLevelMap?.['low']).toBe('low')
    expect(fields.thinkingLevelMap?.['max']).toBe('max')
    expect(fields.thinkingLevelMap?.['medium']).toBeNull()
    expect(fields.thinkingLevelMap?.['xhigh']).toBeNull()
    // `minimal` is in no upstream vocabulary, so no set can contain it.
    expect(fields.thinkingLevelMap?.['minimal']).toBeNull()
    // `off` needs the explicit declaration.
    expect(fields.thinkingLevelMap?.['off']).toBeNull()
  })
})
