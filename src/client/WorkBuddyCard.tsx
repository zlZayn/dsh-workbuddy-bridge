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
import { Button, DisclosureRow, SegmentedTabs, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SegmentedTab, StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import { AssistBlock, CreditsPanel, ModelsPanel, ProbePanel, assistCodeFor } from './panels.tsx'
import { formatCycleReset, formatNumber, formatTime } from './format.ts'
import { useWorkBuddyStatus } from './use-status.ts'
import type { WorkBuddyTranslate } from './locales.ts'
import type { WorkBuddyCardVariant } from './variants.ts'
import type { WorkBuddyWebStatus } from '../shared/paths.ts'
import css from './workbuddy.module.css'

/** The card's three panels, in display order. */
type CardTab = 'credits' | 'models' | 'probe'

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
    return status.nickname === undefined ? t('signedIn') : t('signedInAs', { nickname: status.nickname })
  }
  return status.status === 'error' ? t('requestFailed') : t('signedOut')
}

/** Where the model list on screen came from, and when. */
function catalogProvenance(
  catalog: NonNullable<Extract<WorkBuddyWebStatus, { status: 'signed-in' }>['catalog']>,
  t: WorkBuddyTranslate,
): string {
  const when = catalog.fetchedAt === undefined ? undefined : formatTime(catalog.fetchedAt)
  const line = catalog.source === 'live' && when !== undefined
    ? t('catalogLive', { time: when })
    : catalog.source === 'saved' && when !== undefined
      ? t('catalogSaved', { time: when })
      : t('catalogFallback')
  return catalog.appVersion === undefined ? line : `${line} · ${t('catalogAppVersion', { version: catalog.appVersion })}`
}

/** Render one variant's live status card. */
export function WorkBuddyCard({ variant, t }: { variant: WorkBuddyCardVariant; t: WorkBuddyTranslate }): ReactNode {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<CardTab>('credits')
  const { status, readFailure, busy, toggling, refresh, refreshModels, detect, clearDetections, setVisibility } =
    useWorkBuddyStatus(variant, t)
  const baseId = useId()
  const creditsTab: SegmentedTab<CardTab> = {
    value: 'credits', label: t('tabCredits'), id: `${baseId}-tab-credits`, panelId: `${baseId}-panel-credits`,
  }
  const modelsTab: SegmentedTab<CardTab> = {
    value: 'models', label: t('tabModels'), id: `${baseId}-tab-models`, panelId: `${baseId}-panel-models`,
  }
  const probeTab: SegmentedTab<CardTab> = {
    value: 'probe', label: t('tabProbe'), id: `${baseId}-tab-probe`, panelId: `${baseId}-panel-probe`,
  }
  const tabs: readonly [SegmentedTab<CardTab>, ...SegmentedTab<CardTab>[]] = [creditsTab, modelsTab, probeTab]

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
      onToggle={() => { setOpen(!open) }}
      collapsedContent={(
        <span className={css.statusLine} role="status" aria-busy={status === undefined}>
          <StateDot state={dotState(status)} />
          <span>{accountLabel(status, t)}</span>
        </span>
      )}
    >
      <div className={css.body}>
        <div className={css.section}>
          <h4 className={css.title}>{t('accountHeading')}</h4>
          {/* `aria-busy` while nothing has been read: the value is pending, not absent. */}
          <div className={css.row}>
            {/* The header line already says who is signed in; this row carries the
                action that belongs to that fact. */}
            {/* The assist block carries the re-check in its state, so the
                refresh button steps aside rather than duplicating it. */}
            {assistCode === undefined
              ? (
                <Button size="sm" disabled={busy} onClick={() => { void refresh() }}>
                  {busy ? t('refreshing') : t('refresh')}
                </Button>
              )
              : null}
          </div>
          {/*
            * A failed read is reported beside the document still on screen,
            * never in place of it: blanking the card over one transient error
            * loses the account, credits and model list the user was reading.
            */}
          {readFailure === undefined || status === undefined
            ? null
            : <p className={css.error}>{t('statusRefreshFailed', { message: readFailure })}</p>}
          {signedIn?.expiresAt === undefined
            ? null
            : <p className={css.text}>{t('accessTokenExpires', { time: formatTime(signedIn.expiresAt) })}</p>}
        </div>

        {signedIn === undefined ? null : (
          <>
            {/* The card-level facts live above the tabs: the account section
                names the session and its expiry, and this line says where the
                model list came from — neither belongs to one tab. */}
            {signedIn.catalog === undefined ? null : (
              <div className={css.row}>
                <span className={css.text}>{catalogProvenance(signedIn.catalog, t)}</span>
                <Button size="sm" disabled={busy} onClick={() => { void refreshModels() }}>
                  {busy ? t('refreshingModels') : t('refreshModels')}
                </Button>
              </div>
            )}
            {signedIn.catalog?.error === undefined
              ? null
              : <p className={css.error}>{t('catalogError', { message: signedIn.catalog.error })}</p>}

            <SegmentedTabs
              items={tabs}
              value={tab}
              onChange={setTab}
              label={t('tabLabel')}
            />

            {tab === 'credits'
              ? (
                <div className={css.section} id={creditsTab.panelId} role="tabpanel" aria-labelledby={creditsTab.id}>
                  {signedIn.credits === undefined ? null : (
                    <div className={css.section}>
                      <div className={css.row}>
                        {/* `unlimited` first: the placeholder total is 0 and
                            rendering it would claim the quota is exhausted. */}
                        <span className={css.title}>{signedIn.credits.unlimited === true
                          ? t('creditsTotalUnlimited')
                          : t('creditsTotal', { total: formatNumber(signedIn.credits.total) })}</span>
                      </div>
                      {signedIn.credits.cycleResetTime === undefined ? null : (
                        <p className={css.dim}>
                          {t('cycleResetAt', { time: formatCycleReset(signedIn.credits.cycleResetTime) })}
                        </p>
                      )}
                    </div>
                  )}
                  {signedIn.credits === undefined ? null : <CreditsPanel credits={signedIn.credits} t={t} />}
                  {signedIn.creditsError === undefined
                    ? null
                    : <p className={css.error}>{t('creditsError', { message: signedIn.creditsError })}</p>}
                </div>
              )
              : tab === 'models'
                ? (
                  <div className={css.section} id={modelsTab.panelId} role="tabpanel" aria-labelledby={modelsTab.id}>
                    <ModelsPanel
                      models={signedIn.models}
                      visibility={signedIn.visibility}
                      toggling={toggling}
                      disabled={busy}
                      t={t}
                      onToggle={(model, visible, account) => { void setVisibility(model, visible, account) }}
                    />
                  </div>
                )
                : (
                  <div className={css.section} id={probeTab.panelId} role="tabpanel" aria-labelledby={probeTab.id}>
                    {signedIn.probe === undefined
                      ? null
                      : (
                        <ProbePanel
                          probe={signedIn.probe}
                          models={signedIn.models}
                          busy={busy}
                          t={t}
                          onDetect={model => { void detect(model) }}
                          onClear={() => { void clearDetections() }}
                        />
                      )}
                  </div>
                )}
          </>
        )}

        {status?.status === 'signed-out'
          // A mismatch explanation replaces the generic hint: telling a user to
          // "sign in" is wrong advice when a credential was found and rejected
          // for belonging to the other product.
          ? (
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
                  onRecheck={() => { void refresh() }}
                />
              )}
            </>
          )
          : null}
        {status?.status === 'error' ? <p className={css.error}>{status.message}</p> : null}
      </div>
    </DisclosureRow>
  )
}