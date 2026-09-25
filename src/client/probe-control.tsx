/**
 * Per-model reasoning-effort entry beside the Composer's model selector.
 *
 * It is **only an icon** — no inline text. The composer row is shared with the
 * host's own model picker, and a word here competes with the model name for the
 * same glance while adding nothing: the verified levels already appear in the
 * model dropdown (the adapter exposes them as selectable efforts). What the
 * control offers is an *action*, so it is drawn like the other icon-only
 * buttons in this chrome, and its meaning lives in the tooltip and the
 * accessible name.
 *
 * Styling follows `dsh-ds-balance`'s popover button, which copies the host's own
 * sidebar `.iconButton` (28px circle, `--dsw-alias-label-secondary` icon on a
 * transparent background, `--dsw-alias-interactive-bg-hover` on hover). The
 * artwork strokes `currentColor`, so light and dark themes are handled by the
 * token rather than by two sets of colours — no `[data-ds-dark-theme]` selector
 * and no hard-coded colour anywhere.
 *
 * - a **hover/focus tooltip** carries the state and the click's purpose, and is
 *   also the button's `aria-label`.
 * - the **confirmation** is a popover anchored to the control, not a
 *   `window.confirm`. Probing spends real credit, so a confirmation stays — but
 *   it belongs next to the thing it acts on.
 *
 * The popover surface follows `dsh-ds-balance`'s balance popover, which itself
 * copies the host's own stat dialog: a portal to `document.body`, positioned by
 * the host's `useAnchoredPosition`, dismissed by the host's
 * `useDismissOnOutsidePointer`, skinned with `--dsw-specific-menu` plus
 * `--dsw-menu-backdrop-filter` (the pair the host requires together — fill
 * alone is "translucent but not frosted").
 *
 * **The filter must not sit on the panel itself**: a non-`none`
 * `backdrop-filter` makes the element the containing block for its fixed
 * descendants, and this panel contains non-portal `Tooltip` bubbles. The fill
 * and the filter therefore live on an isolated `::before`, exactly as the host
 * does it.
 *
 * @module dsh-workbuddy-bridge/client/probe-control
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Button,
  IconCloseOutlineRegular,
  IconThinkOutlineRegular,
  Tooltip,
  useAnchoredPosition,
  useDismissOnOutsidePointer,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { cardVariantFor } from './variants.ts'
import type { WorkBuddyCardVariant } from './variants.ts'
import { isWorkBuddyWebStatus } from './status-document.ts'
import type { WorkBuddyTranslate } from './locales.ts'
import type { WorkBuddyWebProbeModel, WorkBuddyWebStatus } from '../shared/paths.ts'
import css from './probe-control.module.css'

/** Injected props; `directory` resolves the session's current model selection. */
export interface WorkBuddyProbeControlProps {
  directory: ModelDirectory['store']
  t: WorkBuddyTranslate
}

/** How often the control re-checks state when the window regains focus. */
const RECONCILE_MS = 60_000

/**
 * What the popover renders on its first frame: positioned but invisible, so the
 * anchor hook can measure it before deciding where it really goes. Copied
 * verbatim from the host's stat dialog via `dsh-ds-balance`.
 */
const MEASURE_STYLE: CSSProperties = { visibility: 'hidden', left: 0, top: 0 }

/** Gap between the control and the popover, and the viewport margin it keeps. */
const POPOVER_GAP = 8
const POPOVER_MARGIN = 12

/** Pick the model's recorded observation out of the probe section. */
function resultFor(status: WorkBuddyWebStatus, model: string): WorkBuddyWebProbeModel | undefined {
  if (status.status !== 'signed-in') return undefined
  return status.probe?.results.find(result => result.id === model)
}

/**
 * The one-line tooltip: current state first, then what a click does — the same
 * two-part shape Fast Mode uses.
 *
 * A recorded result outranks a remembered failure. `failed` only means "the last
 * run from this control did not complete"; the host can record a result for the
 * same model at any time (a detection started from the settings card, another
 * conversation, or a finished sweep), and the levels the user paid for are the
 * more useful answer than the stale failure. Failure copy is what remains when
 * there is no result to report.
 */
function tooltipText(
  t: WorkBuddyTranslate,
  model: string,
  state: { busy: boolean; failed: boolean; result?: WorkBuddyWebProbeModel | undefined },
): string {
  if (state.busy) return t('probeRunning', { model })
  const result = state.result
  if (result !== undefined) {
    if (result.validation === 'validating' && result.efforts.length > 0) {
      return t('probeTooltipVerified', { levels: result.efforts.join(' / ') })
    }
    if (result.validation === 'non-validating') return t('probeTooltipNotValidating')
    return t('probeTooltipRetry')
  }
  return state.failed ? t('probeTooltipRetry') : t('probeTooltipIdle', { model })
}

