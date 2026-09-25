/**
 * The card's three panels and the Agent assist block.
 *
 * Every control here is an official primitive (`Tag`, `Checkbox`, `Button`,
 * `Pill`), so the panels inherit the host theme and keyboard behaviour without
 * this plugin shipping a single hand-built widget.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Checkbox, Tag, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import { formatNumber, formatPercent, formatTime, formatTokens } from './format.ts'
import type { WorkBuddyLocaleKey, WorkBuddyTranslate } from './locales.ts'
import type { WorkBuddyCardVariant } from './variants.ts'
import type {
  WorkBuddySignedOutReasonCode, WorkBuddyWebCredits, WorkBuddyWebModelBadge,
  WorkBuddyWebProbeSection, WorkBuddyWebVisibilitySection,
} from '../shared/paths.ts'
import css from './workbuddy.module.css'

/**
 * The reason codes whose failures the Agent assist block covers: the plugin
 * cannot reach a decryption program, for any of the five reasons the host
 * reports.
 *
 * This is the *only* place the card decides whether the block applies. It
 * branches on the code, never on `reason` text: the prose is written for a
 * human and is expected to change, so matching it would silently stop matching
 * after any wording edit.
 *
 * `encrypted-credential-unreadable` is deliberately absent — the app was found
 * and ran, so "look for the app" is not the fix for it.
 */
const ASSIST_REASON_CODES: readonly WorkBuddySignedOutReasonCode[] = [
  'electron-binary-not-found',
  'electron-binary-ambiguous',
  'electron-binary-unavailable',
  'electron-path-invalid',
  'electron-discovery-incomplete',
]

/** Whether a reason code is one the assist block covers. */
export function assistCodeFor(
  reasonCode: WorkBuddySignedOutReasonCode | undefined,
): WorkBuddySignedOutReasonCode | undefined {
  return reasonCode !== undefined && ASSIST_REASON_CODES.includes(reasonCode) ? reasonCode : undefined
}

/** Locale key for one failure's summary inside the Agent prompt. */
function assistSummaryKey(
  code: WorkBuddySignedOutReasonCode,
  variant: WorkBuddyCardVariant,
): WorkBuddyLocaleKey {
  switch (code) {
    case 'electron-binary-not-found': return 'assistNotFound'
    case 'electron-binary-ambiguous': return 'assistAmbiguous'
    case 'electron-discovery-incomplete': return 'assistIncomplete'
    case 'electron-path-invalid': return 'assistPathInvalid'
    default: return variant.unavailableKey
  }
}

/**
 * Localize an upstream promotional badge label, with an unknown-badge fallback.
 *
 * The CN catalog spells badges in Chinese (`限时免费`, `夜间折扣`); the
 * international document carries English (`Free now`). Both are mapped so the
 * same promotion reads consistently in either UI language, and anything else
 * passes through verbatim — an unrecognized badge is still information the
 * upstream chose to show.
 */
function badgeLabel(badge: string, t: WorkBuddyTranslate): string {
  if (badge === '限时免费') return t('badgeLimitedFree')
  if (badge === '夜间折扣') return t('badgeNightDiscount')
  if (badge === 'Free now') return t('badgeFreeNow')
  return badge
}

/** One model's promotional badges, plus `Free` when the upstream says so. */
function ModelBadges({ model, t }: { model: WorkBuddyWebModelBadge; t: WorkBuddyTranslate }): ReactNode {
  return (
    <span className={css.badges}>
      {model.badges?.map(badge => <Tag key={badge} tone="success">{badgeLabel(badge, t)}</Tag>)}
      {model.free === true ? <Tag tone="success">{t('freeModel')}</Tag> : null}
    </span>
  )
}

/**
 * One billing package as a labelled progress bar.
 *
 * A package whose allowance the upstream never reported (`size` not positive)
 * has no percentage to state. It must not fall back to 100%: the plugin would
 * be claiming a full quota it knows nothing about, which is the opposite of the
 * honest "remaining N" line printed below it. Unknown size therefore renders the
 * percent slot as unknown copy and an unfilled, indeterminate track.
 */
