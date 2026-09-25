/**
 * 红线：这些不是风格偏好，是「错了会静默坏掉」的不变量。
 *
 * 每条都尽量写成**可执行**的：读源码 / 读清单 / 读锁文件，而不是复述散文。
 * 扫描类的断言一律自带「扫描器真的看到了东西」的自检 —— 否则它就是永不触发的假绿。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string
  version: string
  private?: boolean
  engines: { node: string; dsh?: string }
  exports: Record<string, unknown>
  files: string[]
  icon?: string
  dsh: { bundle?: { patch?: string }; client?: { platform?: string; inject?: string[] } }
  peerDependencies: Record<string, string>
  devDependencies: Record<string, string>
}

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

describe('依赖分层', () => {
  it('@deepseek-ai/* 绝不进 dependencies', () => {
    const deps = (pkg as { dependencies?: Record<string, string> }).dependencies ?? {}
    expect(Object.keys(deps).filter((name) => name.startsWith('@deepseek-ai/'))).toEqual([])
  })

  it('每个 peer 都同时在 dev —— 否则本机装不出可编译的树', () => {
    const missing = Object.keys(pkg.peerDependencies).filter((name) => pkg.devDependencies[name] === undefined)
    expect(missing).toEqual([])
  })

  it('dsh 平台包的 peer 与 dev 都必须能读出一个下限', () => {
    const bounds = Object.keys(pkg.peerDependencies).filter((name) => name.startsWith('@deepseek-ai/dsh'))
    // 自检：这条断言必须真的有对象可查。
    expect(bounds.length).toBeGreaterThan(0)
    for (const name of bounds) expect(pkg.devDependencies[name], name).toBeTruthy()
  })
})

describe('插件清单', () => {
  it('声明宿主兼容范围', () => {
    expect(typeof pkg.engines.dsh).toBe('string')
    expect((pkg.engines.dsh ?? '').trim()).not.toBe('')
  })

  it('客户端入口是 exports["./client"]，且声明了 web 平台', () => {
    expect(pkg.exports['./client']).toBeTruthy()
    expect(pkg.dsh.client?.platform).toBe('web')
  })

  it('dsh.client.inject 只列真实客户端图行（不夹带类型面）', () => {
    const inject = pkg.dsh.client?.inject ?? []
    // 自检：扫描器必须看到一份非空清单。
    expect(inject.length).toBeGreaterThan(0)
    const suspicious = inject.filter((name) => !name.startsWith('@deepseek-ai/'))
    expect(suspicious).toEqual([])
  })

  it('展示元数据与图标都在 files 覆盖里', () => {
    expect(pkg.files).toContain('icon.svg')
    expect(pkg.files).toContain('locale/*.json')
    expect(pkg.exports['./locale/*.json']).toBe('./locale/*.json')
  })

  it('dsh.bundle 的有无必须与 private 一致（否则被 dsh plugin 回填成双挂载）', () => {
    const declaresBundle = pkg.dsh.bundle?.patch !== undefined
    expect(declaresBundle).toBe(pkg.private !== true)
  })
})

describe('锁文件与源', () => {
  it('本仓的 .npmrc 不许把 registry 指到镜像站', () => {
    if (!existsSync(new URL('../.npmrc', import.meta.url))) return
    const npmrc = read('.npmrc')
    // 判据与另两仓一致：仓库级配置不覆盖 registry，跟随使用者/CI 的官方源。
    expect(npmrc).not.toMatch(/registry\s*=\s*https?:\/\/[^\s]*npmmirror/)
    expect(npmrc).not.toMatch(/registry\s*=\s*https?:\/\/[^\s]*taobao/)
  })
})

describe('插件展示元数据', () => {
  const localeDir = new URL('../locale/', import.meta.url)
  const localeFiles = readdirSync(localeDir).filter((name) => name.endsWith('.json')).sort()

  it('en.json 是发现入口，且存在', () => {
    expect(localeFiles).toContain('en.json')
  })

  it('中英两份的键集逐字相同，且只有 title / description', () => {
    expect(localeFiles.length).toBeGreaterThan(1)
    const shapes = localeFiles.map((name) => {
      const parsed = JSON.parse(readFileSync(new URL(name, localeDir), 'utf8')) as { meta: Record<string, string> }
      return { name, keys: Object.keys(parsed.meta).sort() }
    })
    for (const shape of shapes) expect(shape.keys, shape.name).toEqual(['description', 'title'])
    for (const shape of shapes.slice(1)) expect(shape.keys, shape.name).toEqual(shapes[0]!.keys)
  })

  it('门面点名的插件显示名与 locale 的标题逐字一致', () => {
    const en = JSON.parse(read('locale/en.json')) as { meta: { title: string } }
    const readme = read('README.md')
    const readmeEn = read('README_en.md')
    // 自检：门面里必须真的点了这个名 —— 否则这条断言查的是一个没人提的名字。
    expect(readme).toContain(en.meta.title)
    expect(readmeEn).toContain(en.meta.title)
  })
})

describe('插件图标', () => {
  it('是良构 XML 且声明的路径在包内', () => {
    expect(pkg.icon).toBe('./icon.svg')
    const svg = read('icon.svg')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
    // 标签成对：开标签数 == 闭标签数（自闭合的 <circle ... /> 不计）。
    const opens = (svg.match(/<[a-zA-Z][\w:-]*(?![^>]*\/>)[^>]*>/g) ?? []).length
    const closes = (svg.match(/<\/[a-zA-Z][\w:-]*>/g) ?? []).length
    expect(opens).toBe(closes)
  })

  /**
   * 控件与插件页图标必须是**同一个字形**，而且那个字形来自宿主。
   *
   * 自绘图标在这条 chrome 里天然显生：邻居全是宿主自己的图标（16 格 / 1px 笔画 /
   * currentColor）。所以控件直接渲染宿主的 IconThinkOutlineRegular，本仓不再维护一份
   * 私有墨迹；插件页的 icon.svg 是它放大后的副本。
   *
   * 两处都要核：控件**不许**再出现自绘 svg，icon.svg 的路径必须与宿主逐字相同。
   */
  it('控件用宿主的字形，icon.svg 是它的等比放大', () => {
    const svg = read('icon.svg')
    const control = read('src/client/probe-control.tsx')
    // 控件渲染宿主的图标组件。
    expect(control).toContain('IconThinkOutlineRegular')
    expect(control).not.toContain('<svg')
    // 36 画布 + 16 格 × scale(2)：整组落到 2–34，四周各留 2，笔画 1 → 2。
    expect(svg).toContain('viewBox="0 0 36 36"')
    expect(svg).toContain('translate(2 2) scale(2)')
    // 自检：真源里确实取到了两条路径，免得下面的循环空转成假绿。
    const hostPaths = [
      'M10.7554 5.24466C13.9891 8.4783 15.3769 12.3333 13.8552 13.8551C12.3335 15.3768 8.4785 13.989 5.24478 10.7553C2.01111 7.52165 0.623307 3.66664 2.14504 2.14491C3.66676 0.623189 7.52178 2.01099 10.7554 5.24466Z',
      'M10.7554 10.7553C7.52178 13.989 3.66676 15.3768 2.14504 13.8551C0.623307 12.3333 2.01111 8.4783 5.24478 5.24466C8.4785 2.01099 12.3335 0.623189 13.8552 2.14491C15.3769 3.66664 13.9891 7.52165 10.7554 10.7553Z',
    ]
    expect(hostPaths.length).toBe(2)
    for (const d of hostPaths) expect(svg, '图标里应有宿主那条路径').toContain(d)
  })
})

