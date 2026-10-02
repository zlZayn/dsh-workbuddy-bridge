/**
 * The variant card: what it shows before the first answer, and what a failed
 * read may and may not do to what is already on screen.
 *
 * These rules were each a real defect before they were written down: a failed
 * read used to blank the card, the newest read used to lose to a slow older
 * one, and a failed read used to disarm the poll that would have fixed it.
 */

import { createElement } from 'react'
import { act } from 'react-test-renderer'
import type { ReactTestInstance } from 'react-test-renderer'
import { describe, expect, it } from 'vitest'
import { WorkBuddyCard } from '../../src/client/WorkBuddyCard.tsx'
import {
  AI_CARD_VARIANT,
  CN_CARD_VARIANT,
  type WorkBuddyCardVariant,
} from '../../src/client/variants.ts'
import { formatTime as formatCardTime } from '../../src/client/format.ts'
import {
  buttonLabels,
  byClass,
  clickText,
  expandDisclosure,
  signedIn,
  t,
  textOf,
  useBrowserStubs,
  useTree,
} from './harness.ts'

const stub = useBrowserStubs()
const box = useTree()

/**
 * The host elements sitting between a node and an ancestor, exclusive.
 *
 * Composite elements (`Field`, `CreditsPanel`) are skipped on purpose: they
 * render no box of their own, so only a host element in between can take a flex
 * item's place in the layout.
 */
function hostElementsBetween(node: ReactTestInstance, ancestor: ReactTestInstance): string[] {
  const between: string[] = []
  for (
    let current = node.parent;
    current !== null && current !== ancestor;
    current = current.parent
  ) {
    if (typeof current.type === 'string') between.push(current.type)
  }
  return between
}

/** Mount a card, optionally expanded. */
async function mount(
  expanded: boolean,
  variant: WorkBuddyCardVariant = CN_CARD_VARIANT,
): Promise<void> {
  await act(async () => {
    box.view = (await import('react-test-renderer')).create(
      createElement(WorkBuddyCard, { variant, t }),
    )
  })
  // The whole header row is the toggle (`expandOnRowClick`), so expansion is a
  // row click — there is no separate leading <button> to find.
  if (expanded) await expandDisclosure(box.view!)
}

