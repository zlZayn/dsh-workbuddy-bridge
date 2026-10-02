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
  /** The static name of the fact. Two or three words; a label that restates its value is prose. */
  label: string
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
        <span className={css.fieldLabel}>{label}</span>
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