/**
 * 菜单材质成对：凡用 `--dsw-specific-menu` 画背景的表面，必须在**同一条规则**里带
 * `--dsw-menu-backdrop-filter`。宿主把菜单材质拆成了这两条 token，只写填充就是
 * 「透光但不磨砂」；而宿主自己的门禁只扫官方包，插件侧没有任何自动保护。
 *
 * 判据抄 dsh-ds-balance 的同形红线。
 */
describe('菜单材质成对', () => {
  it('画了 --dsw-specific-menu 的规则，同一条里必有 backdrop-filter', () => {
    const files = ['src/client/probe-control.module.css', 'src/client/workbuddy.module.css']
    let checked = 0
    for (const file of files) {
      const css = read(file)
      // 按规则块切：选择器 { ... }，花括号不嵌套（本仓的 CSS 没有 @media 嵌这些 token）。
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!(body ?? '').includes('--dsw-specific-menu')) continue
        checked += 1
        expect(
          body,
          `${file} 的 ${(selector ?? '').trim()} 画了菜单填充却没有 backdrop-filter`,
        ).toContain('--dsw-menu-backdrop-filter')
      }
    }
    // 自检：真的扫到了那条规则，否则这个断言永不触发。
    expect(checked, '没有扫到任何菜单填充规则 —— 判据是不是失效了？').toBeGreaterThan(0)
  })
})

