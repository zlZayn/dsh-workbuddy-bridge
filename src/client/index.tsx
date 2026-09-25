/**
 * Browser half: the plugin's configuration page on the Plugins page, and the
 * reasoning-effort control in the conversation composer.
 *
 * Both are ordinary DSH slot registrations over the contracts their owners
 * declare — no host-version checks and no defensive wrappers. `ctx.slots.inject`
 * follows the slot's *declaration* lifetime: the callback runs where the slot is
 * declared and simply never runs where it is not, so a host without the Plugins
 * page or without a composer never asks for either component.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: the Context merges and SlotMap rows this half compiles against.
// Cross-plugin collaboration goes through cordis services, so a value import
// would fail the client bundle-purity gate.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { WorkBuddyConfigPage } from './WorkBuddyConfigPage.tsx'
import { WorkBuddyProbeControl } from './probe-control.tsx'
import { WorkBuddyConfigController } from './config-controller.ts'
import { en, zh } from './locales.ts'
import type { WorkBuddyLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** WorkBuddy page copy. */
    'settings.workbuddy': WorkBuddyLocaleKey
  }
}

/** Stable browser-plugin name. */
export const name = 'dsh-workbuddy-bridge-client'

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.workbuddy'

/**
 * The bundle's package name, which is also this plugin's settings namespace.
 *
 * DSH 0.1.7 serves a plugin's `Config` schema as its settings document under
 * the plugin's profile entry id, and the Plugins page dispatches
 * `plugins.bundle.config` by the bundle's package name. Both are one string:
 * what the profile installs.
 */
export const BUNDLE_NAME = 'dsh-workbuddy-bridge'

/**
 * Client services required by this browser half.
 *
 * `modelDirectories` is absent on purpose: it may arrive after this fiber
 * starts, so the composer seat waits for it inside a scoped callback instead of
 * holding the whole entry back.
 */
export const inject = ['slots', 'locale', 'remote', 'remote.session', 'configForms']

/** Slot id of the composer control, so it is named in exactly one place. */
const PROBE_SEAT_ID = 'workbuddy-probe'

export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-workbuddy-bridge: dictionaries')

  // The configuration page: the plugin's own settings form plus the live cards.
  // `whileServed` holds the registration back until the Host actually serves
  // this entry, so a deployment with no writable configuration shows no page
  // that could not save.
  const config = new WorkBuddyConfigController(ctx.configForms.get(BUNDLE_NAME))
  ctx.effect(() => () => { config.dispose() }, 'dsh-workbuddy-bridge: form subscription')
  ctx.effect(
    () => ctx.configForms.whileServed([BUNDLE_NAME], () => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
      name: 'plugins.bundle.config',
      key: BUNDLE_NAME,
      locale: NS,
      inject: () => config.inject(),
    }, WorkBuddyConfigPage))),
    'dsh-workbuddy-bridge: configuration page',
  )

  // The reasoning-effort seat beside the composer's model selector. It reads
  // the session's current selection through `modelDirectories`, which is why it
  // waits for that service rather than registering eagerly.
  ctx.inject(['modelDirectories'], scope => {
    scope.slots.inject('conversation.input.right', () => scope.slots.register({
      name: 'conversation.input.right',
      id: PROBE_SEAT_ID,
      order: 10,
      inject: (sessionId: string) => ({
        directory: scope.modelDirectories.directoryFor(sessionId as never).store,
        t,
      }),
    }, WorkBuddyProbeControl))
  })
}
