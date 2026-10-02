/**
 * CSS-module class references must resolve.
 *
 * Every component imports exactly one `*.module.css` and reads classes off its
 * default export (`css.card`). Nothing type-checks those names: the module
 * declaration in `css-modules.d.ts` types the export as a loose record, so a
 * typo or a class that was renamed in the stylesheet but not in the JSX compiles
 * cleanly and renders **unstyled**. The failure is silent by construction —
 * `css.sectionn` is `undefined`, React drops the attribute, and the block simply
 * loses its layout.
 *
 * That is why this is a test rather than a convention: the two halves (class
 * names in CSS, references in TSX) live in different files with no shared
 * symbol, and only a scan can hold them together.
 *
 * The check is per-module on purpose. A global "is this name defined anywhere"
 * would pass a reference to another module's class — which is the same bug, one
 * step harder to see, because the stylesheet does define the name.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CLIENT_DIR = new URL('../src/client/', import.meta.url)

/** `[A-Za-z][\w]*` class selectors declared at the start of a line. */
function declaredClasses(css: string): Set<string> {
  const names = new Set<string>()
  for (const match of css.matchAll(/^\.([A-Za-z][\w]*)/gm)) names.add(match[1]!)
  return names
}

/** Every `import <binding> from './<file>.module.css'` in one source file. */
function cssImports(source: string): { binding: string; file: string }[] {
  return [...source.matchAll(/import\s+(\w+)\s+from\s+'\.\/([\w.-]+\.module\.css)'/g)].map(
    (match) => ({ binding: match[1]!, file: match[2]! }),
  )
}

describe('CSS module class references', () => {
  it('every css.<name> reference is declared in the module it was imported from', () => {
    const sources = readdirSync(CLIENT_DIR).filter(
      (name) => name.endsWith('.tsx') || name.endsWith('.ts'),
    )
    const declared = new Map<string, Set<string>>()
    for (const name of readdirSync(CLIENT_DIR)) {
      if (!name.endsWith('.module.css')) continue
      declared.set(name, declaredClasses(readFileSync(new URL(name, CLIENT_DIR), 'utf8')))
    }
    // Self-check: the scan must actually be finding stylesheets and classes, or
    // this test would pass by finding nothing to check.
    expect(declared.size, 'no *.module.css found — is the scan still right?').toBeGreaterThan(0)
    expect(
      [...declared.values()].reduce((total, set) => total + set.size, 0),
      'no class selectors found — is the scan still right?',
    ).toBeGreaterThan(0)

    const missing: string[] = []
    let checked = 0
    for (const name of sources) {
      const source = readFileSync(new URL(name, CLIENT_DIR), 'utf8')
      for (const { binding, file } of cssImports(source)) {
        const own = declared.get(file)
        if (own === undefined) {
          missing.push(`${name}: imports ${file}, which does not exist`)
          continue
        }
        const pattern = new RegExp(`${binding}\\.([A-Za-z][\\w]*)`, 'g')
        for (const match of source.matchAll(pattern)) {
          checked += 1
          if (!own.has(match[1]!)) {
            missing.push(`${name}: ${binding}.${match[1]} is not declared in ${file}`)
          }
        }
      }
    }
    // Self-check on the other side: references must actually have been read.
    expect(checked, 'no css.<name> references found — is the scan still right?').toBeGreaterThan(0)
    expect(missing).toEqual([])
  })
})
