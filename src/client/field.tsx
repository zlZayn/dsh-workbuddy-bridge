/**
 * The card's field row, in one place.
 *
 * Every block in the settings card is the same object, and the object is the
 * host's own field (`ui-primitives/lib/settings-form/fields.module.css`):
 *
 * ```text
 *   .field   { flex-direction: column; gap: 6px }      ← 块内两行
 *   .head    { display: flex; align-items: center; gap: 8px }   ← 第一行
 *   .label   { flex: 1; min-width: 0 }                  ← 主值占满，控件靠右
 *   .hint    { font-size: 12px; color: label-tertiary } ← 第二行
 * ```
 *
 * So a block is at most two lines — main value plus an optional control on the
 * first, an optional note on the second — and the control rides the *first*
 * line, which is what the host's `.head` does with its input.
 *
 * **Where this departs from the host.** The host's `.label` is one string in one
 * tier. Ours interleaves two: the static words around a value (`已登录`,
 * `更新于`) sit at the host's `.hint` tier, and the value itself at the host's
 * `.label` tier. There is no host rule for that mixture, so it is mapped onto the
 * host's two existing tiers rather than invented — {@link Part} is the mapping.
 *
 * **Why this is a module and not markup at each call site.** It was markup at
 * each call site first, and the geometry drifted: a value and a button ended up
 * sharing the right edge, and a fact that was a *property* of another fact got a
 * row of its own. Both were visible in one screenshot.
 *
 * @module dsh-workbuddy-bridge/client/field
 */

import type { ReactNode } from 'react'
import css from './workbuddy.module.css'

/** One field row. */
export interface FieldProps {
  /** The first line's left side, composed from {@link Part}s. */
  main: ReactNode
  /** The second line, when the fact has one: a {@link Part}, or plain grey copy. */
  note?: ReactNode
  /** The control on the first line's right edge. Omitted when the fact has no action. */
  action?: ReactNode
}

/**
 * Render one fact: a main line with an optional control, and an optional note.
 *
 * @param props - see {@link FieldProps}.
 */
export function Field({ main, note, action }: FieldProps): ReactNode {
  return (
    <div className={css.field}>
      <div className={css.head}>
        <div className={css.main}>{main}</div>
        {action === undefined ? null : <div className={css.action}>{action}</div>}
      </div>
      {note === undefined ? null : <div className={css.note}>{note}</div>}
    </div>
  )
}

/** A caption, the value it frames, and an optional trailing word. */
export interface PartProps {
  /** Static words before the value — grey, at the host's hint tier. */
  caption?: string
  /**
   * The value the caption frames — normal ink, one step heavier.
   *
   * Rendered as its own element, never interpolated into the caption: a timestamp
   * is machine output, and a sentence containing one changes shape with the
   * locale (`2026年11月26日 17:40` / `Nov 26, 2026, 5:40 PM`).
   */
  children?: ReactNode
  /**
   * Static words after the value (`已检测 7 个模型`). Grey, like the caption.
   *
   * An empty string renders nothing rather than an empty span: a locale that
   * needs no trailing word (English's "Detected 7") would otherwise leave a flex
   * slot's worth of gap, which reads as a missing word rather than as none.
   */
  after?: string
}

/**
 * Render one line of tiered text: `caption value after`.
 *
 * Omit `children` for a line that is pure copy — a caption alone renders as the
 * grey sentence it is, which is how the note under the detection list works.
 *
 * @param props - see {@link PartProps}.
 */
export function Part({ caption, children, after }: PartProps): ReactNode {
  return (
    <span className={css.part}>
      {caption === undefined || caption === '' ? null : (
        <span className={css.caption}>{caption}</span>
      )}
      {children === undefined ? null : <span className={css.figure}>{children}</span>}
      {after === undefined || after === '' ? null : <span className={css.caption}>{after}</span>}
    </span>
  )
}
