# dsh-workbuddy-bridge — 维护索引

## 状态

- 版本 `0.1.0`；**尚未发布到 npm** —— 新包名的首次发布是待办，发布态回填前本行不写 npm 侧事实。
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
- 发布态该有什么 → 断言集合（`scripts/check-release.mjs`，待补）

## 验证快照（2026-09-25 本机实跑）

- `tsc --noEmit` rc=0
- `vitest` 28 files passed / 374 passed | 8 skipped (382)
- 链接校验 0 errors（文件与链接计数随文档增删变，不抄）；warning 只来自门面的 HTML 语言切换链接，与另两仓同形
- 8 条 skipped 是 Windows 与 POSIX 的语义差（权限位、EACCES 注入、XDG/WSL 路径、跨进程启动时间），非逻辑缺陷

## 待办

- [ ] **声明面同形**：peer 现在写 `^0.1.7-alpha.1 || ^0.1.7-rc.1`（并集，第二段被第一段包含），
  `engines.dsh` 写 `>=0.1.7-alpha.1` —— 下限一致但**形状不同**。收不收成另两仓那种 `>=<下限>` 由维护者拍
  （`check:release` 只判下限，不判形状）
- [ ] 移植红线用例（含「活文档不抄实测值」守卫）
- [ ] 补仓内基建：`.github/workflows/ci.yml`、`.gitattributes`、`icon.svg` + `locale/*.json`
- [ ] 客户端 i18n 对齐 `dsh-ds-balance` 的扁平键 + 插值形态
- [ ] 首次发布 `0.1.0` 并回填发布态（含 README 的 npm 徽章）
- [ ] `assets/7.png` 是 0.1.5 时代的历史件，确认后删除（判据见 [assets/README.md](assets/README.md)）

## 活跃坑

- **槽的 `kind` 决定能不能注册**：`kind: 'single'` 的槽一格只能有一个占用者 —— 同 priority 再注册会抛错，
  而**抛出方是后注册的那一个**（宿主自带 UI 会因此消失）；要并排只能选 `kind: 'list'` 的槽。
  判据与先例见 [docs/PUBLISHING.md](docs/PUBLISHING.md) 的「平台契约的取真源方式」
- **pnpm 11 的 symlink 链接器在本机会卡死**（343 个包已就位却搭不出 `node_modules`）→ 一律加 `--config.node-linker=hoisted`
- `node_modules/.bin` 可能为空 → 按上面的直接路径调用工具
- `Rename-Item` 对正在被 install/build 占用的目录会失败 → 改名前先确认无相关进程
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