/** Compose the one-line outcome string the note bubble shows. */
function noteText(t: WorkBuddyTranslate, result: WorkBuddyWebProbeModel): string {
  if (result.validation === 'validating' && result.efforts.length > 0) {
    return t('probeNoteVerified', { levels: result.efforts.join(' / ') })
  }
  return t(result.validation === 'non-validating' ? 'probeNoteNotValidating' : 'probeNoteUnknown')
}

/** Model-independent shell: resolves the selection, then delegates per model. */
export function WorkBuddyProbeControl({ directory, t }: WorkBuddyProbeControlProps): ReactNode {
  const subscribe = useCallback((listener: () => void) => directory.subscribe(listener), [directory])
  const snapshot = useCallback(() => directory.getSnapshot(), [directory])
  const selection = useSyncExternalStore(subscribe, snapshot, snapshot).current
  const card = selection === undefined ? undefined : cardVariantFor(selection.provider)
  // `card` identifies both the variant and its routes: a selection under either
  // provider resolves to exactly one card's status/probe pair, so the control
  // can never read one variant's state while probing the other.
  if (card === undefined || selection === undefined) return null
  // A new selection gets fresh state; a late response cannot target the new model.
  return <ModelProbe key={`${card.id}:${selection.model}`} model={selection.model} card={card} t={t} />
}

