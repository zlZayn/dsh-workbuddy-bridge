/**
 * The two credit surfaces, in a real React tree: the per-message label and the
 * balance beside the model picker.
 *
 * Both are annotations over things that already render — a finished answer and
 * a model picker — so the rules that matter are about **absence**:
 *
 * - an unobserved cost must produce no label at all, never `0`, because a
 *   fabricated zero is indistinguishable from a genuinely free model;
 * - a failed or unfinished read must leave the label quiet rather than turn a
 *   conversation into an error report;
 * - neither surface may render anything for a session running another provider,
 *   where there is no WorkBuddy credit to speak of.
 *
 * The `directory` prop is the real `ModelDirectory`-shaped store: a plain
 * `SnapshotStore` stub is enough because both components only subscribe to it,
 * and using the real shape is what pins the `selection` read they depend on.
 */

import { createElement } from 'react'
import { act } from 'react-test-renderer'
import { describe, expect, it } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { WorkBuddyCreditLabel } from '../../src/client/credit-label.tsx'
import { WorkBuddyCreditBalance } from '../../src/client/credit-balance.tsx'
import { formatCredit } from '../../src/client/format.ts'
import { isWorkBuddySessionCredits } from '../../src/client/status-document.ts'
import { t, signedIn, textOf, useBrowserStubs, useTree } from './harness.ts'

const stub = useBrowserStubs()
const box = useTree()

/** A `ModelDirectory['store']` stub holding one selection. */
function directoryFor(selection: { provider: string; model: string } | null) {
  return createSnapshotStore({
    current: selection,
    routable: null,
    groups: [],
    failures: [],
    status: 'idle' as const,
    pending: null,
    error: null,
  })
}

describe('formatCredit', () => {
  it('prints an integer bare', () => {
    expect(formatCredit(3)).toBe('3')
    expect(formatCredit(0)).toBe('0')
  })

  it('trims trailing zeros to two decimals', () => {
    // The ledger carries two decimals; the zeros beyond that are noise, and
    // this matches what the WorkBuddy client itself prints.
    expect(formatCredit(0.5)).toBe('0.5')
    expect(formatCredit(0.51)).toBe('0.51')
    expect(formatCredit(1.2)).toBe('1.2')
    expect(formatCredit(2.25)).toBe('2.25')
  })

  it('prints nothing for a non-finite value', () => {
    expect(formatCredit(Number.NaN)).toBe('')
  })
})

describe('isWorkBuddySessionCredits', () => {
  it('accepts an empty map', () => {
    expect(isWorkBuddySessionCredits({ sessionId: 's', credits: {} })).toBe(true)
  })

  it('drops an entry that is not a finite non-negative number', () => {
    const value: unknown = {
      sessionId: 's',
      credits: { good: 1, str: '2', neg: -1, nan: Number.NaN, nul: null },
    }
    expect(isWorkBuddySessionCredits(value)).toBe(true)
    // One malformed row must not blank every other message's label.
    expect(value).toEqual({ sessionId: 's', credits: { good: 1 } })
  })

  it('rejects a body that is not a credit document', () => {
    for (const bad of [undefined, null, [], 42, {}, { sessionId: 's' }, { credits: {} }]) {
      expect(isWorkBuddySessionCredits(bad)).toBe(false)
    }
  })
})

