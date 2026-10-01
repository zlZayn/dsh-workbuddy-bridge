import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

/** Mirror the build-time define from tsdown.config.ts so tests see the same version. */
const PACKAGE_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  .version as string

/**
 * Stub CSS for the browser lane.
 *
 * The build compiles `x.module.css` into a class map (see `tsdown.config.ts`);
 * vitest resolves the import directly, so it needs the same shape. Returning the
 * key itself keeps `css.card === 'card'`, which is what assertions read.
 *
 * Official UI packages ship plain `*.css` side-effect imports too. Those are
 * invisible to assertions, so they collapse to an empty module.
 */
const cssStub = {
  name: 'css-stub',
  enforce: 'pre' as const,
  resolveId(id: string) {
    return id.endsWith('.css') ? `\0css:${id}` : null
  },
  load(virtualId: string) {
    if (!virtualId.startsWith('\0css:')) return null
    return virtualId.includes('.module.css')
      ? 'export default new Proxy({}, { get: (_target, key) => String(key) });'
      : 'export default {};'
  },
}

/**
 * The official packages the browser tests import carry bare `*.css` imports.
 * Vite only rewrites those for inlined modules, so exactly these two go through
 * the transform pipeline — no more, or the lane drags the whole @deepseek-ai
 * tree (shiki included) through it per file.
 */
const CSS_IMPORTING_OFFICIAL_PACKAGES = [
  /@deepseek-ai\/dsh-client-ui-primitives/,
  /@deepseek-ai\/dsh-client-store/,
] as const

/**
 * vitest 4's `projects` run each entry as its own vite server and do NOT
 * inherit vite-level options (`define`, `plugins`, `resolve`) from the
 * top-level config — only the `test` block is merged. The version define
 * therefore has to be repeated per project, or `src/version.ts` falls back
 * to its `'0.0.0-dev'` marker and `tests/version.spec.ts` goes red.
 */
const VERSION_DEFINE = { __DSH_WORKBUDDY_VERSION__: JSON.stringify(PACKAGE_VERSION) }

export default defineConfig({
  test: {
    /**
     * Sandbox/CI environments can degrade vitest's worker heuristic to a single
     * fork, serializing ~30 host specs into a >20 min run. Pin the pool size so
     * the lane stays parallel regardless of environment detection.
     */
    maxWorkers: 8,
    minWorkers: 2,
    /**
     * Coverage gate.
     *
     * `include` names TypeScript explicitly instead of the obvious `src/**`:
     * that directory also holds every subtree's `README.md`/`AGENTS.md`, two
     * `.module.css` files and one `.d.ts`, and the v8 provider parses whatever
     * it is handed — a bare `src/**` prints 20 `RolldownError: Parse failed`
     * stacks per run. Those files are dropped right after, so the numbers come
     * out identical; only the log noise is avoidable.
     *
     * `lib/**` is build output and `tests/**` is the harness itself — counting
     * either would let the number move without a line of source changing. The
     * `node_modules` entry backs that up: the browser lane inlines two official
     * packages, and their `//# sourceMappingURL=index.js.map` points at a map
     * they do not publish. A plain run only warns about it, but the v8
     * provider's remap throws.
     */
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['lib/**', 'tests/**', 'node_modules/**', '**/*.d.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 70, statements: 70, functions: 60, branches: 60 },
    },
    projects: [
      {
        define: VERSION_DEFINE,
        test: {
          name: 'host',
          include: ['tests/**/*.spec.ts'],
          exclude: ['tests/browser/**'],
          environment: 'node',
        },
      },
      {
        define: VERSION_DEFINE,
        plugins: [cssStub],
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.spec.ts'],
          environment: 'node',
          server: { deps: { inline: [...CSS_IMPORTING_OFFICIAL_PACKAGES] } },
        },
      },
    ],
  },
})
