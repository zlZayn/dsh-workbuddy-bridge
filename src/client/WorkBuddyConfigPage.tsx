/**
 * The bundle's page on the Plugins page: the plugin's own configuration form
 * first, then one live status card per WorkBuddy variant.
 *
 * The split is the point. Configuration is static deployment state — where the
 * auth files live, whether detection is authorized, which context window to
 * select — and it belongs in the shared settings form, saved as one
 * revision-fenced mutation. Everything below it is live, per-account, and only
 * readable from the desktop app, so it is reported rather than edited.
 */

import type { ReactNode } from 'react'
import { SettingsForm, SettingsValueField, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { WorkBuddyCard } from './WorkBuddyCard.tsx'
import { CARD_VARIANTS } from './variants.ts'
import { formLabels } from './locales.ts'
import type { WorkBuddyConfigFace } from './config-controller.ts'
import css from './workbuddy.module.css'

/** Props the Plugins page binds for this bundle's configuration entry. */
export type WorkBuddyConfigPageProps =
  PropsRuntime<'plugins.bundle.config'>
  & PropsLocale<'settings.workbuddy'>
  & InjectFace<WorkBuddyConfigFace>

/** Stable field ids, so the labels and the panel ids agree across renders. */
const FIELD_IDS = {
  authFile: 'workbuddy-config-auth-file',
  authFileAI: 'workbuddy-config-auth-file-ai',
} as const

/**
 * Render the bundle's page: the one-liner a summary seat asks for, or the form
 * and the live cards.
 */
export function WorkBuddyConfigPage(props: WorkBuddyConfigPageProps): ReactNode {
  const { t } = props
  if (props.view === 'summary') return t('intro')
  const state = props.useWorkbuddyConfig(snapshot => snapshot)
  const disabled = !state.writable
  return (
    <div className={css.page}>
      <h4 className={css.title}>{t('settingsHeading')}</h4>
      <SettingsForm labels={formLabels(t)} state={state} onSave={props.save} onDiscard={props.discard}>
        <SettingsValueField
          id={FIELD_IDS.authFile}
          label={t('authFile')}
          hint={t('authFileHint')}
          overriddenLabel={t('overridden')}
          resetLabel={t('reset')}
          invalidLabel={t('saveFailed')}
          disabled={disabled}
          {...state.authFile}
          onEdit={text => { props.edit('authFile', text) }}
          onReset={() => { props.resetField('authFile') }}
        />
        <SettingsValueField
          id={FIELD_IDS.authFileAI}
          label={t('authFileAI')}
          hint={t('authFileAIHint')}
          overriddenLabel={t('overridden')}
          resetLabel={t('reset')}
          invalidLabel={t('saveFailed')}
          disabled={disabled}
          {...state.authFileAI}
          onEdit={text => { props.edit('authFileAI', text) }}
          onReset={() => { props.resetField('authFileAI') }}
        />
        <div className={css.fieldRow}>
          <span className={css.fieldText}>
            <span className={css.fieldLabel}>{t('probeConsent')}</span>
            <span className={css.dim}>{t('probeConsentHint')}</span>
          </span>
          <Switch
            checked={state.probeConsent.text === 'true'}
            disabled={disabled}
            label={t('probeConsent')}
            onChange={next => { props.edit('probeConsent', next ? 'true' : 'false') }}
          />
        </div>
        <div className={css.fieldRow}>
          <span className={css.fieldText}>
            <span className={css.fieldLabel}>{t('maximumContextWindow')}</span>
            <span className={css.dim}>{t('maximumContextWindowHint')}</span>
          </span>
          <Switch
            checked={state.useMaximumContextWindow.text === 'true'}
            disabled={disabled}
            label={t('maximumContextWindow')}
            onChange={next => { props.edit('useMaximumContextWindow', next ? 'true' : 'false') }}
          />
        </div>
      </SettingsForm>
      {CARD_VARIANTS.map(variant => <WorkBuddyCard key={variant.id} variant={variant} t={t} />)}
    </div>
  )
}
