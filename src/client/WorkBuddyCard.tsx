/**
 * One WorkBuddy variant's card.
 *
 * The shell is the host's own `DisclosureRow`, so the card inherits the Plugins
 * page's disclosure chrome, keyboard handling, and theme instead of shipping a
 * hand-built expandable container. What remains plugin-owned is the *content*:
 * the account state, where the model list came from, the credit breakdown, the
 * context windows with their per-account visibility controls, and the
 * reasoning-effort detection.
 */

import { useId, useState, type ReactNode } from 'react'
import {
  Button,
  DisclosureRow,
  SegmentedTabs,
  StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SegmentedTab, StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import { AssistBlock, CreditsPanel, ModelsPanel, ProbePanel, assistCodeFor } from './panels.tsx'
import { PanelBoundary } from './PanelBoundary.tsx'
import { Field, Figure } from './field.tsx'
import { CoinGlyph } from './coin-glyph.tsx'
import { formatCycleReset, formatNumber, formatTime } from './format.ts'
import { useWorkBuddyStatus } from './use-status.ts'
import type { WorkBuddyLocaleKey, WorkBuddyTranslate } from './locales.ts'
import type { WorkBuddyCardVariant } from './variants.ts'
import type { WorkBuddyWebStatus } from '../shared/paths.ts'
import css from './workbuddy.module.css'

/** The card's three panels, in display order. */
type CardTab = 'credits' | 'models' | 'probe'

/**
 * Locale key per tab, so the crash fallback can name the block it replaced.
 *
 * The tabs' own `label` field is a `ReactNode` (the host's `SegmentedTab` allows
 * a node), so it cannot be fed back to `t()`. This map is the one place that
 * knows both the tab identity and the key behind its label.
 */
const TAB_LABEL_KEY: Record<CardTab, WorkBuddyLocaleKey> = {
  credits: 'tabCredits',
  models: 'tabModels',
  probe: 'tabProbe',
}

/**
 * The state dot's semantic.
 *
 * Takes `'loading'` as well as the document's own states: before the first
 * response the card knows nothing about the account, so it must not borrow the
 * signed-out grey — that would read as "nothing is wrong, nobody is signed in"
 * when the truth is "not read yet".
 */
function dotState(status: WorkBuddyWebStatus | undefined): StateDotState {
  if (status === undefined) return 'ongoing'
  if (status.status === 'signed-in') return 'done'
  return status.status === 'error' ? 'error' : 'idle'
}

/** The one-line account state. `undefined` status is "not read yet", not signed-out. */
function accountLabel(status: WorkBuddyWebStatus | undefined, t: WorkBuddyTranslate): string {
  if (status === undefined) return t('loading')
  if (status.status === 'signed-in') {
    return status.nickname === undefined
      ? t('signedIn')
      : t('signedInAs', { nickname: status.nickname })
  }
  return status.status === 'error' ? t('requestFailed') : t('signedOut')
}

/** Where the model list on screen came from, and when.
 *
 * Moved to `panels.tsx` with the row that renders it: the sentence describes the
 * catalog, and the catalog is the models panel's subject — not the account's. */

/** Render one variant's live status card. */
export function WorkBuddyCard({
  variant,
  t,
}: {
  variant: WorkBuddyCardVariant
  t: WorkBuddyTranslate
}): ReactNode {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<CardTab>('credits')
  const {
    status,
    readFailure,
    busy,
    toggling,
    refresh,
    refreshModels,
    detect,
    clearDetections,
    setVisibility,
  } = useWorkBuddyStatus(variant, t)
  const baseId = useId()
  const creditsTab: SegmentedTab<CardTab> = {
    value: 'credits',
    label: t('tabCredits'),
    id: `${baseId}-tab-credits`,
    panelId: `${baseId}-panel-credits`,
  }
  const modelsTab: SegmentedTab<CardTab> = {
    value: 'models',
    label: t('tabModels'),
    id: `${baseId}-tab-models`,
    panelId: `${baseId}-panel-models`,
  }
  const probeTab: SegmentedTab<CardTab> = {
    value: 'probe',
    label: t('tabProbe'),
    id: `${baseId}-tab-probe`,
    panelId: `${baseId}-panel-probe`,
  }
  const tabs: readonly [SegmentedTab<CardTab>, ...SegmentedTab<CardTab>[]] = [
    creditsTab,
    modelsTab,
    probeTab,
  ]

  /**
   * The failure the assist block covers, when this document has one. Computed
   * once so the block and the refresh button agree on which one owns the
   * re-check — showing both would put two buttons with the same effect side by
   * side.
   */
  const assistCode = status?.status === 'signed-out' ? assistCodeFor(status.reasonCode) : undefined
  const signedIn = status?.status === 'signed-in' ? status : undefined

  return (
    <DisclosureRow
      icon={<StateDot state={dotState(status)} />}
      title={t(variant.titleKey)}
      /* `summaryTitle`'s `flex: 1` is what pushes the status to the row's right
         edge — without it the status text sits glued to the title. */
      titleClassName={css.summaryTitle}
      rowClassName={css.summaryRow}
      open={open}
      expandable
      expandOnRowClick
      onToggle={() => {
        setOpen(!open)
      }}
      collapsedContent={
        <span className={css.statusLine} role="status" aria-busy={status === undefined}>
          <StateDot state={dotState(status)} />
          <span>{accountLabel(status, t)}</span>
        </span>
      }
    >
      <div className={css.body}>
        <div className={css.section}>
          {/*
           * The account block is one unlabelled fact: the value says what it is
           * (`Signed in as 阿七`), so a name over it would be the same fact again
           * — which is what `Account` over `Sign-in` over `Signed in as 阿七` was,
           * under a card header that already said it.
           *
           * The expiry rides along as the field's grey tier rather than taking a
           * row of its own: it only means anything as a property of the session.
           * The value and the button stay on opposite edges — see `field.tsx` for
           * the shape's rules.
           */}
          <Field
            value={accountLabel(status, t)}
            hint={
              signedIn?.expiresAt === undefined ? undefined : (
                <Figure label={t('sessionExpiryLabel')}>{formatTime(signedIn.expiresAt)}</Figure>
              )
            }
            action={
              /* The assist block carries the re-check in its state, so the
                 refresh button steps aside rather than duplicating it. */
              assistCode === undefined ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    void refresh()
                  }}
                >
                  {busy ? t('refreshing') : t('refresh')}
                </Button>
              ) : undefined
            }
          />
          {/*
           * A failed read is reported beside the document still on screen,
           * never in place of it: blanking the card over one transient error
           * loses the account, credits and model list the user was reading.
           */}
          {readFailure === undefined || status === undefined ? null : (
            <p className={css.error}>{t('statusRefreshFailed', { message: readFailure })}</p>
          )}
        </div>

        {signedIn === undefined ? null : (
          <>
            <SegmentedTabs items={tabs} value={tab} onChange={setTab} label={t('tabLabel')} />

            {/*
             * One boundary per tab panel, keyed by the tab so a crash in one
             * does not follow the user into the next. Without this, a throw in
             * any panel reaches the host's own boundary, which latches — the
             * whole configuration area stays gone until the plugin is toggled.
             */}
            <PanelBoundary key={tab} label={t(TAB_LABEL_KEY[tab])} t={t}>
              {tab === 'credits' ? (
                <div
                  className={css.panel}
                  id={creditsTab.panelId}
                  role="tabpanel"
                  aria-labelledby={creditsTab.id}
                >
                  {signedIn.credits === undefined ? null : (
                    /*
                     * One fact with three tiers: the total, and when the cycle it
                     * counts against resets. The reset is a property of the total
                     * — reading it without the total says nothing — so it is the
                     * field's grey tier rather than a second row.
                     *
                     * The total is the **coin readout**, the same glyph-and-figure
                     * pair the composer shows beside the model picker. That is the
                     * point of it: the balance appears in two places two clicks
                     * apart, and the shared glyph is what makes a reader recognise
                     * it as the same number without either place spelling it out.
                     */
                    <Field
                      label={t('creditsTotalLabel')}
                      value={
                        <span className={css.coinReadout}>
                          <CoinGlyph />
                          {/* `unlimited` first: the placeholder total is 0 and
                              rendering it would claim the quota is exhausted. */}
                          <span className={css.fieldFigure}>
                            {signedIn.credits.unlimited === true
                              ? t('creditsTotalUnlimitedValue')
                              : formatNumber(signedIn.credits.total)}
                          </span>
                        </span>
                      }
                      hint={
                        signedIn.credits.cycleResetTime === undefined ? undefined : (
                          <Figure label={t('cycleResetLabel')}>
                            {formatCycleReset(signedIn.credits.cycleResetTime)}
                          </Figure>
                        )
                      }
                    />
                  )}
                  {signedIn.credits === undefined ? null : (
                    <CreditsPanel credits={signedIn.credits} t={t} />
                  )}
                  {signedIn.creditsError === undefined ? null : (
                    <p className={css.error}>
                      {t('creditsError', { message: signedIn.creditsError })}
                    </p>
                  )}
                </div>
              ) : tab === 'models' ? (
                <div
                  className={css.panel}
                  id={modelsTab.panelId}
                  role="tabpanel"
                  aria-labelledby={modelsTab.id}
                >
                  <ModelsPanel
                    models={signedIn.models}
                    visibility={signedIn.visibility}
                    toggling={toggling}
                    disabled={busy}
                    catalog={signedIn.catalog}
                    busy={busy}
                    t={t}
                    onToggle={(model, visible, account) => {
                      void setVisibility(model, visible, account)
                    }}
                    onRefresh={() => {
                      void refreshModels()
                    }}
                  />
                </div>
              ) : (
                <div
                  className={css.panel}
                  id={probeTab.panelId}
                  role="tabpanel"
                  aria-labelledby={probeTab.id}
                >
                  {signedIn.probe === undefined ? null : (
                    <ProbePanel
                      probe={signedIn.probe}
                      models={signedIn.models}
                      busy={busy}
                      t={t}
                      onDetect={(model) => {
                        void detect(model)
                      }}
                      onClear={() => {
                        void clearDetections()
                      }}
                    />
                  )}
                </div>
              )}
            </PanelBoundary>
          </>
        )}

        {status?.status === 'signed-out' ? (
          // A mismatch explanation replaces the generic hint: telling a user to
          // "sign in" is wrong advice when a credential was found and rejected
          // for belonging to the other product.
          <>
            <p className={status.reason === undefined ? css.text : css.error}>
              {status.reason ?? t(variant.signedOutKey)}
            </p>
            {assistCode === undefined ? null : (
              <AssistBlock
                variant={variant}
                code={assistCode}
                busy={busy}
                t={t}
                onRecheck={() => {
                  void refresh()
                }}
              />
            )}
          </>
        ) : null}
        {status?.status === 'error' ? <p className={css.error}>{status.message}</p> : null}
      </div>
    </DisclosureRow>
  )
}