describe('the per-message credit label', () => {
  /** Route the label's fetch to a credit document, and let it settle. */
  async function mount(
    messageId: string,
    credits: Record<string, number> | undefined,
    selection: { provider: string; model: string } | null = {
      provider: 'workbuddy',
      model: 'deepseek-v4.1-flash',
    },
  ): Promise<void> {
    stub.call.mockImplementation(async (url: string) => {
      if (String(url).includes('/credit')) {
        if (credits === undefined) return { ok: false, json: async () => undefined }
        return { ok: true, json: async () => ({ sessionId: 's1', credits }) }
      }
      return { ok: true, json: async () => signedIn() }
    })
    await act(async () => {
      box.view = (await import('react-test-renderer')).create(
        createElement(WorkBuddyCreditLabel, {
          messageId,
          sessionId: 's1',
          directory: directoryFor(selection) as never,
          t,
        }),
      )
    })
    // One microtask turn for the fetch promise chain to settle.
    await act(async () => {})
  }

  it('names what the message consumed', async () => {
    await mount('m1', { m1: 0.51 })
    expect(textOf(box.view!)).toContain('0.51')
  })

  it('renders nothing for a message whose cost was never observed', async () => {
    // The load-bearing case: absent must not read as zero.
    await mount('m1', { m2: 5 })
    expect(textOf(box.view!)).toBe('')
  })

  it('shows an explicitly free message as zero', async () => {
    await mount('m1', { m1: 0 })
    // A real zero *is* reported, and it is distinguishable from "unknown"
    // precisely because the unknown case renders nothing.
    expect(textOf(box.view!)).toContain('0')
  })

  it('stays quiet when the read fails', async () => {
    await mount('m1', undefined)
    expect(textOf(box.view!)).toBe('')
  })

  it('is shown only while the session runs a WorkBuddy model', async () => {
    // The user's rule: a credit figure belongs beside the models it pays for.
    // On another provider's model the row shows nothing, even for a message
    // that does have a recorded cost.
    await mount('m1', { m1: 1.25 }, { provider: 'deepseek-account', model: 'deepseek-flash' })
    expect(textOf(box.view!)).toBe('')
  })

  it('is shown for the international WorkBuddy model too', async () => {
    await mount('m1', { m1: 1.25 }, { provider: 'workbuddy-ai', model: 'gpt-5.6' })
    expect(textOf(box.view!)).toContain('1.25')
  })

  it('is hidden before a selection is known', async () => {
    await mount('m1', { m1: 1.25 }, null)
    expect(textOf(box.view!)).toBe('')
  })

  it('does not read the credit route while hidden', async () => {
    // Gating the *fetch* too, not just the render: a session on another
    // provider must not poll a route whose numbers it will never show.
    await mount('m1', { m1: 1.25 }, { provider: 'deepseek-account', model: 'deepseek-flash' })
    const asked = stub.call.mock.calls.some(([url]) => String(url).includes('/credit'))
    expect(asked).toBe(false)
  })
})

