/**
 * Live end-to-end check (NOT part of the offline test suite):
 * adapter -> pi-ai -> loopback shim -> real WorkBuddy upstream, using the
 * WorkBuddy desktop app's credential. Run from the package root:
 *
 *   node scripts/live-e2e.mjs
 */

import {
  createWorkBuddyAdapter,
  createWorkBuddyShim,
  WorkBuddyCatalog,
  WorkBuddyCredentialStore,
  WorkBuddyUpstreamClient,
} from '../lib/index.js'

const client = new WorkBuddyUpstreamClient()
const store = new WorkBuddyCredentialStore({
  refresh: (credential) => client.refreshToken(credential),
})
const catalog = new WorkBuddyCatalog()
const shim = createWorkBuddyShim({ store, client, catalog })
await shim.ready
console.log('shim listening:', shim.baseUrl())

const { adapter, invalidate } = createWorkBuddyAdapter({ shim, store, catalog })

const staticList = await adapter.listModels('workbuddy')
console.log('static catalog:', staticList.map((model) => model.id).join(', '))

const credential = await store.current()
if (credential === undefined) {
  console.error('not signed in: open the WorkBuddy desktop app once')
  process.exit(1)
}
const refreshed = await client.fetchModels(credential)
catalog.set([...refreshed])
invalidate()
const liveList = await adapter.listModels('workbuddy')
console.log('upstream catalog:', liveList.map((model) => model.id).join(', '))

/*
 * Pick the model from what upstream just answered, cheapest first.
 *
 * This used to hardcode `auto`, which was in the catalog when the script was
 * written and is gone now (2026-10-03) — so the check failed with UNKNOWN_MODEL
 * on a healthy chain. The catalog churns by design (see the note in
 * src/protocol/client.ts), so a check of the chain must not also be a check that
 * one particular model still exists. Cheapest first keeps the credit it spends
 * as small as the catalog allows.
 */
const rateOf = (model) => {
  const raw = String(model.billing?.credits ?? '').replace(/^x/iu, '')
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
}
const chosen = [...liveList].sort((a, b) => rateOf(a) - rateOf(b))[0]
if (chosen === undefined) throw new Error('upstream returned no models to check')
console.log('chosen model:', chosen.id, `(rate x${rateOf(chosen)})`)

const resolved = await adapter.resolveModel('workbuddy', chosen.id)
console.log('resolved:', JSON.stringify(resolved))

console.log('streaming one reply …')
let text = ''
let usage
for await (const chunk of adapter.stream({
  provider: 'workbuddy',
  model: chosen.id,
  system: '你是简洁的中文助手。',
  messages: [
    {
      id: 'e2e-1',
      role: 'user',
      content: [{ type: 'text', text: '只回复八个字以内：链路验证成功' }],
      source: { kind: 'user' },
    },
  ],
})) {
  if (chunk.type === 'text-delta' || chunk.type === 'text') {
    text += chunk.text ?? chunk.delta ?? ''
  } else if (chunk.type === 'usage' || chunk.usage !== undefined) {
    usage = chunk.usage ?? chunk
  }
}
console.log('reply:', JSON.stringify(text))
console.log('usage:', usage !== undefined ? JSON.stringify(usage) : '(none reported)')

const credits = await client.fetchCredits(await store.current())
console.log('remaining credit:', credits.total)
await shim.close()
console.log('E2E OK')