function ModelProbe({ model, card, t }: {
  model: string
  card: WorkBuddyCardVariant
  t: WorkBuddyTranslate
}): ReactNode {
  const [status, setStatus] = useState<WorkBuddyWebStatus>()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [failed, setFailed] = useState(false)
  // Only an explicit detection response opens a note. Background reads and
  // remounts never replay stored results; no persisted "seen" marks are needed.
  const [note, setNote] = useState<WorkBuddyWebProbeModel>()
  const inFlight = useRef(false)
  const mounted = useRef(false)
  const readSeq = useRef(0)
  /** The control itself: the popover's anchor and the "inside" test for dismissal. */
  const rootRef = useRef<HTMLSpanElement>(null)
  /**
   * The panel, portalled to `document.body` so it is not clipped by the composer
   * row. It is measured by the anchor hook and passed to the outside-pointer test,
   * which would otherwise read a click on the panel as a click outside it.
   */
  const panelRef = useRef<HTMLElement>(null)

  const refresh = useCallback(async (signal?: AbortSignal): Promise<void> => {
    const seq = ++readSeq.current
    const response = await fetch(card.statusPath, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      ...signal === undefined ? {} : { signal },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    /*
     * A 200 does not promise a status document: the body may be empty, literal
     * `null`, or a non-JSON page. Storing that unchecked would put a value in
     * state that `resultFor` dereferences on the next render, so it is validated
     * here with the same predicate the settings card uses. A rejection is left to
     * the callers below, which already degrade quietly.
     */
    const value: unknown = await response.json().catch(() => undefined)
    if (!isWorkBuddyWebStatus(value)) throw new Error(t('statusResponseInvalid'))
    if (mounted.current && signal?.aborted !== true && seq === readSeq.current) setStatus(value)
  }, [card.statusPath, t])

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    const load = (): void => {
      void refresh(controller.signal).catch(() => { /* the icon still works without state */ })
    }
    load()
    // Reconcile detections performed in another conversation or in the card.
    const timer = window.setInterval(load, RECONCILE_MS)
    window.addEventListener('focus', load)
    return () => {
      mounted.current = false
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [refresh])

  const probe = status?.status === 'signed-in' ? status.probe : undefined
  const key = status?.status === 'signed-in' ? status.probeKey : undefined
  const result = status === undefined ? undefined : resultFor(status, model)
  const eligible = probe?.candidates.includes(model) === true
  // Once a model has been detected it leaves the candidate list, so keep the
  // entry visible for it: that is the case the tooltip reports a result in.
  const visible = eligible || result !== undefined

  // A recorded result answers the question a remembered failure was about, so
  // the flag is dropped with it rather than lingering into the next render.
  useEffect(() => {
    if (result !== undefined) setFailed(false)
  }, [result])

  // A selection change must not strand an open bubble.
  useEffect(() => { setConfirming(false); setNote(undefined) }, [model])

  const detect = async (): Promise<void> => {
    if (key === undefined || inFlight.current || probe?.running === true) return
    inFlight.current = true
    setNote(undefined)
    setConfirming(false)
    setBusy(true)
    setFailed(false)
    try {
      const response = await fetch(card.probePath, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-WorkBuddy-Probe-Key': key },
        body: JSON.stringify({ action: 'probe', model }),
      })
      const body = await response.json() as {
        state?: string; validation?: string; efforts?: unknown
      }
      if (!response.ok || body.state !== 'ok'
        || (body.validation !== 'validating' && body.validation !== 'non-validating')
        || !Array.isArray(body.efforts) || !body.efforts.every(effort => typeof effort === 'string')) {
        throw new Error('probe failed')
      }
      // This response belongs to the explicit click, even when the host reused
      // an older cached result. Do not wait for /status (which fetches credit),
      // or infer completion from wall-clock timestamps and background polls.
      if (mounted.current) {
        setNote({
          id: model, name: model, validation: body.validation as WorkBuddyWebProbeModel['validation'],
          efforts: body.efforts as string[], probedAt: Date.now(),
        })
      }
      void refresh().catch(() => { /* Credit/status failure does not undo a completed probe. */ })
    } catch {
      if (mounted.current) setFailed(true)
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const open = confirming || note !== undefined

  // Both hooks live above the `visible` early return: hooks may not be skipped,
  // and a control that comes and goes with the selection must keep a stable
  // hook order across renders.
  const position = useAnchoredPosition({
    open,
    anchorRef: rootRef,
    panelRef,
    side: 'top',
    gap: POPOVER_GAP,
    margin: POPOVER_MARGIN,
  })
  // The panel is portalled, so it is no longer a DOM descendant of the anchor:
  // without `panelRef` a click inside the panel would count as "outside" and
  // close it.
  useDismissOnOutsidePointer(
    rootRef,
    open,
    () => { setConfirming(false); setNote(undefined) },
    panelRef,
  )

  if (!visible) return null

  const text = tooltipText(t, model, { busy, result, failed })
  const disabled = busy || probe?.running === true || key === undefined
  // The confirmation and the result note both suppress the tooltip: leaving it
  // visible would overlap them, and the note already states the same outcome.
  return (
    <span className={css.wrapper} ref={rootRef}>
      <Tooltip label={text} side="top" portal disabled={confirming || note !== undefined}>
        <button
          type="button"
          className={css.trigger}
          aria-label={text}
          aria-busy={busy}
          aria-expanded={confirming}
          disabled={disabled}
          onClick={() => { setConfirming(true) }}
        >
          <ProbeIcon />
        </button>
      </Tooltip>

      {/* Closed means unmounted: a panel left in the DOM is a `position: fixed`
          hit-testing box that would sit over the composer after it closed. */}
      {open
        ? createPortal(
          <section
            ref={panelRef}
            className={css.panel}
            style={position ?? MEASURE_STYLE}
            role="dialog"
            aria-label={confirming ? t('probeLabel') : t('probeNoteTitle')}
          >
            <div className={css.panelTitle}>
              <span className={css.panelTitleIcon}><ProbeIcon /></span>
              <span className={css.panelTitleText}>{model}</span>
              <button
                type="button"
                className={css.iconButton}
                aria-label={t('probeNoteDismiss')}
                onClick={() => { setConfirming(false); setNote(undefined) }}
              >
                <IconCloseOutlineRegular size={16} />
              </button>
            </div>

            <div className={css.titleRule} aria-hidden />

            {confirming
              ? (
                <>
                  <p className={css.body}>{t('probeBubbleBody')}</p>
                  <div className={css.panelActions}>
                    <Button size="sm" variant="outline" onClick={() => { setConfirming(false) }}>
                      {t('cancel')}
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => { void detect() }}>
                      {t('probeConfirmAction')}
                    </Button>
                  </div>
                </>
              )
              : (
                <p className={css.body} role="status" aria-live="polite">
                  {note === undefined ? '' : noteText(t, note)}
                </p>
              )}
          </section>,
          document.body,
        )
        : null}
    </span>
  )
}

/**
 * The control's icon — the host's own reasoning glyph.
 *
 * Deliberately **not** a hand-drawn shape. Every icon in this chrome is one of
 * the host's, drawn on the same grid (16-unit viewBox, 1px stroke) with the same
 * `currentColor` convention, so borrowing the host's artwork is the only way to
 * land in the same visual language — anything original reads as foreign beside
 * the model picker it sits next to.
 *
 * `IconThinkOutlineRegular` is the host's semantic icon for reasoning, which is
 * exactly what this control acts on. It is exported from a package this plugin
 * already depends on, so it costs no new dependency edge.
 */
function ProbeIcon(): ReactNode {
  return <IconThinkOutlineRegular size={16} />
}
