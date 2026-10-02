/**
 * A boundary that keeps one panel's crash from taking the whole card.
 *
 * The host renders each slot under its own error boundary, and that boundary
 * **latches**: once a child throws, the region stays gone for the life of the
 * mount. The user's only way back is to disable and re-enable the plugin. So a
 * throw anywhere inside this card does not cost one panel — it costs the entire
 * configuration area (2026-10-02: `probe.models` was not an array, and switching
 * to the detection tab blanked everything below the plugin's own switch).
 *
 * React's rule is that an error boundary must be a **class** — `getDerivedStateFromError`
 * and `componentDidCatch` have no hook equivalent. That is the only reason this
 * file is not a function component.
 *
 * What it is *not*: a substitute for validating inputs. The boundary is the last
 * line of defence for the failure nobody predicted; the shape guard in
 * `status-document.ts` is what keeps malformed documents from getting this far.
 * Both exist because they fail differently — the guard degrades to "nothing to
 * show", the boundary degrades to "this block says it broke".
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkBuddyTranslate } from './locales.ts'
import css from './workbuddy.module.css'

/** Props: the copy to show on failure, plus whatever the boundary wraps. */
interface PanelBoundaryProps {
  /** Names the block in the fallback, so the user knows *what* broke. */
  label: string
  t: WorkBuddyTranslate
  children: ReactNode
}

interface PanelBoundaryState {
  /** The message of the error that was caught, or `undefined` while healthy. */
  message: string | undefined
}

/**
 * Catch a render error in one panel and render a local fallback instead.
 *
 * The fallback is deliberately plain: a block that broke cannot be trusted to
 * render its own recovery UI, and the one thing the user needs is a way to try
 * again — which is what `reset` gives, by clearing the caught error so the
 * children mount afresh.
 */
export class PanelBoundary extends Component<PanelBoundaryProps, PanelBoundaryState> {
  override state: PanelBoundaryState = { message: undefined }

  static getDerivedStateFromError(error: unknown): PanelBoundaryState {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    /*
     * Log rather than swallow. The fallback tells the user something broke; the
     * console is where the stack goes, and losing it would make this class of
     * failure undiagnosable from a bug report.
     */
    console.error(`dsh-workbuddy-bridge: ${this.props.label} failed to render`, error, info)
  }

  override render(): ReactNode {
    const { message } = this.state
    if (message === undefined) return this.props.children
    return (
      <div className={css.section} role="alert">
        <p className={css.error}>{this.props.t('panelCrashed', { panel: this.props.label })}</p>
        <p className={css.dim}>{message}</p>
        <div className={css.sectionActions}>
          <Button
            size="sm"
            onClick={() => {
              this.setState({ message: undefined })
            }}
          >
            {this.props.t('panelRetry')}
          </Button>
        </div>
      </div>
    )
  }
}
