/**
 * Browser half: the plugin's configuration page on the Plugins page, and the
 * reasoning-effort control in the composer's compact-controls row.
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
// Type-only, and load-bearing: this is the merge that declares the
// `conversation.chat.assistant-actions` seat the credit label registers into,
// and that types its owner currency as `{ messageId }`.
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
// Type-only, and load-bearing: this is the merge that declares `sessionId: SessionId`
// on the session-scope slot props. Without it `SessionIdOf` falls back to `string`,
// and the composer seat's injected `directoryFor(sessionId)` stops typechecking.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { WorkBuddyConfigPage } from './WorkBuddyConfigPage.tsx'
import { WorkBuddyProbeControl } from './probe-control.tsx'
import { WorkBuddyCreditLabel } from './credit-label.tsx'
import { WorkBuddyCreditBalance } from './credit-balance.tsx'
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
 * The bundle's package name. This is the **slot key**: the Plugins page renders
 * `plugins.bundle.config` as `{ entryKey: pkg.name }`, and only shows the
 * section at all when `ledger.bundles.has(pkg.name)` — and `ledger.bundles` is
 * `keysOf('plugins.bundle.config')`, i.e. the keys we register here.
 */
export const BUNDLE_NAME = 'dsh-workbuddy-bridge'

/**
 * The loader entry id — `cordis.patch.yml`'s `insert[].id`, and therefore the
 * **settings namespace**.
 *
 * Not the same string as {@link BUNDLE_NAME}, and the difference is load-bearing.
 * `dsh-settings/lib/index.js:432,443` publishes every plugin's `Config` document
 * as `ns: entry.options.id` — the *entry* id, not the package name. The composed
 * profile confirms it:
 *
 * ```yaml
 * # == dsh-workbuddy-bridge
 * - id: llm-workbuddy            # entry id  → settings namespace
 *   name: dsh-workbuddy-bridge   # package   → slot key
 * ```
 *
 * `ctx.configForms.get()` takes a namespace, so this is its argument. Passing
 * the package name instead looks correct and fails **silently**: the host never
 * serves that namespace, `whileServed` never fires, and the configuration page
 * simply never appears — no error, no log, nothing.
 */
export const ENTRY_ID = 'llm-workbuddy'

/**
 * Client services required by this browser half.
 *
 * `modelDirectories` is absent on purpose: it may arrive after this fiber
 * starts, so the composer seat waits for it inside a scoped callback instead of
 * holding the whole entry back.
 */
export const inject = ['slots', 'locale', 'remote', 'remote.session', 'configForms']

/**
 * The host seat this control occupies: the composer's compact-controls row,
 * which the host renders immediately left of its own model selector.
 *
 * Deliberately not `conversation.input.model`: that seat is `single`, the
 * shipped ModelSelect already occupies it at priority 0, and a second
 * registration at that priority throws — the seat's own fail-loud rule. A
 * `list` seat adds an entry beside the shipped one instead of fighting it.
 */
const PROBE_SEAT = 'conversation.input.right'

/** Entry id within that seat, so the registration is named in exactly one place. */
const PROBE_SEAT_ID = 'workbuddy-probe'

/**
 * The remaining-credit label's entry id, in the same `list` seat as the probe
 * control.
 *
 * Sharing {@link PROBE_SEAT} rather than taking a seat of its own is what keeps
 * the balance flush against the model picker: `conversation.input.right` renders
 * as the immediate previous flex sibling of `conversation.input.model`, and two
 * entries in one `list` seat keep that position. Both are ordered, so the
 * balance can sit closer to the picker than the probe icon.
 */
const BALANCE_SEAT_ID = 'workbuddy-credit-balance'

/**
 * The assistant message's action strip — the row holding copy, the plugin
 * actions, branch and the usage pill.
 *
 * A `list` seat declared by `dsh-client-ui-chat`, scoped to the session, whose
 * owner currency is `{ messageId }`. The shipped Like/Dislike entry registers
 * into it too, which is why this is the supported place for a per-message
 * annotation: it is the row WorkBuddy's own client puts "共消耗" in.
 */
const MESSAGE_ACTIONS_SEAT = 'conversation.chat.assistant-actions'

/** Entry id for the per-message credit label. */
const CREDIT_LABEL_SEAT_ID = 'workbuddy-credit-label'

export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-workbuddy-bridge: dictionaries')

  // The configuration page: the plugin's own settings form plus the live cards.
  // `whileServed` holds the registration back until the Host actually serves
  // this entry, so a deployment with no writable configuration shows no page
  // that could not save.
  const config = new WorkBuddyConfigController(ctx.configForms.get(ENTRY_ID))
  ctx.effect(
    () => () => {
      config.dispose()
    },
    'dsh-workbuddy-bridge: form subscription',
  )
  ctx.effect(
    () =>
      ctx.configForms.whileServed([ENTRY_ID], () =>
        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register(
            {
              name: 'plugins.bundle.config',
              key: BUNDLE_NAME,
              locale: NS,
              inject: () => config.inject(),
            },
            WorkBuddyConfigPage,
          ),
        ),
      ),
    'dsh-workbuddy-bridge: configuration page',
  )

  // The reasoning-effort seat itself. It reads the session's current selection
  // through `modelDirectories`, which is why it waits for that service rather
  // than registering eagerly.
  ctx.inject(['modelDirectories'], (scope) => {
    scope.slots.inject(PROBE_SEAT, () => {
      const releaseProbe = scope.slots.register(
        {
          name: PROBE_SEAT,
          id: PROBE_SEAT_ID,
          inject: (sessionId) => ({
            directory: scope.modelDirectories.directoryFor(sessionId).store,
            t,
          }),
        },
        WorkBuddyProbeControl,
      )
      // The remaining-credit label, in the same seat and therefore the same
      // flex row as the model picker. `order` places it left of the probe icon,
      // so the reading order is: balance, probe, model — money, then capability,
      // then the choice itself.
      const releaseBalance = scope.slots.register(
        {
          name: PROBE_SEAT,
          id: BALANCE_SEAT_ID,
          order: -10,
          inject: (sessionId) => ({
            directory: scope.modelDirectories.directoryFor(sessionId).store,
            t,
          }),
        },
        WorkBuddyCreditBalance,
      )
      return () => {
        releaseBalance()
        releaseProbe()
      }
    })
  })

  // The per-message credit label. Declared by `dsh-client-ui-chat`, so a host
  // without that package simply never runs this callback — no version check and
  // no fallback needed.
  //
  // It takes `modelDirectories` because it is shown only while the session runs
  // a WorkBuddy model: a credit figure beside an answer from another provider
  // would describe a ledger that answer never touched.
  ctx.inject(['modelDirectories'], (scope) =>
    scope.slots.inject(MESSAGE_ACTIONS_SEAT, () =>
      scope.slots.register(
        {
          name: MESSAGE_ACTIONS_SEAT,
          id: CREDIT_LABEL_SEAT_ID,
          locale: NS,
          inject: (sessionId) => ({
            directory: scope.modelDirectories.directoryFor(sessionId).store,
            sessionId,
            t,
          }),
        },
        WorkBuddyCreditLabel,
      ),
    ),
  )
}
