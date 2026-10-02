# 决策：本地开发装法改用 link:，profile 不再持有产物副本（2026-10-02）

状态：生效

## 问题

profile 里的插件是**真实目录副本**，不是 symlink。这带来三个后果：

- 改源码 → `build` 不生效，必须手动把 `lib/` 拷进 profile，再重启 dsh。
- 拷贝是**两半体**（宿主半 `index.js` + 浏览器半 `client.js`），只拷一半就出现版本错位：
  新客户端读 `probe.models`、旧宿主半只给 `candidates`，控件**整个不渲染**（2026-10-02 实际踩到，当场回滚）。
- 产物副本与仓库产物可能长期不一致，且没有任何判据能看出来。

## 决策

本机维护者的 profile 改用 `link:` 形态，四步缺一不可：

1. profile 的 `package.json`：依赖改 `"dsh-workbuddy-bridge": "link:<本仓绝对路径>"`
2. 同一文件：从 `dsh.profile.bundles` **摘除**本插件
3. profile 的 `cordis.patch.yml`：补回手动 `insert`（内容抄包自带的 `cordis.patch.yml`）
4. `node_modules/<包名>` 换成指向本仓的 symlink，`pnpm install --config.node-linker=hoisted` 重解析

第 2 与第 3 步是一对：bundle 通道会自动应用包自带的 patch，与手动 insert 并存即
`duplicate loader entry id: llm-workbuddy`。

收益：`build` 完**只需重启 dsh**，不再有拷贝与半同步。
代价：仓库 `lib/` 必须始终是构建过的状态 —— link 直接读它。

## 替代方案

- **保持真实副本，写个同步脚本**：脚本能减少手工步骤，但消不掉根因 —— 两半体仍可能只同步一半，
  且「副本与仓库是否一致」仍需额外判据。脚本是补丁，不是修复。
- **junction（Windows 目录联接）**：不需要管理员权限，行为接近 symlink。但 `Get-Item` 报 `LinkType`
  与 symlink 不同，判据要分平台写；且它只能指目录、不能表达 pnpm 的 `link:` 协议语义，
  lockfile 里仍会记成版本依赖。选 symlink + `link:` 是因为**pnpm 原生支持**，判据单一。
- **`pnpm link`（全局 link 目录）**：多一层全局状态，`pnpm link --global` 的解析结果依赖全局目录内容，
  跨机不可复现。`link:` 写进 profile 的 `package.json`，形态是自描述的。

## 影响

- 判据三条：lockfile 里是 `specifier: link:<路径>`；`LinkType` 是 `SymbolicLink`；重启后 status 正常且 `probe` 键是新形状。
- 回滚：四步各自还原，备份在 profile 下的 `*.bak-link-<时间戳>`。
- 步骤与判据的 home 是 [docs/PUBLISHING.md](../../docs/PUBLISHING.md) 的「本地开发装法」；
  根 [AGENTS.md](../../AGENTS.md) 的「状态」只留结论与指针。
- **发版链路不受影响**：npm 装法仍是 `dsh plugin add <包名>`（bundle 通道），
  只有本机开发 profile 走 link。