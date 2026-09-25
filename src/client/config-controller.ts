/**
 * The staged settings form over this plugin's own configuration namespace.
 *
 * In DSH 0.1.7 a plugin's `Config` schema *is* its settings document, and the
 * Host serves it under the plugin's profile entry id — the package name. This
 * controller is the browser half of that: it stages what the user types and
 * writes it only when they save, through one revision-fenced mutation, using
 * the shared form model every official settings page uses.
 */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  SettingsFormModel, settingsTextField,
  type SettingsFieldSpec, type SettingsFieldState, type SettingsFormActions,
  type SettingsFormScope, type SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'

/** The configuration values this plugin's page edits. */
export interface WorkBuddyPluginSettings {
  /** Explicit WorkBuddy (CN) desktop auth-file path. */
  authFile?: string
  /** Explicit WorkBuddy AI (international) desktop auth-file path. */
  authFileAI?: string
  /** Whether reasoning-effort detection is authorized. */
  probeConsent?: boolean
  /** Whether the largest declared context window is selected. */
  useMaximumContextWindow?: boolean
}

/** What the page renders. */
export interface WorkBuddyConfigState extends SettingsFormShell {
  authFile: SettingsFieldState
  authFileAI: SettingsFieldState
  probeConsent: SettingsFieldState
  useMaximumContextWindow: SettingsFieldState
}

/** The face the page's slot registration injects. */
export interface WorkBuddyConfigFace extends SettingsFormActions {
  hooks: { workbuddyConfig: SnapshotStore<WorkBuddyConfigState> }
}

/**
 * A boolean field. Staged as text like every other field, so one save covers
 * the whole form; the control renders the two states, not the string.
 */
function settingsBooleanField(field: string): SettingsFieldSpec {
  return {
    field,
    format: value => value === true ? 'true' : 'false',
    parse: text => {
      const trimmed = text.trim()
      return trimmed === 'true' || trimmed === 'false' ? { kind: 'set', value: trimmed === 'true' } : undefined
    },
  }
}

/** Bridges one Host entry's form onto the page. */
export class WorkBuddyConfigController {
  private readonly form: SettingsFormModel<WorkBuddyPluginSettings>
  private readonly store: SnapshotStore<WorkBuddyConfigState>

  constructor(scope: SettingsFormScope<WorkBuddyPluginSettings>) {
    this.form = new SettingsFormModel<WorkBuddyPluginSettings>(scope, [
      settingsTextField('authFile'),
      settingsTextField('authFileAI'),
      settingsBooleanField('probeConsent'),
      settingsBooleanField('useMaximumContextWindow'),
    ])
    this.store = this.form.bind(() => this.projection())
  }

  private projection(): WorkBuddyConfigState {
    return {
      ...this.form.shell(),
      authFile: this.form.field('authFile'),
      authFileAI: this.form.field('authFileAI'),
      probeConsent: this.form.field('probeConsent'),
      useMaximumContextWindow: this.form.field('useMaximumContextWindow'),
    }
  }

  /** Build the face the page's slot registration injects. */
  inject(): WorkBuddyConfigFace {
    return { hooks: { workbuddyConfig: this.store }, ...this.form.actions() }
  }

  /** Release the form's subscriptions. */
  dispose(): void { this.form.dispose() }
}
