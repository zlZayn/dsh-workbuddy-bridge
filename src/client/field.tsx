/**
 * The card's field row, in one place.
 *
 * Every block in the settings card is a stack of *facts*: the account's state and
 * when it expires, which catalog the model list came from, the credit total and
 * its reset. All of them render as the same object — a name, its value beneath,
 * an optional grey line, and at most one control on the right — which is the
 * host's own field geometry (`ui-primitives/lib/settings-form/fields.module.css`).
 *
 * **Why this is a module and not markup at each call site.** It was markup at
 * each call site first, and the geometry drifted: the account block ended up with
 * a value and a button sharing the right edge, and a fact that was a *property*
 * of another fact (a session's expiry) got a row and a rule of its own. Both were
 * visible in one screenshot. A primitive makes the right shape the default, so
 * departing from it has to be deliberate rather than accidental.
 *
 * Two rules the shape encodes, each learned from that screenshot:
 *
 * - **The right column holds a control, never text.** Text and a button on the
 *   same side compete for one glance and end up literally adjacent
 *   (`…更新于 00:59 刷新模型列表`), which is neither a sentence nor a table.
 * - **Machine output is its own element.** A timestamp is not prose: it gets
 *   {@link Figure} so it is set in `tabular-nums` (it stops shifting when a read
 *   refreshes it) and stays typographically distinct from the copy around it.
 *
 * @module dsh-workbuddy-bridge/client/field
 */

import type { ReactNode } from 'react'
import css from './workbuddy.module.css'

/** One labelled fact. */
export interface FieldProps {
  /**
   * The name of the fact, when it needs one.
   *
   * **Omit it when the value names itself.** A label earns its line only by
   * adding something the value does not already say: `Account` over
   * `Signed in as 阿七` was the same fact a third time, under a card header that
   * already said it (2026-10-02 — the heading was deleted, and then the word had
   * to go too, because a field label renders on its own line just like the
   * heading did). Compare `Model list` over `Live from the app`, which the value
   * cannot be read without.
   */
  label?: string
  /** The value. Wrap a figure in {@link Figure} when it has a caption. */
  value?: ReactNode
  /** The grey tier under the value: a {@link Figure}, a static note, or several of either. */
  hint?: ReactNode
  /** The one control this fact owns. Omitted when the fact has no action. */
  action?: ReactNode
}

/**
 * Render one fact as a field row.
 *
 * @param props - see {@link FieldProps}.
 */
export function Field({ label, value, hint, action }: FieldProps): ReactNode {
  return (
    <div className={css.field}>
      <div className={css.fieldText}>
        {label === undefined ? null : <span className={css.fieldLabel}>{label}</span>}
        {value === undefined ? null : <span className={css.fieldValue}>{value}</span>}
        {hint === undefined ? null : <span className={css.fieldHint}>{hint}</span>}
      </div>
      {action === undefined ? null : <div className={css.fieldAction}>{action}</div>}
    </div>
  )
}

/** A caption and the figure it names, kept together when the line wraps. */
export interface FigureProps {
  /** What the figure is, e.g. "Expires". */
  label: string
  /** The figure itself. Set in `tabular-nums`; never a sentence. */
  children: ReactNode
}

/**
 * Render a caption with its figure: `Expires 2026-11-26 17:40`.
 *
 * The two are one inline-flex unit rather than two loose nodes, so a narrow card
 * wraps the pair onto the next line instead of splitting the caption from the
 * number it introduces.
 *
 * @param props - see {@link FigureProps}.
 */
export function Figure({ label, children }: FigureProps): ReactNode {
  return (
    <span className={css.figure}>
      <span>{label}</span>
      <span className={css.fieldFigure}>{children}</span>
    </span>
  )
}