describe('the balance label beside the model picker', () => {
  /** Mount the balance with a chosen status body. */
  async function mount(
    status: Record<string, unknown> | undefined,
    selection: { provider: string; model: string } | null = {
      provider: 'workbuddy',
      model: 'deepseek-v4.1-flash',
    },
    // The AI variant's answer, when a test needs the two to differ.
    aiStatus?: Record<string, unknown>,
  ): Promise<void> {
    stub.call.mockImplementation(async (url: string) => {
      const isAI = String(url).includes('/ai/status')
      const body = isAI ? (aiStatus ?? status) : status
      if (body === undefined) return { ok: false, json: async () => undefined }
      return { ok: true, json: async () => body }
    })
    await act(async () => {
      box.view = (await import('react-test-renderer')).create(
        createElement(WorkBuddyCreditBalance, {
          directory: directoryFor(selection) as never,
          t,
        }),
      )
    })
    await act(async () => {})
  }

  it('shows the remaining balance', async () => {
    await mount(signedIn({ credits: { total: 5143, accounts: [] } }))
    expect(textOf(box.view!)).toContain('5143')
  })

  it('shows the figure as a coin glyph plus the number, with no wording', async () => {
    /*
     * The readout is deliberately wordless: at 28px a sentence competes with the
     * number it labels, and the glyph says what the number is. So the assertion
     * is two-sided — the figure is there, and the words "remaining" are not —
     * because "shows the balance" alone would still pass with the old copy back.
     */
    await mount(signedIn({ credits: { total: 3398, accounts: [] } }))
    const text = textOf(box.view!)
    expect(text).toContain('3398')
    expect(text).not.toContain(t('creditBalanceTitle', { product: 'WorkBuddy' }))

    // The glyph is an inline svg, and it is drawn as *outlines*: a filled version
    // was rejected for outweighing the thin-line bulb beside it, so the stroke
    // (rather than a fill) is the property worth pinning.
    const glyph = box.view!.root.findAllByType('svg')[0]
    expect(glyph).toBeDefined()
    expect(glyph!.props['stroke']).toBe('currentColor')
    expect(glyph!.props['strokeWidth']).toBe('1')
    expect(glyph!.props['fill']).toBe('none')
    // Three coins: a top face, the walls/floor path, and the middle edge.
    expect(glyph!.findAll((node) => node.type === 'ellipse')).toHaveLength(1)
    expect(glyph!.findAll((node) => node.type === 'path')).toHaveLength(2)
  })

  it('keeps the full sentence as the title, for whoever hovers', async () => {
    await mount(signedIn({ credits: { total: 3398, accounts: [] } }))
    const readout = box.view!.root.findAll(
      (node) =>
        typeof node.props['title'] === 'string' && node.props['title'].includes('WorkBuddy'),
    )
    expect(readout.length).toBeGreaterThan(0)
  })

  it('says unlimited rather than printing a sentinel', async () => {
    await mount(signedIn({ credits: { total: 0, accounts: [], unlimited: true } }))
    expect(textOf(box.view!)).toContain('Unlimited')
  })

  it('renders nothing before the first answer', async () => {
    await mount(undefined)
    expect(textOf(box.view!)).toBe('')
  })

  it('renders nothing when no WorkBuddy account is signed in', async () => {
    await mount({ status: 'signed-out' })
    expect(textOf(box.view!)).toBe('')
  })

  it('renders nothing when the credit read failed', async () => {
    // `creditsError` means the balance is unknown; a label here would be a guess.
    await mount(signedIn({ credits: undefined, creditsError: 'boom' }))
    expect(textOf(box.view!)).toBe('')
  })

  it('is shown only while the session runs a WorkBuddy model', async () => {
    // The user's rule: the balance belongs beside the models it can pay for.
    await mount(signedIn({ credits: { total: 5143, accounts: [] } }), {
      provider: 'deepseek-account',
      model: 'deepseek-flash',
    })
    expect(textOf(box.view!)).toBe('')
  })

  it('does not read the status route while hidden', async () => {
    await mount(signedIn({ credits: { total: 5143, accounts: [] } }), {
      provider: 'deepseek-account',
      model: 'deepseek-flash',
    })
    const asked = stub.call.mock.calls.some(([url]) => String(url).includes('/status'))
    expect(asked).toBe(false)
  })

  it('reads the international account when that is the selected model', async () => {
    // Each product's balance is its own; the picker decides which one answers.
    await mount(
      signedIn({ credits: { total: 111, accounts: [] } }),
      { provider: 'workbuddy-ai', model: 'gpt-5.6' },
      signedIn({ credits: { total: 222, accounts: [] } }),
    )
    const shown = textOf(box.view!)
    expect(shown).toContain('222')
    expect(shown).not.toContain('111')
  })

  it('polls while mounted and stops on unmount', async () => {
    await mount(signedIn({ credits: { total: 7, accounts: [] } }))
    expect(stub.intervals).toBe(1)
    act(() => {
      box.view?.unmount()
    })
    box.view = undefined
    expect(stub.intervals).toBe(0)
  })

  it('re-reads on every poll while mounted', async () => {
    // The balance moves as messages are sent, so a read-once label would be
    // wrong within a minute of being mounted.
    await mount(signedIn({ credits: { total: 1, accounts: [] } }))
    const before = stub.call.mock.calls.length
    await stub.tick()
    expect(stub.call.mock.calls.length).toBeGreaterThan(before)
  })
})
