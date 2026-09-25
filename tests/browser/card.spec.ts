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
import { describe, expect, it } from 'vitest'
import { WorkBuddyCard } from '../../src/client/WorkBuddyCard.tsx'
import { AI_CARD_VARIANT, CN_CARD_VARIANT, type WorkBuddyCardVariant } from '../../src/client/variants.ts'
import { formatTime as formatCardTime } from '../../src/client/format.ts'
import { buttonLabels, clickText, expandDisclosure, signedIn, t, textOf, useBrowserStubs, useTree } from './harness.ts'

const stub = useBrowserStubs()
const box = useTree()

/** Mount a card, optionally expanded. */
async function mount(expanded: boolean, variant: WorkBuddyCardVariant = CN_CARD_VARIANT): Promise<void> {
  await act(async () => { box.view = (await import('react-test-renderer')).create(createElement(WorkBuddyCard, { variant, t })) })
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
    stub.call.mockImplementation(() => new Promise(() => { /* never settles */ }))
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
    // is reported, nothing is blanked. The expiry line is asserted via its key
    // with the same formatter the card uses, so a wording edit cannot desync it.
    expect(text).toContain(t('accessTokenExpires', { time: formatCardTime(Date.now() + 3_600_000) }))
  })

  it('lets the newest read win over a slower one started earlier', async () => {
    const resolvers: ((value: unknown) => void)[] = []
    let call = 0
    stub.call.mockImplementation(async () => {
      call += 1
      // The FIRST read is slow; the second answers immediately. If the slow one
      // were allowed to settle last it would restore the older document.
      if (call === 1) return new Promise(resolve => { resolvers.push(resolve) })
      return { ok: true, json: async () => signedIn({ nickname: '后来', expiresAt: Date.parse('2026-11-19T00:00:00Z') }) }
    })
    await mount(true)
    // A manual refresh starts read #2 while read #1 is still in flight.
    await clickText(box.view!, t('refresh'))
    await act(async () => {
      for (const resolve of resolvers) resolve({ ok: true, json: async () => signedIn({ nickname: '先前', expiresAt: Date.parse('2026-01-01T00:00:00Z') }) })
    })
    const text = textOf(box.view!)
    // The nickname lives in the collapsed status only; the expiry line is what
    // the expanded body renders, and it is what proves which read won.
    expect(text).toContain('11月19日')
    expect(text).not.toContain('1月1日')
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

  it('offers a model-list refresh that posts to this variant’s control route', async () => {
    stub.body = signedIn({ catalog: { source: 'live', fetchedAt: Date.now() } })
    await mount(true)
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
    expect(box.view!.root.findAll(node => node.type === 'div' && node.props.role === 'tabpanel')).toHaveLength(1)
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
    // "Status", bars under "Details") cannot reappear.
    expect(text).toContain(t('creditsTotal', { total: formatNumber(3767) }))
    expect(text).toContain(t('exactRemaining', { remain: formatNumber(2767), size: formatNumber(10000) }))
    // The old "Status" tab label asserted as a literal: the key was deleted, so
    // a typed key here would no longer compile — the literal is the guard.
    expect(buttonLabels(box.view!)).not.toContain('Status')
  })
})