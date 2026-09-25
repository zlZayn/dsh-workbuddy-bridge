/**
 * The staged configuration form over the plugin's own settings namespace.
 *
 * The contract under test: what the user types stays staged until they save,
 * one save is one revision-fenced mutation, and a refusal leaves the drafts
 * staged instead of dropping them.
 */

import { describe, expect, it } from 'vitest'
import { WorkBuddyConfigController, type WorkBuddyPluginSettings } from '../../src/client/config-controller.ts'
import type { SettingsFormPathOp, SettingsFormScope, SettingsFormScopeSnapshot } from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * A Host entry form over an in-memory document. It records every mutation so
 * assertions can pin the exact ops and the revision they were fenced with.
 */
class FakeSettingsScope implements SettingsFormScope<WorkBuddyPluginSettings> {
  writable = true
  revision: number | undefined = 7
  /** The user layer, as the Host would store it. */
  user: Partial<WorkBuddyPluginSettings> = {}
  /** Whether the next mutation is accepted. */
  land = true
  readonly mutations: { ops: readonly SettingsFormPathOp[]; revision: number | undefined }[] = []
  readonly listeners = new Set<() => void>()

  /** The compiled-in defaults the user layer resolves over. */
  base: Partial<WorkBuddyPluginSettings> = { probeConsent: false, useMaximumContextWindow: true }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot = (): SettingsFormScopeSnapshot<WorkBuddyPluginSettings> => ({
    status: 'ready',
    value: { ...this.base, ...this.user },
    base: this.base,
    user: this.user,
    writable: this.writable,
    revision: this.revision,
  })

  mutate = async (ops: readonly SettingsFormPathOp[], expectedRevision: number | undefined): Promise<boolean> => {
    this.mutations.push({ ops, revision: expectedRevision })
    if (!this.land) return false
    for (const op of ops) {
      const field = op.path[0] as keyof WorkBuddyPluginSettings
      if (op.op === 'set') this.user[field] = op.value as never
      else delete this.user[field]
    }
    this.revision = (this.revision ?? 0) + 1
    for (const listener of this.listeners) listener()
    return true
  }

  /** Apply the ops the way the Host would have, then settle: the test's read-back. */
  get applied(): Partial<WorkBuddyPluginSettings> { return this.user }
}

describe('WorkBuddy config form', () => {
  it('shows the served document and reports nothing dirty before edits', () => {
    const scope = new FakeSettingsScope()
    scope.user = { authFile: 'D:/wb/auth.info' }
    const controller = new WorkBuddyConfigController(scope)
    const state = controller.inject().hooks.workbuddyConfig.getSnapshot()
    expect(state.authFile).toMatchObject({ text: 'D:/wb/auth.info', overridden: true })
    expect(state.probeConsent).toMatchObject({ text: 'false', overridden: false })
    expect(state.useMaximumContextWindow).toMatchObject({ text: 'true', overridden: false })
    expect(state).toMatchObject({ dirty: false, invalid: false, writable: true })
  })

  it('writes one revision-fenced mutation on save, then clears the drafts', async () => {
    const scope = new FakeSettingsScope()
    const controller = new WorkBuddyConfigController(scope)
    const actions = controller.inject()
    actions.edit('authFile', '/home/yue/auth.info')
    actions.edit('probeConsent', 'true')
    expect(actions.hooks.workbuddyConfig.getSnapshot()).toMatchObject({ dirty: true })
    await actions.save()
    expect(scope.mutations).toHaveLength(1)
    expect(scope.mutations[0]).toMatchObject({
      revision: 7,
      ops: [
        { op: 'set', path: ['authFile'], value: '/home/yue/auth.info' },
        { op: 'set', path: ['probeConsent'], value: true },
      ],
    })
    expect(scope.applied).toEqual({ authFile: '/home/yue/auth.info', probeConsent: true })
    expect(actions.hooks.workbuddyConfig.getSnapshot()).toMatchObject({ dirty: false, failed: false })
  })

  it('empties and resets stage unset rather than writing an empty value', async () => {
    const scope = new FakeSettingsScope()
    scope.user = { authFile: '/old/auth.info' }
    const controller = new WorkBuddyConfigController(scope)
    const actions = controller.inject()
    actions.edit('authFile', '   ')
    await actions.save()
    expect(scope.mutations[0]?.ops).toEqual([{ op: 'unset', path: ['authFile'] }])
    expect(scope.applied.authFile).toBeUndefined()

    // Reset: the field goes back to what a cleared field resolves over, and a
    // save of an unchanged reset is a no-op the Host never sees.
    scope.user = { authFileAI: '/ai/auth.info' }
    actions.resetField('authFileAI')
    await actions.save()
    expect(scope.mutations[1]?.ops).toEqual([{ op: 'unset', path: ['authFileAI'] }])
  })

  it('refuses to save a boolean field whose text is not a state', async () => {
    const scope = new FakeSettingsScope()
    const controller = new WorkBuddyConfigController(scope)
    const actions = controller.inject()
    actions.edit('probeConsent', 'yes')
    const state = actions.hooks.workbuddyConfig.getSnapshot()
    expect(state.probeConsent).toMatchObject({ invalid: true })
    expect(state).toMatchObject({ invalid: true })
    await actions.save()
    expect(scope.mutations).toHaveLength(0)
  })

  it('keeps the drafts staged when the Host refuses the write', async () => {
    const scope = new FakeSettingsScope()
    scope.land = false
    const controller = new WorkBuddyConfigController(scope)
    const actions = controller.inject()
    actions.edit('authFile', '/x')
    await actions.save()
    expect(actions.hooks.workbuddyConfig.getSnapshot()).toMatchObject({ failed: true, dirty: true })
    // The staged text survives so the user can retry the same save.
    expect(actions.hooks.workbuddyConfig.getSnapshot().authFile).toMatchObject({ text: '/x' })
    // A later save against an accepting Host lands.
    scope.land = true
    await actions.save()
    expect(scope.mutations).toHaveLength(2)
    expect(scope.applied.authFile).toBe('/x')
  })

  it('does not approach the Host when the document is read-only', async () => {
    const scope = new FakeSettingsScope()
    scope.writable = false
    const controller = new WorkBuddyConfigController(scope)
    const actions = controller.inject()
    actions.edit('authFile', '/x')
    await actions.save()
    expect(scope.mutations).toHaveLength(0)
  })

  it('discards every staged edit at once', async () => {
    const scope = new FakeSettingsScope()
    const controller = new WorkBuddyConfigController(scope)
    const actions = controller.inject()
    actions.edit('authFile', '/x')
    actions.edit('authFileAI', '/y')
    actions.discard()
    expect(actions.hooks.workbuddyConfig.getSnapshot()).toMatchObject({ dirty: false })
    await actions.save()
    expect(scope.mutations).toHaveLength(0)
  })
})
