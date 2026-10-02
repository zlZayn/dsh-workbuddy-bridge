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
  IconRefreshOutlineRegular,
  SegmentedTabs,
  StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SegmentedTab, StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import { AssistBlock, CreditsPanel, ModelsPanel, ProbePanel, assistCodeFor } from './panels.tsx'
import { PanelBoundary } from './PanelBoundary.tsx'
import { Field, Part } from './field.tsx'
import { CoinGlyph } from './coin-glyph.tsx'
import { formatNumber, formatTime } from './format.ts'
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

/** The account block's one line, as the two tiers that render it. */
interface AccountLine {
  /** The static words — grey. */
  caption: string
  /** The account's identity — primary ink. Absent when the state names itself. */
  value?: string
}

/**
 * What the account state says, in one place.
 *
 * **One home, because two homes already disagreed.** The collapsed header renders
 * this as one string and the expanded block renders it as a caption plus a value;
 * when each derived the line itself, the body branched on *having an identity*
 * instead of on the sign-in state — and since a signed-out document has no
 * identity either, a signed-out card read 未登录 in the header and 已登录 in the
 * body, with the state dot correctly unlit beside them (reported 2026-10-03).
 *
 * The identity is the nickname when the desktop app reports one, otherwise the
 * account id: the credential does not always carry a nickname, while the id is
 * what the per-account state (hidden models, probe records) is keyed by, so it is
 * the one name that is always there.
 */
function accountLine(status: WorkBuddyWebStatus | undefined, t: WorkBuddyTranslate): AccountLine {
  // `undefined` status is "not read yet", which is not the same as signed out.
  if (status === undefined) return { caption: t('loading') }
  if (status.status === 'signed-in') {
    const identity = status.nickname ?? status.uid
    return identity === undefined
      ? { caption: t('signedIn') }
      : { caption: t('signedInLabel'), value: identity }
  }
  return { caption: status.status === 'error' ? t('requestFailed') : t('signedOut') }
}

/** The same line flattened for the collapsed header, where it is one string. */
function accountLabel(status: WorkBuddyWebStatus | undefined, t: WorkBuddyTranslate): string {
  const { caption, value } = accountLine(status, t)
  return value === undefined ? caption : `${caption} ${value}`
}

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
    refreshAll,
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
  // The block's two tiers. Derived once so the header and the body cannot
  // disagree — which they did, and the maintainer caught it.
  const account = accountLine(status, t)

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
        {/*
         * The card's one action, on a row of its own above everything it
         * refreshes.
         *
         * It used to be two buttons: `Refresh` in this block and `Refresh model
         * list` in the models panel. They did different things — one re-read the
         * document, the other had the host re-fetch the catalog upstream — while
         * both read as "refresh", which is what made the card's buttons feel
         * arbitrary. Now there is one button that does both.
         *
         * Three signals keep it card-level rather than a block's own action: it
         * is on its own row, its label names the scope, and it is the host's `md`
         * (36px) control while every block action is `sm` (28px).
         */}
        <div className={css.cardActions}>
          <Button
            icon={<IconRefreshOutlineRegular />}
            disabled={busy}
            onClick={() => {
              void refreshAll()
            }}
          >
            {busy ? t('refreshingAll') : t('refreshAll')}
          </Button>
        </div>

        <div className={css.section}>
          {/*
           * The account block: a grey caption and, when the state has one, the
           * identity it frames. Both tiers come from `accountLine`, which is the
           * same source the collapsed header reads — see its comment for why
           * there is exactly one of them.
           *
           * The expiry is the note line: it only means anything as a property of
           * the session. See `field.tsx` for the shape's rules.
           */}
          <Field
            main={
              <Part caption={account.caption}>
                {account.value === undefined ? undefined : account.value}
              </Part>
            }
            note={
              signedIn?.expiresAt === undefined ? undefined : (
                <Part caption={t('sessionExpiryLabel')}>{formatTime(signedIn.expiresAt)}</Part>
              )
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
                     * The total, as the **coin readout**: the same glyph-and-figure
                     * pair the composer shows beside the model picker. That is the
                     * point of it — the balance appears in two places two clicks
                     * apart, and the shared glyph is what makes a reader recognise
                     * it as the same number without either place spelling it out.
                     *
                     * One line and nothing else: the same shape the composer uses,
                     * which has no caption either (at 28px a caption would compete
                     * with the number it labels). It is not an exception to the
                     * template — every element but the main value is optional.
                     */
                    <Field
                      main={
                        <Part>
                          <CoinGlyph />
                          {/* `unlimited` first: the placeholder total is 0 and
                              rendering it would claim the quota is exhausted. */}
                          {signedIn.credits.unlimited === true
                            ? t('creditsTotalUnlimitedValue')
                            : formatNumber(signedIn.credits.total)}
                        </Part>
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
                    t={t}
                    onToggle={(model, visible, account) => {
                      void setVisibility(model, visible, account)
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
