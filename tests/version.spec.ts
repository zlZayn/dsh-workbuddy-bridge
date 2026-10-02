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
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string
    }
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
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string
    }
    const bundles = readdirSync(libDir).filter((name) => name.endsWith('.js'))
    expect(
      bundles.length,
      'no built bundles in lib/ — run the build before this test',
    ).toBeGreaterThan(0)
    const declaring = bundles.filter((bundle) =>
      readFileSync(new URL(`../lib/${bundle}`, import.meta.url), 'utf8').includes(
        `WORKBUDDY_BRIDGE_VERSION = "${pkg.version}"`,
      ),
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
   * `"<local>": "<hash>_<local>"` pairs.
   *
   * Guards tsdown.config.ts's cssModulesPlugin, which sorts the keys before
   * emitting them (lightningcss returns `exports` in a non-deterministic order).
   *
   * **The order is per stylesheet, not per bundle.** The plugin sorts one
   * stylesheet's map; the bundle then concatenates those maps in source order,
   * so a class appearing in two stylesheets appears twice and the *global*
   * sequence is only incidentally ascending. Sorting the whole bundle used to
   * be asserted and passed by luck: lightningcss derives `[hash]` from the
   * stylesheet's **absolute path**, and a hash starting with a digit is escaped
   * to a leading underscore, which the old scan's `"[0-9a-zA-Z]+_…"` pattern
   * silently skipped. Checking a checkout at a different path (or a new
   * stylesheet whose hash starts with a letter) therefore flipped this red
   * without any real regression — so each module's run is checked instead,
   * which is the guarantee the plugin actually makes.
   */
  it('emits each stylesheet’s CSS class map in a stable, sorted order', () => {
    const libDir = new URL('../lib/', import.meta.url)
    if (!existsSync(libDir)) return
    const bundle = readdirSync(libDir).find((name) => name === 'client.js')
    if (bundle === undefined) return
    const text = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

    // One entry per `"<hash>_<local>"` literal, carrying the hash so runs from
    // different stylesheets can be told apart. The leading `-` and `_` matter:
    // lightningcss escapes a digit-leading hash with `_`, so requiring an
    // alphanumeric first character is what hid whole stylesheets before.
    const pairs = [...text.matchAll(/"([A-Za-z][\w]*)": "(-?[0-9a-zA-Z]+)_\1"/g)].map((match) => ({
      local: match[1] as string,
      hash: match[2] as string,
    }))
    // Self-check: the scan must actually see a class map.
    expect(
      pairs.length,
      'no CSS class map found in lib/client.js — is the scan still right?',
    ).toBeGreaterThan(0)

    // Rebuild the run lengths in emission order: consecutive entries sharing a
    // hash are one stylesheet's sorted map.
    const runs: { hash: string; keys: string[] }[] = []
    for (const pair of pairs) {
      const current = runs.at(-1)
      if (current !== undefined && current.hash === pair.hash) current.keys.push(pair.local)
      else runs.push({ hash: pair.hash, keys: [pair.local] })
    }
    for (const run of runs) {
      expect(
        run.keys,
        `CSS class map for hash "${run.hash}" is not sorted — the build is non-deterministic`,
      ).toEqual([...run.keys].sort())
    }
  })
})
