import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { WORKBUDDY_BRIDGE_VERSION } from '../src/version.ts'

/**
 * Guard the single-source-of-truth version contract:
 * - the build-time define injects package.json's version into src/version.ts;
 * - if that define is ever dropped, version.ts falls back to '0.0.0-dev' and
 *   this test goes red, flagging the regression (and the drift it would cause
 *   in heartbeat / CLI output).
 */
describe('package version sync', () => {
  it('WORKBUDDY_BRIDGE_VERSION matches package.json', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string }
    expect(WORKBUDDY_BRIDGE_VERSION).toBe(pkg.version)
  })

  it('never leaks a build-define fallback marker', () => {
    expect(WORKBUDDY_BRIDGE_VERSION).not.toBe('0.0.0-dev')
  })

  /**
   * The define reads package.json at BUILD time, so a release that bumps the
   * version after building ships artifacts reporting the old one (issue #1:
   * v0.2.2 bundles said 0.2.1). Skipped on a fresh clone before the first build.
   *
   * The version literal may land in `index.js` or in a shared chunk beside it
   * (rollup decides which, and the chunk's hashed filename changes with the
   * module graph), so every emitted `.js` is scanned rather than one guessed
   * filename. Searching all of them is what keeps this guard meaningful: the
   * assertion is "the shipped artifacts carry this version", not "the bundle
   * was laid out this way".
   */
  it('built lib/ artifacts carry the current version when present', () => {
    const libDir = new URL('../lib/', import.meta.url)
    if (!existsSync(libDir)) return
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string }
    const bundles = readdirSync(libDir).filter(name => name.endsWith('.js'))
    expect(bundles.length, 'no built bundles in lib/ — run the build before this test').toBeGreaterThan(0)
    const declaring = bundles.filter(bundle =>
      readFileSync(new URL(`../lib/${bundle}`, import.meta.url), 'utf8')
        .includes(`WORKBUDDY_BRIDGE_VERSION = "${pkg.version}"`),
    )
    expect(
      declaring,
      `no built bundle declares WORKBUDDY_BRIDGE_VERSION as "${pkg.version}" — rebuild before committing or publishing`,
    ).not.toHaveLength(0)
  })

  /**
   * `lib/` is tracked in this repository, so the emitted class map must be in a
   * stable order: an unstable build turns every rebuild into a diff and makes
   * "did the artifact change?" unanswerable. The map is emitted as
   * `"<local>": "<hash>_<local>"` pairs — assert those keys come out sorted.
   *
   * Guards tsdown.config.ts's cssModulesPlugin, which sorts the keys before
   * emitting them (lightningcss returns `exports` in a non-deterministic order).
   */
  it('emits the CSS class map in a stable, sorted order', () => {
    const libDir = new URL('../lib/', import.meta.url)
    if (!existsSync(libDir)) return
    const bundle = readdirSync(libDir).find(name => name === 'client.js')
    if (bundle === undefined) return
    const text = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
    const keys = [...text.matchAll(/"([A-Za-z][\w]*)": "[0-9a-zA-Z]+_\1"/g)].map(match => match[1] as string)
    // Self-check: the scan must actually see the class map.
    expect(keys.length, 'no CSS class map found in lib/client.js — is the scan still right?').toBeGreaterThan(0)
    expect(keys, 'CSS class map is not sorted — the build is non-deterministic').toEqual([...keys].sort())
  })
})
