/**
 * The shape of a field row.
 *
 * A screenshot of the settings card showed a value and a button sharing the right
 * edge (`…更新于 00:59 刷新模型列表`), and a fact that was a *property* of another
 * fact sitting in a row of its own. Both are geometry, so they are pinned as
 * geometry here: `src/client/field.tsx` states the rule in prose, and this file
 * makes a regression fail rather than wait for the next screenshot.
 *
 * Class names arrive hashed (`_fieldAction_9b3621`), so the matcher compares
 * whole tokens rather than substrings — `field` is a prefix of `fieldAction`,
 * `fieldText` and `fieldHint`, and a substring test would match all four.
 */

import { createElement, type ReactElement } from 'react'
import { act } from 'react-test-renderer'
import type { ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it } from 'vitest'
import { Field, Figure } from '../../src/client/field.tsx'
import { bareStrings, byClass, subtreeText, textOf, useTree } from './harness.ts'

const box = useTree()

/** Mount a tree, replacing whatever the previous case rendered. */
async function render(node: ReactElement): Promise<ReactTestRenderer> {
  let made: ReactTestRenderer | undefined
  await act(async () => {
    made = (await import('react-test-renderer')).create(node)
  })
  box.view = made
  return made!
}

describe('field row', () => {
  it('puts the text on the left and the control alone on the right', async () => {
    const view = await render(
      createElement(Field, {
        label: 'Sign-in',
        value: 'Signed in',
        action: createElement('button', null, 'Refresh'),
      }),
    )
    // Two columns, text first — the order is the rule, not an accident of markup.
    const row = byClass(view, 'field')[0]!
    expect(row.children).toHaveLength(2)
    const text = byClass(view, 'fieldText')
    const action = byClass(view, 'fieldAction')
    expect(text).toHaveLength(1)
    expect(action).toHaveLength(1)
    expect(row.children[0]).toBe(text[0])
    expect(row.children[1]).toBe(action[0])
    // The control's column carries the control and nothing else. Text here is
    // the defect: it is what put `刷新模型列表` against the provenance line.
    expect(bareStrings(action[0]!)).toEqual([])
    expect(action[0]!.findAllByType('button')).toHaveLength(1)
    expect(subtreeText(action[0]!)).toBe('Refresh')
    // The texts stayed behind in the other column.
    expect(textOf(view)).toContain('Sign-in')
    expect(textOf(view)).toContain('Signed in')
  })

  it('renders no right column when the fact has no action', async () => {
    // An empty column would reserve the right edge and leave the row's text
    // looking indented — the visual cousin of the orphan button this replaces.
    const view = await render(createElement(Field, { label: 'Total', value: '3,256' }))
    expect(byClass(view, 'field')[0]!.children).toHaveLength(1)
    expect(byClass(view, 'fieldAction')).toEqual([])
  })

  it('renders no label line when the value names itself', async () => {
    /*
     * A label earns its line only by saying something the value does not. This
     * is not a cosmetic option: `label` was required at first, so deleting the
     * account block's heading left the word `Account` on screen anyway — a field
     * label renders on its own line exactly as the heading had (2026-10-02).
     */
    const view = await render(
      createElement(Field, {
        value: 'Signed in as 阿七',
        hint: createElement(Figure, { label: 'Expires', children: '2026-11-26 17:40' }),
        action: createElement('button', null, 'Refresh'),
      }),
    )
    expect(byClass(view, 'fieldLabel')).toEqual([])
    // The rest of the row is unchanged: value, then hint, beside the control.
    expect(textOf(view)).toBe('Signed in as 阿七 Expires 2026-11-26 17:40 Refresh')
    const text = byClass(view, 'fieldText')[0]!
    expect(text.children).toHaveLength(2)
  })

  it('keeps label, value and hint in that order', async () => {
    const view = await render(
      createElement(Field, {
        label: 'Sign-in',
        value: 'Signed in',
        hint: createElement(Figure, { label: 'Expires', children: '2026-11-26 17:40' }),
      }),
    )
    const column = byClass(view, 'fieldText')[0]!
    const order = ['fieldLabel', 'fieldValue', 'fieldHint'].map((name) =>
      column.children.findIndex((child) => child === byClass(view, name)[0]),
    )
    expect(order).toEqual([0, 1, 2])
  })

  it('holds a figure together with its caption', async () => {
    // The pair is one inline-flex unit, so a narrow card wraps both onto the
    // next line instead of splitting the caption from the number it introduces.
    const view = await render(
      createElement(Figure, { label: 'Expires', children: '2026-11-26 17:40' }),
    )
    const figure = byClass(view, 'figure')
    expect(figure).toHaveLength(1)
    expect(bareStrings(figure[0]!)).toEqual([])
    expect(textOf(view)).toBe('Expires 2026-11-26 17:40')
    // The figure itself is the element that must align; the caption is not.
    expect(byClass(view, 'fieldFigure')).toHaveLength(1)
  })
})
