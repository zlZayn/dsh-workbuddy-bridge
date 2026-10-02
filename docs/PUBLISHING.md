# dsh-workbuddy-bridge — 发布手册

面向维护者。用户视角见 [README.md](../README.md)；设计决策见 [ARCHITECTURE.md](ARCHITECTURE.md)；维护规则见根 [AGENTS.md](../AGENTS.md)。

## 发版前确认

按顺序做完，任何一条不过就不发：

1. **版本线一致**：[package.json](../package.json) 的 `version`、构建注入的 `__DSH_WORKBUDDY_VERSION__`（由 `src/version.ts` 导出为 `WORKBUDDY_BRIDGE_VERSION`）、`lib/` 产物的内置版本三者必须一致。
   - 三者由 `tests/version.spec.ts` 兜底；产物那一条要求**先 `build` 再 `test`**（顺序反了会红，这是刻意的）。
2. **全量检查**：`pnpm check`（= `typecheck` + `vitest run` + `build`，命令原文见 [package.json](../package.json) 的 `scripts`）。
3. **文档同步**：改了对外可见行为（配置项、工具/模型面、安装命令、版本对应表）→ 同一次改动内同步 [README.md](../README.md) 与 [README_en.md](../README_en.md)（**两份必同改**）。
4. **链接与格式**：跑一次链接校验（见 [AGENTS.md](../AGENTS.md) 的常用命令），确保 `docs/` 与子树双件没有断链。
5. **真机验证（CI 覆盖不到的那一段）**：托管 runner 上没有 WorkBuddy 桌面 App、也没有真实登录凭据，所以下面三条只能在本机跑。
   发版前逐条执行，输出即记录（脚本自己会打 PASS/FAIL）：

   - `node scripts/live-e2e.mjs` —— 适配器 → pi-ai → shim → 真实上游的端到端，用本机登录态。依赖 `lib/` 产物，**先 build**。
   - `node scripts/client-identity-live-matrix.mjs` —— 客户端身份真实矩阵（八个 case，各打各的判定）。同样依赖 `lib/`，先 build。
   - `node scripts/issue-48-forced-fallback-e2e.mjs` —— macOS 强制 fallback 真链（真 `mdfind` / `plutil` / helper spawn）。
     **未跑之前，Release notes 不得声称 macOS 自动发现"已验证"**（判据：[archive/issue-48-electron-path-plan.md](archive/issue-48-electron-path-plan.md) §9.2-A）。

   这三条进不了 CI 是平台事实（见 [ci.yml](../.github/workflows/ci.yml) 的矩阵注释），所以它们只有在**这份清单里**才算数。

## 发版

发布入口有两个，进的是**同一个 job**、同一条链（守卫 → 安装 → typecheck → build → test → check:release → publish → tag → Release）：

- **推 tag**：`git push origin v<版本>` —— 打 tag 就走。带一道自己的闸：**tag 名必须等于 `v` + `package.json` 里的版本号**，不一致直接红（否则会出现「tag 是 v0.3.0、发出去的是 0.2.0」，而 npm 的版本号不可覆盖）。
- **手动触发**：Actions → Release → Run workflow（或 `gh workflow run release.yml`）。只接受从 main 触发；tag 由流程补建。

- **版本驱动**：workflow 只发 `package.json` 里那个号，**它不 bump**。bump 是发布前的本地一步：
  `pnpm version <patch|minor|major> --no-git-tag-version` → 重建 `lib/` → 提交 → （渲染面改动先重截图）→ 推 main → 打 tag。
- **dist-tag 由版本自己推**：带预发布段（如 `0.3.0-alpha.1`）发到同名 dist-tag（`alpha`），`latest` 不动；稳定版发 `latest`。
- **守卫**：上个 tag 以来只有文档 / 测试 / CI / 工具脚本改动时红（[scripts/release-guard.mjs](../scripts/release-guard.mjs)）；
  首次发布没有历史 tag，守卫自动跳过。确需越过用 force 输入（手动触发才有）。
- **幂等**：版本已在 npm 上时跳过 publish、只补齐 git 侧 —— 「忘了 bump」的症状就是它报已存在。
- **前置（一次性，人工配置）**：npmjs.com 上为本包配 **Trusted Publisher**——
  registry 指向 `registry.npmjs.org`，GitHub 仓库名 / workflow 文件名（`release.yml`）/ environment 名（`release`）三处一致。
- **改了 release.yml 必须实跑一次**：PR 上的 CI 只跑 ci.yml，绿勾不代表发布链路验过。

发布后核对：`npm view dsh-workbuddy-bridge dist-tags`（latest 或预发布 tag 指向新版本）与 GitHub Releases 页。

## 版本号

