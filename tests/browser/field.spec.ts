/**
 * The shape of a field row — the card's one layout object.
 *
 * Every block is at most two lines, and the control rides the **first** one:
 * that is the host's own field (`fields.module.css`'s `.field` = a `.head` row
 * with the control in it, plus a `.hint` under it), and it is why a button never
 * drifts when the note below it grows.
 *
 * These are pinned as geometry because each of them was wrong on screen first: a
 * value and a button shared the right edge, a fact that belonged to another fact
 * got a row of its own, and a button sat under a list with nothing saying what it
 * cleared. `src/client/field.tsx` states the rules in prose; this file makes a
 * regression fail rather than wait for the next screenshot.
 *
 * Class names arrive hashed (`_fieldAction_9b3621`), so the matcher compares
 * whole tokens rather than substrings — `field` is a prefix of `fieldAction`,
 * `fieldText` and `fieldHint`.
 */

import { createElement, type ReactElement } from 'react'
import { act } from 'react-test-renderer'
import type { ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it } from 'vitest'
import { Field, Part } from '../../src/client/field.tsx'
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
  it('puts the control on the main line, beside the value', async () => {
    const view = await render(
      createElement(Field, {
        main: createElement(Part, { caption: 'Signed in as', children: '阿七' }),
        note: createElement(Part, { caption: 'Expires', children: '2026-11-26 17:40' }),
        action: createElement('button', null, 'Clear'),
      }),
    )
    const field = byClass(view, 'field')[0]!
    const head = byClass(view, 'head')[0]!
    // Two lines: the head row, then the note.
    expect(field.children).toHaveLength(2)
    expect(field.children[0]).toBe(head)
    expect(field.children[1]).toBe(byClass(view, 'note')[0])
    // The control is inside the head row — that is the whole point: a longer note
    // cannot move it, because the note is a sibling of the row it sits in.
    expect(byClass(head, 'action')).toHaveLength(1)
    expect(byClass(head, 'action')[0]!.findAllByType('button')).toHaveLength(1)
    expect(byClass(head, 'main')).toHaveLength(1)
  })

  it('renders no control row when the fact has no action', async () => {
    const view = await render(
      createElement(Field, { main: createElement(Part, { caption: 'Detected' }) }),
    )
    expect(byClass(view, 'action')).toEqual([])
    // And no note line either — an empty second line would be blank space that
    // reads as a missing value.
    expect(byClass(view, 'note')).toEqual([])
    expect(byClass(view, 'head')[0]!.children).toHaveLength(1)
  })

  it('tiers a part as caption, value, caption', async () => {
    // `已检测 7 个模型`: the words are grey, the number is the thing the eye
    // lands on. Order matters as much as the tiers — `after` would read as part
    // of the next line otherwise.
    const view = await render(
      createElement(Part, { caption: 'Detected', after: 'models', children: 7 }),
    )
    const captions = byClass(view, 'caption')
    expect(captions).toHaveLength(2)
    expect(subtreeText(captions[0]!)).toBe('Detected')
    expect(subtreeText(captions[1]!)).toBe('models')
    const figure = byClass(view, 'figure')
    expect(figure).toHaveLength(1)
    expect(subtreeText(figure[0]!)).toBe('7')
    // Reading order, which is what the DOM order has to produce.
    expect(textOf(view)).toBe('Detected 7 models')
  })

  it('renders a caption with no value as the grey sentence it is', async () => {
    // The note under the detection list is one sentence and no value; it must not
    // be wrapped in the value tier, or it would compete with the count above it.
    const view = await render(createElement(Part, { caption: 'Detecting costs a little credit.' }))
    expect(byClass(view, 'figure')).toEqual([])
    expect(subtreeText(byClass(view, 'caption')[0]!)).toBe('Detecting costs a little credit.')
  })

  it('drops an empty trailing word instead of leaving a gap', async () => {
    // English says "Detected 7" and needs no noun; a blank caption would still
    // take a slot in the flex row and open a gap that reads as a missing word.
    const view = await render(createElement(Part, { caption: 'Detected', after: '', children: 7 }))
    expect(byClass(view, 'caption')).toHaveLength(1)
    expect(bareStrings(view.root)).not.toContain('')
  })
})