/**
 * 浏览器半体的产物守卫：**绝不把宿主提供的运行时打进包里**。
 *
 * 2026-09-25 真机事故：`probe-control.tsx` 用了 `react-dom` 的 `createPortal`，
 * 而 `tsdown.config.ts` 的 `CLIENT_EXTERNALS` 里没有它 —— rolldown 于是把整份
 * react-dom 内联进来（80 KB → 1 MB），它模块顶层的 `process.env.NODE_ENV` 判断
 * 在浏览器里直接抛 `process is not defined`，插件装载失败、整页报 import error。
 *
 * 判据放在**产物**上而不是源码上：源码里写 import 是正常的，错的是它没被外部化。
 */
describe('浏览器半体产物不内联宿主运行时', () => {
  const clientPath = new URL('../lib/client.js', import.meta.url)
  const bundle = existsSync(clientPath) ? readFileSync(clientPath, 'utf8') : undefined

  /** 宿主在工厂里 `require` 得到的模块：产物的 require 只允许出现这些。 */
  const HOST_PROVIDED = [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react-dom/client',
    // staticLinked 平台模块，由宿主装载器提供。
    '@deepseek-ai/dsh-client-ui-primitives',
  ]

  it('产物只 require 宿主提供的模块', () => {
    if (bundle === undefined) return
    const required = [...bundle.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1] as string)
    // 自检：真的扫到了 require，否则这条断言永不触发。
    expect(required.length, '产物里一个 require 都没有 —— 扫描失效了？').toBeGreaterThan(0)
    const inlined = [...new Set(required)].filter(name => !HOST_PROVIDED.includes(name))
    expect(
      inlined,
      '这些模块被打进了产物；应加进 tsdown.config.ts 的 CLIENT_EXTERNALS',
    ).toEqual([])
  })

  it('产物里没有 process 引用（内联 React 运行时的signature）', () => {
    if (bundle === undefined) return
    expect(bundle).not.toMatch(/\bprocess\b/)
    expect(bundle).not.toMatch(/NODE_ENV/)
  })

  it('产物体积在量级上正常（内联运行时会让它涨十倍）', () => {
    if (bundle === undefined) return
    // 实际约 84 KB；阈值给到 256 KB，只为拦住「整份运行时被内联」这一种情况。
    expect(bundle.length, '客户端产物异常膨胀，检查是不是有依赖被内联了').toBeLessThan(262144)
  })
})

