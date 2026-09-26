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
 * What hovering the icon says: the levels this model accepts, when they are
 * known.
 *
 * The answer is the *result*, not the action — a user hovering a small glyph
 * beside the model picker is asking "what does this model support?", and the
 * action is what the panel they can open is for.
 *
 * A recorded result outranks a remembered failure: `failed` only means "the last
 * run from this control did not finish", and the host can record a result for
 * the same model at any time (a detection started from the settings card,
 * another conversation, or a finished sweep). The levels the user already paid
 * for are the better answer; failure copy is what remains when there is none.
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
      return t('probeTooltipLevels', { levels: result.efforts.join(' / ') })
    }
    if (result.validation === 'non-validating') return t('probeTooltipNotValidating')
    return t('probeTooltipFailed')
  }
  return state.failed ? t('probeTooltipFailed') : t('probeTooltipIdle', { model })
}

/** The levels this model accepts, as one line; undefined when there are none to show. */
function levelsLine(result: WorkBuddyWebProbeModel | undefined): string | undefined {
  if (result === undefined) return undefined
  if (result.validation === 'validating' && result.efforts.length > 0) return result.efforts.join(' / ')
  return undefined
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
  /**
   * Whether the panel is open.
   *
   * One flag, not a confirmation-plus-result pair: the panel shows the same
   * thing before and after a run (the levels, and the one button that gets
   * them), so there is no second state to model. Opening it is not a commitment
   * either — the button inside is.
   */
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  /**
   * The outcome of the run this control just performed.
   *
   * Kept so a fresh answer is shown immediately, without waiting for the next
   * status read; `result` from the document is what stands when there is none.
   */
  const [fresh, setFresh] = useState<WorkBuddyWebProbeModel>()
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
  useEffect(() => { setOpen(false); setFresh(undefined) }, [model])

  const detect = async (): Promise<void> => {
    if (key === undefined || inFlight.current || probe?.running === true) return
    inFlight.current = true
    setFresh(undefined)
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
        setFresh({
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
    () => { setOpen(false) },
    panelRef,
  )

  if (!visible) return null

  const text = tooltipText(t, model, { busy, result, failed })
  const disabled = busy || probe?.running === true || key === undefined
  // The freshly-answered result wins over the document's, so the panel the user
  // just acted in shows what the action produced rather than the older snapshot.
  const shown = fresh ?? result
  const levels = levelsLine(shown)
  const notValidating = shown?.validation === 'non-validating'
  /*
   * Whether the bulb is lit: a *recorded* outcome exists for this model.
   *
   * Keyed on the record, not on this render's click and not on the levels: a
   * `non-validating` answer is still an answer the user paid for, and it must
   * survive a remount, a selection change back to this model, and a status read
   * that arrives while the panel is closed. A remembered failure and a run in
   * flight are deliberately excluded — neither is a result, and the tooltip
   * already reports both.
   */
  const lit = shown !== undefined
  // The open panel already says everything the tooltip would, so it steps aside
  // rather than hovering over the thing it describes.
  return (
    <span className={css.wrapper} ref={rootRef}>
      <Tooltip label={text} side="top" portal disabled={open}>
        <button
          type="button"
          className={css.trigger}
          aria-label={text}
          aria-busy={busy}
          aria-expanded={open}
          disabled={disabled}
          onClick={() => { setOpen(!open) }}
        >
          <ProbeIcon lit={lit} />
        </button>
      </Tooltip>

      {/* Closed means unmounted: a panel left in the DOM is a `position: fixed`
          hit-testing box that would sit over the composer after it closed.

          There is no close button and no cancel: the panel explains one action and
          holds the one button that takes it, so the ways out are the ways out of
          any popover — click away, press Escape, or click the icon again. */}
      {open
        ? createPortal(
          <section
            ref={panelRef}
            className={css.panel}
            style={position ?? MEASURE_STYLE}
            role="dialog"
            aria-label={t('probeLabel')}
          >
            <div className={css.panelTitle}>
              <span className={css.panelTitleIcon}><ProbeIcon lit={lit} /></span>
              <span className={css.panelTitleText}>{model}</span>
            </div>

            <div className={css.titleRule} aria-hidden />

            <p className={css.levelsLabel}>{t('probePanelLevels')}</p>
            <p className={css.levels} role="status" aria-live="polite">
              {levels ?? t('probePanelNone')}
            </p>
            {notValidating ? <p className={css.dim}>{t('probePanelNotValidating')}</p> : null}
            {failed && shown === undefined ? <p className={css.dim}>{t('probePanelFailed')}</p> : null}

            {/* The cost note belongs to the action, so it steps aside once the
                levels are known and the button only repeats a run. */}
            {levels === undefined && !notValidating ? (
              <p className={css.note}>{t('probePanelNote')}</p>
            ) : null}

            <div className={css.panelActions}>
              <Button size="sm" variant="primary" disabled={disabled} onClick={() => { void detect() }}>
                {busy ? t('probePanelDetecting') : levels === undefined ? t('probePanelDetect') : t('probePanelRedetect')}
              </Button>
            </div>
          </section>,
          document.body,
        )
        : null}
    </span>
  )
}

/** The bulb's body — the maintainer's artwork, one filled path with the base cut out. */
const BULB_BODY = 'M496 64C681.6 64 832 208.896 832 387.648c0 124.544-73.152 232.704-180.352 286.784v24.256c0 6.912-0.64 13.76-1.856 20.288a56.32 56.32 0 0 1 20.672 20.416 54.848 54.848 0 0 1 7.552 27.712v37.312c0 29.312-23.04 53.312-52.288 55.808l-2.816 0.192h-23.04c0 54.976-46.336 99.584-103.424 99.584-57.024 0-103.296-44.544-103.296-99.584h-19.776l-2.24-0.128h-3.84a58.24 58.24 0 0 1-36.48-18.432 55.808 55.808 0 0 1-14.72-37.44v-37.312c0-20.16 11.008-37.888 27.328-47.744a104.064 104.064 0 0 1-1.984-20.672v-23.744C233.6 621.056 160 512.576 160 387.584 160.064 208.96 310.4 64 496 64z m-45.632 796.288c0 24.064 20.48 43.712 46.08 43.712 25.728 0 46.144-19.712 46.208-43.52v-0.192H450.368z m-76.992-56h247.296l0.064-37.056-0.512-0.32H373.632l-0.256 37.376zM496 120.064c-154.112 0-278.656 120-278.656 267.52 0 100.8 58.624 191.68 150.208 237.44l31.104 15.68 0.064 50.56c0 3.968 0.384 7.552 0.896 10.816l0.576 1.984H467.84V704h70.4v-0.128l55.488-0.32 0.512-1.472c0.64-3.776 0.96-7.552 0.96-11.328l-0.96-50.56 31.04-15.616c91.2-45.952 149.312-136.576 149.312-236.992 0-147.584-124.544-267.648-278.656-267.648v0.128z'

/** The bolt drawn inside the bulb once a detection has landed. */
const BULB_BOLT = 'M465.536 443.264H396.8c-8.96 0-15.168-8.192-11.968-15.872l68.288-163.84a11.904 11.904 0 0 1 4.672-5.504A13.632 13.632 0 0 1 465.024 256h115.2c9.088 0 15.36 8.448 11.904 16.128L552.32 361.344H627.2c11.008 0 16.832 11.84 9.6 19.456L453.376 571.968c-8.96 9.28-25.472 1.28-22.016-10.752l34.176-117.952z'

/**
 * The control's icon: a light bulb, and the same bulb lit once a detection landed.
 *
 * Two states carry the whole story without a word:
 * - **bulb** — nothing verified yet; this is the model whose levels are still unknown.
 * - **bulb with the bolt** — a recorded result says which levels this model accepts.
 *
 * That is why the bolt is a second path rather than decoration: the trigger has to answer
 * "is this model checked?" at a glance, in 28px, next to the host's model picker — and the
 * panel that opens from it repeats the same glyph, so trigger, panel and result read as one
 * object. The artwork is the maintainer's bulb, redrawn on the host's 16-unit grid: ink spans
 * 2..14 vertically and 3.5..12.5 horizontally (the host's own icons keep a 6–9 inset), filled
 * with `currentColor` so both themes come from the button's colour alone — no literal colour,
 * no `[data-ds-dark-theme]` selector.
 *
 * The bolt appears only for a **successful** detection (`lit`), never while a run is in
 * flight and never for a failure: a spinner-shaped claim would be answered by the tooltip,
 * which already says exactly what happened.
 */
function ProbeIcon({ lit }: { lit: boolean }): ReactNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g transform="translate(1.35714 1.14286) scale(0.01339286)">
        <path d={BULB_BODY} fill="currentColor" fillRule="evenodd" />
        {/* The bolt is cut out of the bulb with the same even-odd rule: one filled path, so
            the hole is real glass rather than a second colour that would need a token. */}
        {lit ? <path d={BULB_BOLT} fill="currentColor" fillRule="evenodd" /> : null}
      </g>
    </svg>
  )
}