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

  /**
   * `package.json` points consumers at the types via two fields (`types` and
   * `exports["."].types`), and both name a path **inside the published tarball**.
   * The build emits `lib/index.d.ts` / `lib/client.d.ts` at the package root of
   * `lib/` — it does not create a `lib/types/` directory — so a declaration that
   * drifted from the real layout makes TypeScript resolve nothing and fail
   * *silently*: the consumer just sees an untyped module.
   *
   * The drift is real, not hypothetical: from 0.1.0 through 0.2.0 the fields said
   * `lib/types/index.d.ts` while the build had never produced that path, so every
   * published version shipped declarations no consumer could reach. Asserting the
   * shipped layout (not the source tree) keeps this guard honest about what npm
   * will actually contain.
   */
  it('declares type entry points that the build really emits', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      types: string
      exports: Record<string, { types?: string }>
    }
    const libDir = new URL('../lib/', import.meta.url)
    if (!existsSync(libDir)) return

    // `npm pack` is what decides which files ship; `files` in package.json governs
    // it. A `types` path outside that set is unreachable even if the build emits it.
    const pkgDir = new URL('../', import.meta.url)
    const { files } = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { files: string[] }

    const declared = [
      pkg.types,
      ...(pkg.exports['.']?.types ? [pkg.exports['.'].types!] : []),
      ...(pkg.exports['./client']?.types ? [pkg.exports['./client'].types!] : []),
    ]
    expect(declared.length, 'package.json declares no type entry points').toBeGreaterThan(0)

    for (const entry of declared) {
      // `types` fields are conventionally prefixed `./`; normalise both spellings.
      const relative = entry.replace(/^\.\//, '').replace(/^\//, '')
      const onDisk = new URL(`./${relative}`, pkgDir)
      expect(
        existsSync(onDisk),
        `package.json declares type entry "${entry}" but the file does not exist — ` +
          'the build layout and the declaration have drifted, so consumers get no types',
      ).toBe(true)
      const shipped = files.some((pattern) => {
        const prefix = pattern.replace(/^\.\//, '').replace(/\/\*.*$/, '')
        return relative === prefix || relative.startsWith(`${prefix}/`)
      })
      expect(
        shipped,
        `type entry "${entry}" resolves on disk but is not covered by package.json "files" — ` +
          'it would be missing from the published tarball',
      ).toBe(true)
    }
  })
})