- **patch**：修缺陷、等价重构、文档与元数据修正，使用者旧用法全部仍然正确。
- **minor**：新增可选能力、新增配置项、界面新增入口 —— 旧用法仍正确且能观察到新能力。
- **major**：旧用法升级后会出错或失败（删/改配置项、改输出契约、抬宿主核下限）。
- **使用者观察不到变化的改动不发版**（纯文档、测试、注释、工具脚本）：搭下一次发布的车。
- 判定按「旧用法是否仍然正确 + 是否可观察到新能力」推，不按改动文件多少。

## 与 DSH 核心的版本对应

**每个插件版本只支持一段 DSH 核心**，不匹配的组合会让 DSH 启动失败。

- **下限的唯一真源是 [package.json](../package.json)**：`engines.dsh` 与全部 `@deepseek-ai/dsh-*` 声明写同一个下限（本仓统一 `>=<下限>`，不设上限）。本文与门面都不重抄那个号。
- **本仓只支持一条线**，不提供跨代兼容层：宿主换线时，同一次改动内抬 `engines.dsh` 与全部 `@deepseek-ai/dsh-*` 的下限，并同步 [README.md](../README.md) 的「兼容与已知限制」一节（中英两份）。
- 判断「声明还罩不罩得住被跟的那条线」用 `pnpm run check:release`（它比 peer 与 `engines.dsh` 的下限）。

## 本地开发装法（link:）

改源码要能立刻见效，装法必须是 `link:`。**默认装法是真实目录副本**，`build` 完不会自动生效，
每次都得手动同步 `lib/` 再重启 —— 而且半同步（只换客户端半）会让控件整个不渲染。

**四步，缺一步都挂不上或双挂载：**

1. profile 的 `package.json`：依赖改 `"dsh-workbuddy-bridge": "link:<本仓绝对路径>"`
2. 同一文件：从 `dsh.profile.bundles` **摘除**本插件 —— bundle 通道会自动应用包自带的
   `cordis.patch.yml`，与第 3 步并存就是 `duplicate loader entry id: llm-workbuddy`
3. profile 的 `cordis.patch.yml`：补回手动 insert（内容抄包自带的 `cordis.patch.yml`）
4. `node_modules/<包名>` 换成指向本仓的 symlink，然后 `pnpm install --config.node-linker=hoisted` 重解析

**判据（三条都要过）：**

- `pnpm-lock.yaml` 里该包是 `specifier: link:<路径>`（不是版本号）
- `(Get-Item node_modules/<包名>).LinkType` 是 `SymbolicLink`
- 重启后 `/plugins/<包名>/status` 正常返回，且 `probe` 键是新形状

**收益**：之后 `build` 完只需重启 dsh 进程（宿主半只在启动时装载一次），不用再拷文件。
**代价**：仓库 `lib/` 必须始终是构建过的状态 —— link 直接读它，没 build 就是旧产物或缺失。

回滚：把四步各自还原（备份见 profile 下的 `*.bak-link-<时间戳>`），或直接改回版本号依赖 + 恢复 bundle 条目。

## 平台契约的取真源方式

宿主平台契约（客户端槽名、客户端服务的名字与形状）只能从**实装宿主包**里读，不从记忆或旧文档推断：

- 槽名与类型：`<DSH 安装目录>/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-*/**/*.d.ts`
- **槽存在 ≠ 能注册**。每个槽在 `SlotMap` 里带一个 `kind`，三个判据依次看：
  1. `kind` 与 `scope`（`dsh-client-ui-*/**/*.d.ts` 的 `SlotMap`）。
  2. 已有哪些占用者（`dsh-client-ui-*/lib/client.js` 里搜 `slots.register({ name: '<槽名>'`）。
  3. `kind: 'single'` 的槽**一格只能有一个占用者**：同一 priority 再注册会抛
     `single slot "..." already has a registration at priority 0`，而**抛出方是后注册的那一个**。
     低 priority 会顶掉原占用者，高 priority 只是被遮蔽 —— 两种都不是「并排」。
     要并排就选 `kind: 'list'` 的槽（自带 `id` 即一格，互不冲突）。
- 先例（2026-09-25）：本仓曾把 `conversation.input.right` 误判为不存在，改注册到 `conversation.input.model`（提交 `219a7ff`）。
  实装宿主 `0.1.7-rc.2` 里**两者都存在**：`.right` 是 `kind: 'list'` 且无占用者，`.model` 是 `kind: 'single'` 且已被宿主自带的 `ModelSelect` 占用。
  占 `.model` 的后果不是「多一个控件」，而是**宿主的模型选择器消失**；本仓的推理等级控件因此注回 `.right`。

## 出事之后

- **发布后才发现缺陷**：不删版本、不重发同号（npm 版本号不可覆盖）。修好 → 按上面流程发下一个 patch，并在 Release notes 里写明影响面。
- **发布流程本身出问题**（bump 漏改三处之一、产物没重建）：先 `pnpm check` 复现，再按 [docs/archive/](archive/) 里同类记录的方式补一条决策记录。