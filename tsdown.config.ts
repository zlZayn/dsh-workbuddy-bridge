import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { basename, resolve as resolvePath, dirname } from 'node:path'
import { transform } from 'lightningcss'
import type { Plugin, UserConfig } from 'tsdown'

const PLUGIN_ID = 'dsh-workbuddy-bridge'

/** Read the npm version once so the build injects it into src/version.ts. */
const PACKAGE_VERSION = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version as string

/** Build-time define map; `src/version.ts` reads `__DSH_WORKBUDDY_VERSION__`. */
const VERSION_DEFINE = { __DSH_WORKBUDDY_VERSION__: JSON.stringify(PACKAGE_VERSION) }

/**
 * Modules the host loader provides, kept out of the browser bundle. The
 * client's DSH imports are type-only today — they erase at build time, so the
 * emitted bundle only requires React. The list is the guardrail that keeps a
 * future value import `require`d from the host instead of inlined.
 */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-locale/client',
] as const

/**
 * Virtual-id suffix. tsdown's own CSS guard matches ids ending in `.css`, so
 * the virtual id must not — the whole point is to keep module CSS away from a
 * pipeline that would need `@tsdown/css`.
 */
const CSS_VIRTUAL_PREFIX = '\0workbuddy-css:'
const CSS_VIRTUAL_SUFFIX = '.js'

/**
 * Emit a module that injects one stylesheet at factory execution and exports
 * its class map.
 *
 * The style tag is idempotent by `data-plugin-css`: the browser bundle is
 * loaded once per DSH page, but a hot reload or a second plugin mounting the
 * same module must not stack duplicate rules.
 */
function styleInjectionModule(
  id: string,
  fileId: string,
  css: string,
  classMap: Readonly<Record<string, string>>,
): string {
  const tagId = `${id}/${basename(fileId)}`
  return [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
    '  const tag = document.createElement(\'style\');',
    `  tag.dataset.plugin = ${JSON.stringify(id)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
    `export default ${JSON.stringify(classMap)};`,
  ].join('\n')
}

/**
 * CSS Modules for the browser bundle, the way DSH's own client packages build
 * them: `x.module.css` resolves to a virtual module that carries the compiled
 * stylesheet as a string and exports the hashed class map, so component code
 * writes `css.card` instead of an inline `CSSProperties` literal.
 */
function cssModulesPlugin(id: string): Plugin {
  return {
    name: 'workbuddy-css-modules',
    resolveId(source, importer) {
      if (!source.endsWith('.module.css')) return null
      const abs = importer !== undefined && source.startsWith('.')
        ? resolvePath(dirname(importer), source)
        : source
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      // The virtual id otherwise hides the stylesheet from the watch graph.
      this.addWatchFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: await readFile(fileId),
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
      return styleInjectionModule(id, fileId, code.toString(), classMap)
    },
  } as Plugin
}

export default [
  {
    entry: {
      index: 'src/index.ts',
      bin: 'src/cli/bin.ts',
    },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: true,
    define: VERSION_DEFINE,
    deps: {
      neverBundle: [
        '@earendil-works/pi-ai',
        '@deepseek-ai/schemastery',
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-atomic-write',
        '@deepseek-ai/dsh-attachment',
        '@deepseek-ai/dsh-home-paths',
        '@deepseek-ai/dsh-host-webserver',
        '@deepseek-ai/dsh-llm',
        '@deepseek-ai/dsh-llm-pi-ai',
        '@deepseek-ai/dsh-settings',
      ],
    },
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    dts: false,
    clean: false,
    define: VERSION_DEFINE,
    deps: { neverBundle: [...CLIENT_EXTERNALS] },
    plugins: [cssModulesPlugin(PLUGIN_ID)],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
] satisfies UserConfig[]
