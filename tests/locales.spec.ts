/**
 * Every locale key must be wired to something.
 *
 * The dictionary is written as a flat key set plus two bundles, so **nothing
 * type-checks that a key is ever read**: removing a UI element leaves its words
 * behind, and the drift is invisible — the key still type-checks, still
 * translates, and simply never renders. Two were already dead when this guard
 * was written (`creditRemainingUnknown`, `probeFailed`), both orphaned by panel
 * rewrites that replaced the string they were named for.
 *
 * The opposite direction needs no test: a key that is *read* but not declared
 * fails to compile, because `WorkBuddyLocaleKey` is a closed union.
 *
 * Counting is done on **quoted** occurrences, which makes the two kinds of
 * occurrence distinguishable inside `locales.ts` itself:
 *
 * - `| 'key'` in the union — one quote, and by itself it means nothing;
 * - `key: 'value'` in a bundle — the key is unquoted, so it does not count;
 * - `t('key')` in a helper such as `formLabels` — one more quote.
 *
 * So a key whose only quoted occurrence is its union entry is unwired. Checking
 * "does the identifier appear anywhere" instead would pass every dead key whose
 * name happens to read like ordinary prose (`save`, `unavailable`).
 */

import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const LOCALES = new URL('../src/client/locales.ts', import.meta.url)

/** Every `.ts` / `.tsx` under a directory, excluding the dictionary itself. */
function sources(dir: URL): URL[] {
  const found: URL[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir)
    if (entry.isDirectory()) found.push(...sources(child))
    else if (/\.tsx?$/.test(entry.name) && !child.href.endsWith('/client/locales.ts')) {
      found.push(child)
    }
  }
  return found
}

/** How many times a key appears quoted in a body of text. */
function quoted(text: string, key: string): number {
  return text.split(`'${key}'`).length - 1
}

describe('locale keys', () => {
  it('has no key that nothing reads', () => {
    const dictionary = readFileSync(LOCALES, 'utf8')
    const union = dictionary.slice(
      dictionary.indexOf('export type WorkBuddyLocaleKey'),
      dictionary.indexOf('const en'),
    )
    const keys = [...union.matchAll(/\|\s*'([A-Za-z]\w*)'/g)].map((match) => match[1]!)
    // Self-check: the scan has to be finding the key set, or this passes by
    // finding nothing.
    expect(keys.length, '没扫到任何词条键 —— 扫描失效了？').toBeGreaterThan(50)

    const consumers = [
      ...sources(new URL('../src/', import.meta.url)),
      ...sources(new URL('../tests/', import.meta.url)),
    ]
      .map((url) => readFileSync(url, 'utf8'))
      .join('\n')

    const dead = keys.filter((key) => quoted(consumers, key) === 0 && quoted(dictionary, key) <= 1)
    expect(dead, '这些词条没有任何地方读它 —— 删掉，或把它接上').toEqual([])
  })
})
