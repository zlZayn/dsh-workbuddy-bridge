# dsh-workbuddy-bridge — 维护索引

## 状态

- 版本 `0.1.0`，**已发布**（npm `latest` = 0.1.0，现查 <https://www.npmjs.com/package/dsh-workbuddy-bridge>）。
  发布是维护者本地 `npm publish` 完成的 —— **git 侧产物（tag `v0.1.0` + GitHub Release）还没建**，
  发布手册说这两样由流程产出、不靠人记得；补建动作见待办。
- 装法只有一条：`dsh plugin --profile <profile> add <包名或仓库路径>`。包内声明了 `dsh.bundle.patch`，
  安装器自己会把它写进该 profile 的 `dsh.profile.bundles`；**不要再往 profile 的 `cordis.patch.yml` 手写 patch 行**，
  两者并存就是双挂载。
- 运行形态：装进 profile 的 `node_modules`，由该 profile 的 `dsh.profile.bundles` 装载（bundle 层来自包内的 `cordis.patch.yml`）。
- **`lib/` 是被跟踪的产物**（本仓与另两个插件仓不同）：`link:` 装法直接读它，所以改源码后要重建并**连同源码一起提交**。

## 全局规则

- 架构与设计决策 → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 子树手册 → [src/README.md](src/README.md)、[tests/README.md](tests/README.md)、[scripts/README.md](scripts/README.md)、[assets/README.md](assets/README.md)
- 决策记录 → [.agents/notes/](.agents/notes/)（写法见该目录 `AGENTS.md`，不建索引）
- 发布手册（发版流程、版本号语义、平台契约取真源方式）→ [docs/PUBLISHING.md](docs/PUBLISHING.md)
- 来源与双版权 → [NOTICE](NOTICE)；许可证 → [LICENSE](LICENSE)
- **平台契约只从实装宿主读**：注册一个槽之前先查它的 `kind` 与现有占用者 —— `single` 槽同 priority 再注册会抛错，
  而抛出方是后注册的那一个（宿主自带 UI 会因此消失）。判据与先例见 [docs/PUBLISHING.md](docs/PUBLISHING.md)。

## 常用命令（本机实测）

- 装依赖：`pnpm install --config.node-linker=hoisted`
- 全量检查（**顺序固定，build 必须在 test 之前**）：`tsc --noEmit` → `tsdown`（重建 `lib/`）→ `vitest run`
  - [tests/version.spec.ts](tests/version.spec.ts) 断言 `lib/` 产物里的版本与包一致，先跑测试会红（刻意设计）
- `node_modules/.bin` 为空时按直接路径跑：`node node_modules/typescript/bin/tsc --noEmit`、`node node_modules/tsdown/dist/run.mjs`、`node node_modules/vitest/vitest.mjs run`
- 链接校验：`python <maintenance-flow>/check-links.py <本仓> --fragments --refs` —— 本仓不自带脚本，用维护者 skill 目录里那份；CI 落地后与它跑同一条命令

## 事实来源（只查不抄）

本文件与各文档一律不抄会漂的值，要精确值时现查：

- 版本号、依赖范围、`engines` → [package.json](package.json)
- 测试数量与类型检查结果 → 现跑 `vitest run` / `tsc --noEmit`（CI 落地后改指 CI 运行记录）
- 产物清单与体积 → `Get-ChildItem lib` 现查
- 宿主槽名与 `kind`、客户端服务名 → 实装宿主包：`<DSH 安装目录>/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-*/**`
- 发布态该有什么 → [scripts/check-release.mjs](scripts/check-release.mjs) 的断言集合

## 验证快照