function CreditBar({ label, remain, size, unlimited, t }: {
  label: string
  remain: number
  size: number
  unlimited?: true | undefined
  t: WorkBuddyTranslate
}): ReactNode {
  const quota = t('unlimitedQuota')
  if (unlimited === true) {
    return (
      <div className={css.package}>
        <div className={css.packageLabel}><span>{label}</span><span>{quota}</span></div>
        {/*
          * "Uncapped" is not "100% remaining", so the range attributes are
          * omitted and no fill is drawn: an uncapped quota has no proportion
          * to state, and a full bar would assert one.
          */}
        <div className={css.track} role="progressbar" aria-label={label} aria-valuetext={quota} />
      </div>
    )
  }
  const sizeKnown = size > 0
  const detail = sizeKnown
    ? t('exactRemaining', { remain: formatNumber(remain), size: formatNumber(size) })
    : t('creditPackageUnknownSize', { remain: formatNumber(remain) })
  const percent = sizeKnown ? (remain / size) * 100 : undefined
  return (
    <div className={css.package}>
      <div className={css.packageLabel}>
        <span>{label}</span>
        <span>{percent === undefined ? t('percentUnknown') : t('percentRemaining', { percent: formatPercent(percent) })}</span>
      </div>
      {/*
        * No numeric value when the size is unknown: the range attributes are
        * omitted so assistive technology reports an indeterminate bar rather
        * than a second, louder repeat of the false 100%.
        */}
      <div
        className={css.track}
        role="progressbar"
        aria-label={label}
        {...percent === undefined
          ? { 'aria-valuetext': detail }
          : { 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent }}
      >
        {percent === undefined ? null : <div className={css.fill} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />}
      </div>
    </div>
  )
}

/** The per-package credit breakdown. */
export function CreditsPanel({ credits, t }: { credits: WorkBuddyWebCredits; t: WorkBuddyTranslate }): ReactNode {
  return (
    <div className={css.section}>
      <h4 className={css.title}>{t('creditsDetailHeading')}</h4>
      {credits.accounts
        // Skip the packages that say nothing: an exhausted non-enterprise
        // package is noise once the total is on screen.
        .filter(account => account.packageName === 'enterprise' || account.remain > 0 || account.unlimited === true)
        .map((account, index) => (
          <CreditBar
            key={`${account.packageName}-${String(index)}`}
            label={account.packageName === 'enterprise' ? t('packageEnterprise') : account.packageName}
            remain={account.remain}
            size={account.size}
            unlimited={account.unlimited}
            t={t}
          />
        ))}
    </div>
  )
}

/** The per-model discount reference. */
export function ModelOffersPanel({ models, t }: {
  models: readonly WorkBuddyWebModelBadge[] | undefined
  t: WorkBuddyTranslate
}): ReactNode {
  const offers = (models ?? []).filter(model => model.free === true || (model.badges?.length ?? 0) > 0)
  if (offers.length === 0) return null
  return (
    <div className={css.section}>
      <h4 className={css.title}>{t('modelsHeading')}</h4>
      {offers.map(model => (
        <div key={model.id} className={css.modelRow}>
          <span className={css.modelMain}>
            <span>{model.name}</span>
            <ModelBadges model={model} t={t} />
          </span>
          {model.credits === undefined
            // No rate to show. When the plugin withheld it because the price
            // came from an ended promotion, say so plainly rather than showing
            // nothing — silence here reads as "free", which is the claim being
            // avoided.
            ? model.rateUnknown === true ? <span className={css.dim}>{t('rateUnknown')}</span> : null
            : <span className={css.dim}>{t('rate', { rate: model.credits })}</span>}
        </div>
      ))}
    </div>
  )
}

/**
 * Context window and model visibility, one row per catalog model.
 *
 * The list is driven by the full current catalog, not by context metadata:
 * hiding a model is a statement about the picker, and a model without a
 * declared window is still hideable — its row just shows an em dash where the
 * capacity would be. Rows with a window keep the original ordering (largest
 * first); rows without one trail at the end in catalog order.
 *
 * Purely a report of the upstream's own numbers. The plugin offers no tier
 * picker: the CN catalog declares one capacity per model and publishes no
 * alternatives, so a menu there would mean inventing client-side policy. The
 * international document does declare alternatives (`supportedLengths`), and
 * they are shown as a secondary figure rather than merged into one number —
 * the default is the budget actually requested, while the larger value is a
 * ceiling the upstream would accept.
 */