/**
 * 插件页的样式纪律。
 *
 * 这一页长在宿主的 Plugins 页里，所以它的字号、间距、圆角、焦点环都应当是**宿主的**，
 * 不是本插件自己的一档。抄错的表现是「看起来像外来的」，而且是和昨天比出来的 ——
 * 所以判据放在源码上，不靠眼睛。
 *
 * 取值真源：宿主 `ui-primitives/lib/settings-form/fields.module.css` 与
 * `SettingsForm.module.css`（label 13/1.5 w500 primary、hint 12/1.5 tertiary、
 * invalid 12/1.5 error；中性边框 0.5px；圆角与焦点环走 token）。
 */
describe('插件页样式跟着宿主走', () => {
  const sheets = ['src/client/workbuddy.module.css', 'src/client/probe-control.module.css']

  it('不写字面色值', () => {
    let checked = 0
    for (const file of sheets) {
      const css = read(file)
      // 先把注释剥掉：说明文字里提到某个 token 名不算使用它。
      const body = css.replace(/\/\*[\s\S]*?\*\//g, '')
      const literals = body.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsl\(/g) ?? []
      expect(literals, `${file} 里有字面色值`).toEqual([])
      checked += body.length
    }
    // 自检：真的读到了样式内容。
    expect(checked).toBeGreaterThan(2000)
  })

  it('字号只用宿主的两档：13（标签/正文）与 12（说明）', () => {
    for (const file of sheets) {
      const body = read(file).replace(/\/\*[\s\S]*?\*\//g, '')
      const sizes = [...body.matchAll(/font-size:\s*([^;]+);/g)].map(m => (m[1] ?? '').trim())
      expect(sizes.length, `${file} 里一个 font-size 都没有 —— 扫描失效了？`).toBeGreaterThan(0)
      const offScale = [...new Set(sizes)].filter(size => size !== '13px' && size !== '12px')
      expect(offScale, `${file} 出现了宿主没有的字号档`).toEqual([])
    }
  })

  it('line-height 只用 1.5 / 1.6（宿主那两档）', () => {
    for (const file of sheets) {
      const body = read(file).replace(/\/\*[\s\S]*?\*\//g, '')
      const heights = [...body.matchAll(/line-height:\s*([^;]+);/g)].map(m => (m[1] ?? '').trim())
      const offScale = [...new Set(heights)].filter(value => value !== '1.5' && value !== '1.6')
      expect(offScale, `${file} 出现了非宿主档的 line-height`).toEqual([])
    }
  })

  it('中性描边一律 0.5px（状态色才允许 1px）', () => {
    for (const file of sheets) {
      const body = read(file).replace(/\/\*[\s\S]*?\*\//g, '')
      for (const [, width, rest] of body.matchAll(/border(?:-top|-bottom)?:\s*([\d.]+)px\s+solid\s+([^;]+);/g)) {
        const ink = rest ?? ''
        // 1px 只留给状态色；其余中性描边一律 0.5px。
        if (width === '1px') expect(ink, `${file} 的中性描边写成了 1px`).toMatch(/state-/)
        else expect(width, `${file} 的描边宽度不在 {0.5px, 1px} 里`).toBe('0.5')
      }
    }
  })

  it('焦点环走宿主的 --dsw-focus-ring-* token，而不是自己写一圈', () => {
    const rings = ['src/client/probe-control.module.css']
    let found = 0
    for (const file of rings) {
      const body = read(file).replace(/\/\*[\s\S]*?\*\//g, '')
      for (const [, rule] of body.matchAll(/:focus-visible[^{]*\{([^}]*)\}/g)) {
        found += 1
        expect(rule, `${file} 的焦点环没走宿主 token`).toContain('--dsw-focus-ring-width')
        expect(rule, `${file} 的焦点环还带了字面色`).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      }
    }
    expect(found, '没扫到任何 :focus-visible 规则 —— 扫描失效了？').toBeGreaterThan(0)
  })
})

describe('客户端接缝', () => {
  it('推理等级控件注在 list 槽上，绝不注 single 槽', () => {
    const source = read('src/client/index.tsx')
    // 自检：源码里必须真的有这条注册。
    expect(source).toContain('slots.register(')
    expect(source).toContain("conversation.input.right")
    // conversation.input.model 是 single 槽，宿主自带 ModelSelect 已占 priority 0；
    // 注上去会抛错并顶掉宿主的模型选择器（2026-09-25 的缺陷）。
    expect(source).not.toContain("'conversation.input.model'")
  })

  it('配置页注册在 plugins.bundle.config，key 取包名', () => {
    const source = read('src/client/index.tsx')
    expect(source).toContain("plugins.bundle.config")
    expect(source).toContain(`const BUNDLE_NAME = '${pkg.name}'`)
  })

  /**
   * 设置命名空间是 **loader 条目 id**，不是包名 —— 两个不同的东西。
   *
   * 宿主 `dsh-settings/lib/index.js:432,443` 把每个插件的 `Config` 文档发布成
   * `ns: entry.options.id`。而 `ctx.configForms.get()` 收的就是命名空间。
   * 传包名的表现是**静默**的：那个命名空间从没被服务过，`whileServed` 永不触发，
   * 配置页根本不出现 —— 没有报错、没有日志。
   *
   * 2026-09-25 真机就是这条：条目 id 是 `llm-workbuddy`，客户端却问包名。
   * 所以这里把两个 id 各自的出处都钉住：包名 → 槽 key，条目 id → 命名空间。
   */
  it('configForms.get() 的实参取自 cordis.patch.yml 的 insert id，不是包名', () => {
    const source = read('src/client/index.tsx')
    const patch = read('cordis.patch.yml')
    const entryId = /-\s*id:\s*(\S+)/.exec(patch)?.[1]
    // 自检：patch 里必须真的能读出一个条目 id。
    expect(entryId, 'cordis.patch.yml 里读不出 insert id').toBeTruthy()
    expect(source).toContain(`export const ENTRY_ID = '${entryId as string}'`)
    expect(source).toContain('ctx.configForms.get(ENTRY_ID)')
    expect(source).toContain('whileServed([ENTRY_ID]')
    // 反过来：不许再把包名喂给命名空间那一侧。
    expect(source).not.toContain('configForms.get(BUNDLE_NAME)')
    expect(source).not.toContain('whileServed([BUNDLE_NAME]')
  })

  it('源码里不再出现宿主已删的旧接缝 conversation.input.right 之外的历史槽名', () => {
    const source = read('src/client/index.tsx')
    expect(source).not.toMatch(/conversation\.input\.(left|model|dock|activity|attachments)'/)
  })
})

describe('发布流程', () => {
  const workflows = existsSync(new URL('../.github/workflows', import.meta.url))
    ? readdirSync(new URL('../.github/workflows', import.meta.url))
    : []

  it('release.yml 里不得出现改写版本的调用（bump 是发布前的独立一步）', () => {
    if (!workflows.includes('release.yml')) return
    const release = read('.github/workflows/release.yml')
    expect(release).not.toMatch(/npm version (patch|minor|major)/)
  })

  it('上面那条检测器有牙齿（反向控制）', () => {
    const detector = (text: string) => /npm version (patch|minor|major)/.test(text)
    expect(detector('run: npm version patch --no-git-tag-version')).toBe(true)
    expect(detector('run: npm publish')).toBe(false)
  })
})

/**
 * 这条守卫只管辖**「告诉使用者要哪一版」**的那些话：
 * 既提到宿主版本、又带着要求口吻（只支持 / 要求 / 及以上 / or newer …），
 * 却没有在同一段里点出出处（`package.json` / `engines`）或标明是历史（`X 起` / 当时 / 旧线）。
 *
 * 不管辖：插件自己的版本号（由 package.json 与 version.spec 兜底）、
 * 以及纯历史陈述（「0.1.7 起」说的是那件事发生在哪一版，不是要求读者去装哪一版）。
 */
function needsSource(paragraph: string): boolean {
  if (!mentionsHostRequirement(paragraph)) return false
  if (hasSource(paragraph)) return false
  if (/\d+\.\d+\.\d+\s*起|当时|历史|旧线|重做|archive/.test(paragraph)) return false
  return true
}

/**
 * 这段话在讲「要哪一版宿主」——不管它有没有给出处。
 * 自检用它：文档里必须真的存在这类话，上面那个循环才不是空转。
 */
function mentionsHostRequirement(paragraph: string): boolean {
  const mentionsHost = /0\.1\.\d+(-[a-z]+\.\d+)?/.test(paragraph)
  if (!mentionsHost) return false
  return /只支持|仅支持|要求|需要|及以上|或更高|不自动覆盖|supports|requires|or newer|only/.test(paragraph)
}

/** 同段里点出了出处。 */
function hasSource(paragraph: string): boolean {
  return /package\.json|engines/.test(paragraph)
}

describe('文档不抄实测值', () => {
  /** 活文档：随代码走，所以里面不许抄会漂的宿主版本号。 */
  const LIVE_DOCS = ['README.md', 'README_en.md', 'AGENTS.md', 'docs/ARCHITECTURE.md', 'docs/PUBLISHING.md', 'docs/README.md']

  it('扫描器真的读到了活文档（否则下面几条是假绿）', () => {
    expect(LIVE_DOCS.length).toBeGreaterThan(0)
    for (const doc of LIVE_DOCS) expect(existsSync(new URL(`../${doc}`, import.meta.url)), doc).toBe(true)
  })

  it('活文档里的宿主版本必须与出处同段（或明确标为历史）', () => {
    const floor = (pkg.engines.dsh ?? '').replace(/^>=\s*/, '')
    for (const doc of LIVE_DOCS) {
      const text = read(doc)
      // 按**段**判，不按物理行：散文会折行，出处常常落在上一行或下一行。
      const paragraphs = text.split(/\r?\n\s*\r?\n/)
      for (const paragraph of paragraphs) {
        if (!needsSource(paragraph)) continue
        expect(hasSource(paragraph), `${doc}: ${paragraph.trim().slice(0, 120)}`).toBe(true)
      }
    }
    // 自检：活文档里必须真的有「要哪一版宿主」这类话（带不带出处都算），
    // 否则上面那个循环扫的是一个空集合 —— 那是永不触发的假绿。
    const inScope = LIVE_DOCS.flatMap((doc) => read(doc).split(/\r?\n\s*\r?\n/))
      .filter((paragraph) => mentionsHostRequirement(paragraph))
    expect(inScope.length, '活文档里没有「要哪一版宿主」这类话 —— 守卫空转了').toBeGreaterThan(0)
    void floor
  })

  it('上面那条守卫有牙齿（反向控制）', () => {
    // 告诉使用者「要哪一版」却不给出处 → 在管辖内（会被抓）。
    expect(needsSource('本仓只支持 DSH 0.1.7-rc.2 及以上。')).toBe(true)
    expect(hasSource('本仓只支持 DSH 0.1.7-rc.2 及以上。')).toBe(false)
    // 同一条话补上出处 → 放行。
    expect(hasSource('本仓只支持 DSH 0.1.7-rc.2 及以上；下限见 package.json 的 engines.dsh。')).toBe(true)
    // 历史陈述（“X 起”）与插件自己的版本号都不在管辖内。
    expect(needsSource('0.1.7 起 Config schema 就是设置文档。')).toBe(false)
    expect(needsSource('版本 \`0.1.0\`；尚未发布到 npm。')).toBe(false)
    // 自检用的谓词必须看得到「要求 + 宿主版本」，哪怕那段已经带了出处。
    expect(mentionsHostRequirement('本仓只支持 DSH 0.1.7-rc.2；下限见 package.json。')).toBe(true)
  })
})