describe('WorkBuddy card', () => {
  it('reads on mount and names the signed-in account', async () => {
    stub.body = signedIn({ nickname: '阿七' })
    await mount(false)
    expect(textOf(box.view!)).toContain('阿七')
  })

  it('says it is still loading before the first answer, not that nobody is signed in', async () => {
    stub.call.mockImplementation(
      () =>
        new Promise(() => {
          /* never settles */
        }),
    )
    await mount(false)
    const text = textOf(box.view!)
    expect(text).toContain(t('loading'))
    expect(text).not.toContain(t('signedOut'))
  })

  it('keeps the document on screen when a later read fails', async () => {
    stub.body = signedIn({ nickname: '阿七' })
    await mount(true)
    // Make every subsequent read fail, then ask for one.
    stub.call.mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    await clickText(box.view!, t('refresh'))
    const text = textOf(box.view!)
    // The account is still named (in the collapsed status), and the failure is
    // stated beside the document — not in place of it. Blanking the card over one
    // transient error loses the credits and model list the reader was looking at.
    expect(text).toContain(t('statusRefreshFailed', { message: 'HTTP 500' }))
    // And the document's other lines are still on screen — only the failed read
    // is reported, nothing is blanked. The expiry is a *label plus a figure* now
    // rather than one interpolated sentence, so both are asserted: the label via
    // its key, the timestamp via the same formatter the card uses (a literal
    // date would be locale-dependent and red on the en runners).
    expect(text).toContain(t('sessionExpiryLabel'))
    expect(text).toContain(formatCardTime(Date.now() + 3_600_000))
  })

  it('lets the newest read win over a slower one started earlier', async () => {
    const resolvers: ((value: unknown) => void)[] = []
    let call = 0
    stub.call.mockImplementation(async () => {
      call += 1
      // The FIRST read is slow; the second answers immediately. If the slow one
      // were allowed to settle last it would restore the older document.
      if (call === 1)
        return new Promise((resolve) => {
          resolvers.push(resolve)
        })
      return {
        ok: true,
        json: async () =>
          signedIn({ nickname: '后来', expiresAt: Date.parse('2026-11-19T00:00:00Z') }),
      }
    })
    await mount(true)
    // A manual refresh starts read #2 while read #1 is still in flight.
    await clickText(box.view!, t('refresh'))
    await act(async () => {
      for (const resolve of resolvers)
        resolve({
          ok: true,
          json: async () =>
            signedIn({ nickname: '先前', expiresAt: Date.parse('2026-01-01T00:00:00Z') }),
        })
    })
    const text = textOf(box.view!)
    // The nickname lives in the collapsed status only; the expiry line is what
    // the expanded body renders, and it is what proves which read won. The date
    // is formatted with the card's own formatter, not a locale literal: a
    // hard-coded "11月19日" passed on a zh-CN workstation and failed on an
    // English CI runner, where the same Intl call yields "Nov 19".
    expect(text).toContain(formatCardTime(Date.parse('2026-11-19T00:00:00Z')))
    expect(text).not.toContain(formatCardTime(Date.parse('2026-01-01T00:00:00Z')))
  })

  it('keeps polling after a failed read', async () => {
    let calls = 0
    stub.call.mockImplementation(async () => {
      calls += 1
      return calls === 1
        ? { ok: false, status: 500, json: async () => ({}) }
        : { ok: true, json: async () => signedIn({ nickname: '阿七' }) }
    })
    await mount(false)
    expect(calls).toBe(1)
    // The poll's liveness follows the last SUCCESSFUL read, so a failure must
    // not disarm it — otherwise one blip leaves the card wrong until a restart.
    expect(stub.intervals).toBe(1)
    await stub.tick()
    expect(calls).toBe(2)
    expect(textOf(box.view!)).toContain('阿七')
  })

  it('stops asking once the account really is signed out', async () => {
    stub.body = { status: 'signed-out' }
    await mount(false)
    await stub.tick()
    // Signed-out is an answer, not a failure: there is nothing to retry, and
    // retrying a missing credential every minute is noise. The interval stays
    // armed so a later sign-in on the desktop is still picked up.
    expect(stub.call).toHaveBeenCalledTimes(1)
  })

  it('renders the AI variant against its own routes', async () => {
    await mount(false, AI_CARD_VARIANT)
    expect(stub.call.mock.calls[0]?.[0]).toBe(AI_CARD_VARIANT.statusPath)
  })

  it('offers a model-list refresh on the models tab, and nowhere else', async () => {
    /*
     * The refresh belongs to the model list, so it lives on the model list's own
     * tab. It used to sit in the account block above the tabs — reachable from
     * every tab, and reading as an action on the account.
     *
     * Both halves are asserted: present where it belongs, absent where it does
     * not. Only the first would pass with the button duplicated.
     */
    stub.body = signedIn({
      catalog: { source: 'live', fetchedAt: Date.now() },
      models: [{ id: 'hy3', name: 'HY3', contextWindow: 200_000 }],
    })
    await mount(true)
    // Not on the default (credits) tab.
    expect(buttonLabels(box.view!)).not.toContain(t('refreshModels'))
    await clickText(box.view!, t('tabModels'))
    expect(buttonLabels(box.view!)).toContain(t('refreshModels'))
    await clickText(box.view!, t('refreshModels'))
    expect(stub.posts).toHaveLength(1)
    expect(stub.posts[0]?.url).toBe(CN_CARD_VARIANT.probePath)
    expect(stub.posts[0]?.body).toContain('"refresh"')
  })

  it('exposes the three panels as real tabs', async () => {
    stub.body = signedIn({ models: [{ id: 'hy3', name: 'HY3', contextWindow: 200_000 }] })
    await mount(true)
    const labels = buttonLabels(box.view!)
    expect(labels).toContain(t('tabCredits'))
    expect(labels).toContain(t('tabModels'))
    expect(labels).toContain(t('tabProbe'))
    await clickText(box.view!, t('tabModels'))
    expect(
      box.view!.root.findAll((node) => node.type === 'div' && node.props.role === 'tabpanel'),
    ).toHaveLength(1)
  })

  it('shows credit once: the total and the per-package bars share the credits tab', async () => {
    stub.body = signedIn({
      credits: {
        total: 3767,
        cycleResetTime: '2026-10-01T00:00:00Z',
        accounts: [{ packageName: '个人套餐', remain: 2767, size: 10000 }],
      },
      models: [],
    })
    await mount(true)
    const { formatNumber } = await import('../../src/client/format.ts')
    const text = textOf(box.view!)
    // The total and the bars live on one tab; the old split (total under
    // "Status", bars under "Details") cannot reappear. The total is a field row
    // now, so label and figure are separate nodes — asserted separately, which
    // also pins that both halves survived the change.
    expect(text).toContain(t('creditsTotalLabel'))
    expect(text).toContain(formatNumber(3767))
    expect(text).toContain(
      t('exactRemaining', { remain: formatNumber(2767), size: formatNumber(10000) }),
    )
    // The old "Status" tab label asserted as a literal: the key was deleted, so
    // a typed key here would no longer compile — the literal is the guard.
    expect(buttonLabels(box.view!)).not.toContain('Status')
  })

  it('keeps a crashing panel from taking the rest of the card with it', async () => {
    /*
     * The 2026-10-02 report: switching to the detection tab made the whole
     * configuration area disappear, and only toggling the plugin brought it
     * back. The cause was a throw inside one panel reaching the *host's* error
     * boundary, which latches — so one bad panel cost every panel, the account
     * block, and the tabs.
     *
     * Getting this test to fail for the *right* reason took two attempts worth
     * recording. Feeding the card a malformed `probe` does **not** reach the
     * boundary: the shape guard rejects the document first, the card renders its
     * error state, and there are no tabs left to click (asserted separately in
     * tests/status-document.spec.ts). The boundary only matters for a crash the
     * guard cannot predict, so this test forces one from inside the panel by
     * making `efforts` a value the guard accepts as an array but the panel cannot
     * measure — an array-like proxy whose `length` throws.
     */
    const hostileEfforts = new Proxy([] as string[], {
      get(target, property, receiver) {
        if (property === 'length') throw new Error('boom')
        return Reflect.get(target, property, receiver) as unknown
      },
    })
    stub.body = signedIn({
      nickname: '阿七',
      probe: {
        consent: true,
        running: false,
        models: [{ id: 'glm-5.3', name: 'GLM-5.3', efforts: hostileEfforts, source: 'declared' }],
      },
      models: [{ id: 'hy3', name: 'HY3', contextWindow: 200_000 }],
    })
    await mount(true)
    await clickText(box.view!, t('tabProbe'))

    const text = textOf(box.view!)
    // The fallback names the block that broke, and carries the error's own
    // message so a bug report has something to quote.
    expect(text).toContain(t('panelCrashed', { panel: t('tabProbe') }))
    expect(text).toContain('boom')
    // ...and everything outside that block survives. That is the whole point:
    // before the boundary, this crash took the account block, the tabs, and
    // every other panel with it.
    expect(text).toContain(t('accountHeading'))
    // The card's own header and the refresh action are outside the boundary too.
    expect(text).toContain(t('refresh'))
    const labels = buttonLabels(box.view!)
    expect(labels).toContain(t('tabCredits'))
    expect(labels).toContain(t('tabModels'))
    expect(labels).toContain(t('tabProbe'))
    // Switching away shows the crashed panel did not poison the others: the
    // credits panel renders its total, which the probe panel's throw could not
    // reach.
    await clickText(box.view!, t('tabCredits'))
    const { formatNumber: fmt } = await import('../../src/client/format.ts')
    expect(textOf(box.view!)).toContain(t('creditsTotalLabel'))
    expect(textOf(box.view!)).toContain(fmt(100))
    await clickText(box.view!, t('tabModels'))
    expect(textOf(box.view!)).toContain('HY3')
  })

  it('anchors the detection panel’s clear action to the panel, not under the list', async () => {
    /*
     * The clear button used to sit in a right-aligned row *below* the bordered
     * list — the only thing under the box, with nothing on screen saying what it
     * clears (2026-10-02: "why is this button sitting there all by itself
     * underneath?"). It belongs on the panel's field row, beside the count it
     * acts on, which is also where the models panel keeps its refresh.
     */
    stub.body = signedIn({
      probe: {
        consent: true,
        running: false,
        models: [
          {
            id: 'hy3',
            name: 'HY3',
            efforts: ['low'],
            source: 'declared',
            detectable: true,
            probedAt: Date.now(),
          },
        ],
      },
    })
    await mount(true)
    await clickText(box.view!, t('tabProbe'))
    const view = box.view!
    // Scoped to this panel: the account block above the tabs has a field row of
    // its own, so an unscoped query would count both.
    const panel = view.root.findAll((node) => node.props.role === 'tabpanel')[0]!
    const field = byClass(panel, 'field')
    const list = byClass(panel, 'list')
    expect(field).toHaveLength(1)
    expect(list).toHaveLength(1)
    // The action lives inside the field row...
    expect(byClass(panel, 'fieldAction')[0]!.findAllByType('button')).toHaveLength(1)
    // ...and the field row comes before the list it acts on.
    const order = panel.findAll(
      (node) =>
        typeof node.type === 'string' &&
        String(node.props.className ?? '')
          .split(/\s+/)
          .some((token) => token.startsWith('_field_') || token.startsWith('_list_')),
    )
    expect(order[0]!.props.className).toContain('_field_')
    // The count it acts on is the field's dynamic value, so the button is
    // anchored to something that says how much there is to clear.
    expect(textOf(view)).toContain(t('probeDetectedCount', { count: 1 }))
    // The old orphan slot is gone from this panel entirely.
    expect(byClass(panel, 'sectionActions')).toEqual([])
  })

  it('offers no clear action when nothing has been detected', async () => {
    // With nothing recorded there is nothing to clear, so the row carries no
    // control at all — and therefore no empty right column either.
    stub.body = signedIn({
      probe: {
        consent: true,
        running: false,
        models: [{ id: 'hy3', name: 'HY3', efforts: [], source: 'none', detectable: true }],
      },
    })
    await mount(true)
    await clickText(box.view!, t('tabProbe'))
    const panel = box.view!.root.findAll((node) => node.props.role === 'tabpanel')[0]!
    expect(buttonLabels(box.view!)).not.toContain(t('probeClear'))
    expect(byClass(panel, 'fieldAction')).toEqual([])
    expect(textOf(box.view!)).toContain(t('probeDetectedNone'))
  })

  it('gives all three tabs the same fixed-height shell, with the list as its own child', async () => {
    /*
     * The three tabs have to be interchangeable boxes, or switching tabs
     * resizes the card — a jolt the eye reads as a layout bug (2026-10-02:
     * "can it just be a fixed height when switching, instead of twitching?").
     *
     * Two structural facts make that true, and neither is visible in a CSS file
     * alone:
     *
     * - the panel root carries `.panel`, the fixed height — so no tab is
     *   content-sized, whatever it happens to hold;
     * - the scroll region is that panel's **own** child, with no host element in
     *   between. `flex: 1` on it is what fills the height left over, and a
     *   wrapper `<div>` would become the flex item instead — which is exactly how
     *   the credits tab ended up three times its neighbours' height.
     *
     * "Own child" is checked by walking up rather than by comparing against
     * `panel.children`: that list holds the *composite* children (`Field`,
     * `CreditsPanel`), while the scroll region is a host `div`, so the two never
     * compare equal even when the markup is right.
     */
    stub.body = signedIn({
      credits: { total: 100, accounts: [{ packageName: '个人套餐', remain: 50, size: 100 }] },
      models: [{ id: 'hy3', name: 'HY3', contextWindow: 200_000 }],
      visibility: { account: 'uid', hidden: [] },
      probe: {
        consent: true,
        running: false,
        models: [
          { id: 'hy3', name: 'HY3', efforts: ['low'], source: 'declared', detectable: true },
        ],
      },
    })
    await mount(true)
    for (const tab of [t('tabCredits'), t('tabModels'), t('tabProbe')]) {
      if (tab !== t('tabCredits')) await clickText(box.view!, tab)
      const panel = box.view!.root.findAll((node) => node.props.role === 'tabpanel')[0]!
      expect(String(panel.props.className), `${tab} 没有用共用的面板壳`).toMatch(/_panel_/)
      const lists = byClass(panel, 'list')
      expect(lists, `${tab} 的滚动区不止一个`).toHaveLength(1)
      expect(
        hostElementsBetween(lists[0]!, panel),
        `${tab} 的滚动区被宿主元素包了一层，flex 填高会失效`,
      ).toEqual([])
    }
  })
})