export function ContextPanel({ models, visibility, maximumContextWindow, toggling, disabled, onToggle, t }: {
  models: readonly WorkBuddyWebModelBadge[] | undefined
  /** Per-account hidden-model state; undefined renders no checkboxes. */
  visibility: WorkBuddyWebVisibilitySection | undefined
  /** The effective maximum-context preference, shown as a fact rather than edited here. */
  maximumContextWindow: boolean | undefined
  /** The models whose visibility writes are in flight; only those rows lock. */
  toggling: ReadonlySet<string>
  /** Whether every control is locked while another card action runs. */
  disabled: boolean
  onToggle: (modelId: string, visible: boolean, account: string) => void
  t: WorkBuddyTranslate
}): ReactNode {
  const rows = [...(models ?? [])].sort((a, b) => {
    // Largest first, the ordering this table has always used; rows without a
    // declared window trail at the end, keeping catalog order within the group
    // (Array#sort is stable).
    if (a.contextWindow === undefined) return b.contextWindow === undefined ? 0 : 1
    if (b.contextWindow === undefined) return -1
    return b.contextWindow - a.contextWindow
  })
  if (rows.length === 0) return null
  const hidden = new Set(visibility?.disabled ?? [])
  return (
    <div className={css.section}>
      <h4 className={css.title}>{t('contextHeading')}</h4>
      {/* The preference belongs to the plugin's configuration, not to this
          list: it is reported as a fact with a pointer to where it is set
          rather than duplicated as a control that writes somewhere else. */}
      {maximumContextWindow === undefined ? null : (
        <p className={css.dim}>
          {t('maximumContextWindow')}：{t(maximumContextWindow ? 'on' : 'off')}
        </p>
      )}
      {/* One line on what the checkboxes mean, only when they are rendered —
          a bare checkbox column with no explanation reads as selection, not
          visibility. */}
      {visibility === undefined ? null : <p className={css.text}>{t('visibilityIntro')}</p>}
      {rows.map(model => {
        const capacity = model.contextWindow
        // Only shown when the upstream declared a larger alternative, so the
        // CN list (which declares none) is unchanged.
        const alternative = capacity !== undefined && model.maxContextWindow !== undefined && model.maxContextWindow > capacity
          ? model.maxContextWindow
          : undefined
        return (
          <div key={model.id} className={css.modelRow}>
            <span className={css.modelMain}>
              {visibility === undefined ? null : (
                <Checkbox
                  checked={!hidden.has(model.id)}
                  disabled={disabled || toggling.has(model.id)}
                  label={model.name}
                  onChange={visible => { onToggle(model.id, visible, visibility.account) }}
                />
              )}
              {visibility === undefined ? <span>{model.name}</span> : null}
              <ModelBadges model={model} t={t} />
            </span>
            <span className={css.modelEnd}>
              {capacity === undefined
                ? <span className={css.dim} aria-label={t('contextUnknown')}>—</span>
                : <span>{formatTokens(capacity)}</span>}
              {alternative !== undefined
                ? <span className={css.dim}>{t('contextUpTo', { size: formatTokens(alternative) })}</span>
                : capacity !== undefined && model.defaultContextWindow !== undefined && model.defaultContextWindow < capacity
                  ? <span className={css.dim}>{t('contextDefault', { size: formatTokens(model.defaultContextWindow) })}</span>
                  : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Reasoning-effort detection: one row per detectable model.
 *
 * Two deliberate UX rules:
 * - **one press detects.** The row states what the model accepts and the button
 *   beside it runs the check; the cost is stated once, above the list, instead
 *   of being asked again per row. A confirmation whose only other option is
 *   "cancel" costs a click and answers nothing;
 * - a `non-validating` result is presented as an observation about the
 *   parameter ("this model does not check it"), never as a statement that a
 *   level is unsupported.
 */
export function ProbePanel({ probe, models, busy, onDetect, onClear, t }: {
  probe: WorkBuddyWebProbeSection
  /** Catalog rows from the same status document, for candidate display names. */
  models: readonly WorkBuddyWebModelBadge[] | undefined
  busy: boolean
  onDetect: (modelId: string) => void
  onClear: () => void
  t: WorkBuddyTranslate
}): ReactNode {
  // Which model this card last asked to detect. `busy` alone cannot answer
  // that — it is true for any in-flight request — so the running label needs
  // the id, otherwise every candidate button claims to be running at once.
  const [runningModel, setRunningModel] = useState<string>()
  // Clear the running label once the request settles.
  //
  // Keyed on `busy` alone this would fire immediately: the click that starts a
  // detection sets `runningModel` and `busy` in one batch, and an effect that
  // only checks `!busy` can still observe the pre-update value. So the label is
  // armed on the way up and released only after the run has been seen in flight.
  const armed = useRef(false)
  useEffect(() => {
    if (runningModel === undefined) return
    if (busy || probe.running) {
      armed.current = true
      return
    }
    if (!armed.current) return
    armed.current = false
    setRunningModel(undefined)
  }, [runningModel, busy, probe.running])

  if (probe.candidates.length === 0) return <p className={css.text}>{t('probeResultEmpty')}</p>

  return (
    <div className={css.section}>
      <h4 className={css.title}>{t('probeHeading')}</h4>
      <p className={css.text}>{t('probeIntro')}</p>
      <p className={css.dim}>{t('probeConsentHint')}</p>
      {probe.candidates.length === 0 ? null : <p className={css.dim}>{t('probeConfirmBody')}</p>}
      {probe.running ? <p className={css.text}>{t('probeRunningGeneric')}</p> : null}
      {/*
        * One row per probeable model, each carrying its own result and button.
        * Buttons used to live in a block above the results, so a detected model
        * left the button list and reappeared only as a result below — re-running
        * it meant clearing every other result. Rows keep the model and its
        * action together, and the order is fixed by the catalog, so nothing
        * moves when a detection lands.
        */}
      {probe.candidates.map(id => {
        const result = probe.results.find(entry => entry.id === id)
        // Display name: the catalog's own label first, then whatever the
        // recorded probe stored, then the bare id. The *action* below keeps
        // using the id regardless of what the name resolves to.
        const name = models?.find(model => model.id === id)?.name ?? result?.name ?? id
        return (
          <div key={id} className={css.modelStack}>
            <div className={css.probeRow}>
              <span>{name}</span>
              <span className={css.probeEnd}>
                {result === undefined ? null : (
                  <Tag tone={result.validation === 'validating' ? 'success' : 'neutral'}>
                    {result.validation === 'validating' && result.efforts.length > 0
                      ? result.efforts.join(' / ')
                      : t(result.validation === 'non-validating' ? 'probeResultNotValidating' : 'probeResultUnknown')}
                  </Tag>
                )}
                <Button
                  size="sm"
                  disabled={probe.running || busy}
                  onClick={() => {
                    setRunningModel(id)
                    onDetect(id)
                  }}
                >
                  {/* Only the button that was pressed reports progress; the
                      card-wide `busy` flag cannot pick the label. */}
                  {runningModel === id
                    ? t('probeRunning', { model: name })
                    : t(result === undefined ? 'probeStart' : 'probeRedetect')}
                </Button>
              </span>
            </div>
            {result === undefined ? null
              : <span className={css.dim}>{t('probeResultAt', { time: formatTime(result.probedAt) })}</span>}

          </div>
        )
      })}
      {probe.results.length === 0
        ? null
        : <Button size="sm" disabled={busy} onClick={onClear}>{t('probeClear')}</Button>}
    </div>
  )
}

/**
 * The Agent assist block for a path failure: what is wrong, one copyable
 * request, and a re-check. Rendered only for the codes the host can do
 * something about.
 */
export function AssistBlock({ variant, code, busy, onRecheck, t }: {
  variant: WorkBuddyCardVariant
  code: WorkBuddySignedOutReasonCode
  busy: boolean
  onRecheck: () => void
  t: WorkBuddyTranslate
}): ReactNode {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const prompt = t('assistantPrompt', {
    appName: variant.appName,
    failureSummary: t(assistSummaryKey(code, variant)),
  })
  return (
    <div className={css.assist}>
      <h4 className={css.title}>{t('assistantHeading')}</h4>
      <p className={css.text}>{t('assistantIntro')}</p>
      <div className={css.promptRow}>
        {/* Selectable on purpose: a failed clipboard write must still leave the
            user a way to copy the text by hand. */}
        <p className={css.prompt}>{prompt}</p>
        <Button
          size="sm"
          onClick={() => {
            void writeClipboard(prompt).then(ok => {
              setCopied(ok)
              setCopyFailed(!ok)
            })
          }}
        >
          {t('assistantCopy')}
        </Button>
      </div>
      {/* `role="status"` so the copy result is announced, not just shown. */}
      {copied ? <p className={css.dim} role="status">{t('assistantCopied')}</p> : null}
      {copyFailed ? <p className={css.dim} role="status">{t('assistantCopyFailed')}</p> : null}
      <p className={css.text}>{t('assistantAfter')}</p>
      <Button size="sm" disabled={busy} onClick={onRecheck}>
        {busy ? t('assistantRechecking') : t('assistantRecheck')}
      </Button>
    </div>
  )
}