- **CI 已跑通**（Linux，[ci.yml](.github/workflows/ci.yml)）：install → typecheck（两半体）→ build → test → check:release 九步全绿。
  数字不抄，看 [CI 运行记录](https://github.com/zlZayn/dsh-workbuddy-bridge/actions/workflows/ci.yml)。
- 本机（Windows）实跑：`vitest` 全绿（文件数随套件增减，现跑现看）；skip 的那几条是 Windows 与 POSIX 的语义差
  （权限位、EACCES 注入、XDG/WSL 路径、跨进程启动时间），**不是缺陷**：CI 上它们真的执行并通过
- 链接校验 0 errors（文件与链接计数随文档增删变，不抄）；warning 只来自门面的 HTML 语言切换链接，与另两仓同形

## 待办

- [x] 客户端 i18n 对齐 `dsh-ds-balance` 的扁平键 + 插值形态；文案语义 2026-09-26 全量过一遍（标签按读者任务重排同批）
- [x] 首次发布 `0.1.0`（维护者本地 publish + Trusted Publisher 已配）；README 门面已按发布态重写（npm 徽章已加）
- [ ] **补 git 侧发布产物**：tag `v0.1.0`（指向 3721cc3 或发布时那棵树）+ GitHub Release —— 发布时 workflow 未用上，
      两样按 [docs/PUBLISHING.md](docs/PUBLISHING.md) 手工补，之后 release.yml 的守卫才有基线

## 活跃坑

- **设置命名空间 = loader 条目 id，不是包名**：`configForms.get()` 收的是命名空间，
  而宿主按 `ns: entry.options.id` 发布设置文档。喂包名的表现是**静默**的 —— 那个命名空间
  从没被服务过，`whileServed` 永不触发，**配置页根本不出现**（2026-09-25 真机踩过）。
  分工：槽 key 取**包名**（宿主按 `pkg.name` 派发），命名空间取**条目 id**；
  两个常量各自由红线钉在 `cordis.patch.yml` 上
- **Windows 上取凭据要用 WorkBuddy 自带的 Electron**：桌面凭据是 at-rest 加密的，
  密钥助手就是那个 exe。**发现策略按平台选**（`cnAppDiscovery()`，宿主与 CLI 共用一处）、
  **默认路径按策略取** —— 两者混用会让一条策略报出另一条平台的路径，与紧随其后的
  发现流程自相矛盾
- **`reg query` 的退出码 1 有两种形状、都是「这一格没有」**：键在但没匹配 → stdout 打本地化的
  「找到 0 匹配」；键不在 → stdout 空、消息走 stderr。只有**被杀死（超时）**或**没起来**
  （非数字 code）才算「查不了」。这条猜不出来 —— 别用替身测，红线上有一条打真实 `reg.exe` 的守卫
- **槽的 `kind` 决定能不能注册**：`kind: 'single'` 的槽一格只能有一个占用者 —— 同 priority 再注册会抛错，
  而**抛出方是后注册的那一个**（宿主自带 UI 会因此消失）；要并排只能选 `kind: 'list'` 的槽。
  判据与先例见 [docs/PUBLISHING.md](docs/PUBLISHING.md) 的「平台契约的取真源方式」
- **pnpm 11 的供应链门禁会拒收刚发布的宿主 rc**：默认拒收发布不足 24 小时的版本，
  而本插件跟的就是宿主的 rc 线 —— 报 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`，install 直接失败
  （本机与 CI 同样）。处置见 [pnpm-workspace.yaml](pnpm-workspace.yaml)
- **pnpm 11 的 symlink 链接器在本机会卡死**（343 个包已就位却搭不出 `node_modules`）→ 一律加 `--config.node-linker=hoisted`
- `node_modules/.bin` 可能为空 → 按上面的直接路径调用工具
- `Rename-Item` 对正在被 install/build 占用的目录会失败 → 改名前先确认无相关进程
- **测试断言里不许出现 locale 相关字面量**（「11月19日」这类 `Intl` 产物）：本机系统 locale 是中文
  所以绿，ubuntu runner 默认 en，同一 `Intl` 调用产出 "Nov 19"，断言必红 —— 平台差被本机掩盖
  （2026-09-25 CI 实踩，3eb0098 起两轮红）。日期/数字断言一律走 `format.ts` 的格式化器或
  `t(key)`，断言字面量只允许平台无关的（如 "Status"）
- **`.gitignore` 里一行裸 `AGENTS.md` 曾把整张文档网络吞掉**（13 份都不入库）：新增忽略规则时用具体路径，
  别用会匹配到文档名的裸文件名

## 文档网络与自更新

- **一条事实只有一个 home**：根 [README.md](README.md) 讲门面，本文件讲规则与仪表盘，子目录的双件里文档层讲「有什么 / 改哪」、
  规则层讲「在这里怎么干」，[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 讲不变的设计，[.agents/notes/](.agents/notes/) 讲为什么。
  别处一律链接。
- **能自证的不抄**：测试数字、产物体积、版本号一律指向 CI、`package.json` 或现查命令。
- **改根 [README.md](README.md) 必同改 [README_en.md](README_en.md)**：能力清单、上手步骤、指针逐条对齐，冲突以中文为准。
- **记录层不追改**：[docs/archive/](docs/archive/) 写的是当时的事实，批量改名不许扫进那一层（判据见 [docs/AGENTS.md](docs/AGENTS.md)）。
- **坑按作用域分流**：只在某个子目录才会踩的坑写进该目录的 `AGENTS.md`（进入即自动注入），本文件只留跨模块、致命的那几条。
- 改完文档跑一次链接校验；新增或改名文件后回填所在目录文档层的「变更影响路由」。

## 文档地图

- 门面 → [README.md](README.md) · [README_en.md](README_en.md)
- 规则与仪表盘 → 本文件
- 设计、契约、发布手册与文档层说明 → [docs/README.md](docs/README.md)
- 决策记录（当时为什么这么定）→ [.agents/notes/](.agents/notes/)
- 源码手册 → [src/README.md](src/README.md)；浏览器半边 → [src/client/README.md](src/client/README.md)
- 测试手册 → [tests/README.md](tests/README.md)；脚本 → [scripts/README.md](scripts/README.md)
- 门面截图与重截判据 → [assets/README.md](assets/README.md) · [assets/AGENTS.md](assets/AGENTS.md)
- 来源与双版权 → [NOTICE](NOTICE)