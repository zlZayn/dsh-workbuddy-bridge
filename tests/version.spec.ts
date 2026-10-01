import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { WORKBUDDY_BRIDGE_VERSION } from '../src/version.ts'

/**
 * The keys of every `"<local>": "<hash>_<local>"` object literal, one array per
 * literal.
 *
 * Deliberately loose about the *shape* and strict about the *ties*, because every
 * one of these assumptions failed on a real runner (2026-10-01, first three-platform
 * run):
 * - one `.module.css` yields one map, so a bundle holds several, and their relative
 *   order in the file is not a contract this test can assert;
 * - rolldown prints the same literal compactly or expanded depending on the
 *   platform, with bare or quoted keys — an exact `"key": "` match scanned only
 *   part of the bundle;
 * - the hash segment may start with `_` (`_1kHyqG_assist`), so a `[0-9a-zA-Z]+`
 *   value pattern silently skipped a whole map.
 */
function classMapBlocks(text: string): string[][] {
  const pair = /(?:"([A-Za-z][\w]*)":|([A-Za-z][\w]*):)\s*"([\w]+)_([A-Za-z][\w]*)"/g
  const matches: { key: string; index: number; raw: string }[] = []
  for (const match of text.matchAll(pair)) {
    const key = match[1] ?? match[2]
    // The value's tail repeating the key is what makes this scan specific.
    if (key === undefined || key !== match[4]) continue
    matches.push({ key, index: match.index, raw: match[0] })
  }
  const blocks: string[][] = []
  let current: string[] = []
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]!
    if (i > 0) {
      const previous = matches[i - 1]!
      // A `}` between two pairs means they belong to different literals.
      const between = text.slice(previous.index + previous.raw.length, match.index)
      if (between.includes('}')) {
        blocks.push(current)
        current = []
      }
    }
    current.push(match.key)
  }
  if (current.length > 0) blocks.push(current)
  return blocks
}

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
   * `lib/` is tracked in this repository, so every emitted class map must be in a
   * stable order: an unstable build turns every rebuild into a diff and makes
   * "did the artifact change?" unanswerable. Each map is emitted as
   * `"<local>": "<hash>_<local>"` pairs — assert each one comes out sorted.
   *
   * Guards tsdown.config.ts's cssModulesPlugin, which sorts the keys before
   * emitting them (lightningcss returns `exports` in a non-deterministic order).
   */
  it('emits the CSS class map in a stable, sorted order', () => {
    const libDir = new URL('../lib/', import.meta.url)
    if (!existsSync(libDir)) return
    const bundle = readdirSync(libDir).find((name) => name === 'client.js')
    if (bundle === undefined) return
    const blocks = classMapBlocks(
      readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'),
    )
    // Self-check: the scan must actually see a class map.
    expect(
      blocks.length,
      'no CSS class map found in lib/client.js — is the scan still right?',
    ).toBeGreaterThan(0)
    for (const keys of blocks) {
      expect(keys, 'CSS class map is not sorted — the build is non-deterministic').toEqual(
        [...keys].sort(),
      )
    }
    // Reverse control: the extractor sees an unsorted block, does not glue two blocks
    // together, and is not fooled by the hash or key shapes the runners produce.
    expect(classMapBlocks('{ "b": "h_b", "a": "h_a" }')).toEqual([['b', 'a']])
    expect(classMapBlocks('{ "a": "h_a" }; { "b": "h_b" }')).toEqual([['a'], ['b']])
    // A leading underscore in the hash segment, and a bare key: both were skipped by
    // the previous pattern, which is how a whole map stayed invisible on one platform.
    expect(classMapBlocks('{ "x": "_h_x" }')).toEqual([['x']])
    expect(classMapBlocks('{ x: "_h_x" }')).toEqual([['x']])
    // The backreference tie still holds: an unrelated pair is not a class map.
    expect(classMapBlocks('{ "x": "h_other" }')).toEqual([])
  })
})
