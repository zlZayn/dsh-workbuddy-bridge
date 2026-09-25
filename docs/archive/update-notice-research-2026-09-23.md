# 更新提醒（update notice）：dsh-codex-connect 调研

调研日期：2026-09-23
对象：`~/Documents/CodexTest/dsh-codex-connect`（franksong2702/dsh-codex-connect）
目的：评估把「发现新版本就提醒」的机制移植到 dsh-workbuddy-connect 的可行性与代价。

本文只记录调研结论，不含实现计划。实现方案待后续单独展开。

---

## 0. 当前状态

**调研完成，未做任何实现决定。** 本文为唯一产出，代码零改动。

---

## 1. 为什么值得考虑

workbuddy-connect 已经踩过两次「用户不知道自己在用旧版」的坑：

- **issue #25 的教训**：「Already up to date」不等于拿到最新发布版。用户重装后 npm 说已是最新，实际仍是旧版。
- **v0.6.0 那轮**：跨代兼容（0.1.5 / 0.1.6+ 双 UI）上线后，用户不知道需要升级才能拿到。

现有 README 的做法是**静态版本对应表**，靠人读。一个能显示「当前 X · 最新 Y」并直接给 Agent prompt 的卡片，正好覆盖这个场景，且比表格更早暴露问题。

---

## 2. codex-connect 的机制拆解

### 2.1 数据来源（三个上游，各自独立降级）

| 用途 | 来源 | 失败时 |
|---|---|---|
| 判断有没有新版本 | `registry.npmjs.org/-/package/dsh-codex-connect/dist-tags` | `status: 'unavailable'` |
| 新版本「有什么用」摘要 | 仓库 main 分支的 `update-highlights.json`（raw.githubusercontent.com） | `highlights: []`，界面显示「暂时没有整理好的用户功能摘要」 |
| 完整发布说明 | GitHub Releases API（按 tag 取单个 release） | 字段省略，界面显示「发布说明不可用」 |

三个来源**并行请求**（`Promise.all`），任何一个挂掉都不影响其余两个。判断「有没有新版本」只依赖第一个，所以摘要和 notes 全挂也能正常提醒版本号。

### 2.2 触发时机（三层）

**第一层：什么时候去查**

客户端插件 `apply()` 时无条件查一次（`src/client/index.tsx:57-60`）：

```ts
ctx.effect(() => {
  void updater.refresh()          // 挂载即触发，无其他前置条件
  return () => { updater.dispose() }
}, 'dsh-codex-connect: update checker')
```

`refresh()` 默认 `force=false`，先读 localStorage 缓存：

- 命中（24 小时 TTL 内 **且** `cached.result.currentVersion === 当前版本`）→ 直接用缓存，不发请求；
- 否则请求 host 路由。

结论：**页面加载时查一次，24 小时内重开页面不重复查**。缓存里存了 `currentVersion`，所以升级后旧缓存自动失效。

**第二层：什么条件下才弹**

`OpenAICodexUpdateNotice.tsx:191` 是唯一的显示判定：

```ts
if (overlay && !pendingRecheck
    && (snapshot.status !== 'update-available'
        || noticeKey === undefined
        || snapshot.dismissedNotice === noticeKey)) return null
```

必须**同时满足**才弹：

1. 状态是 `update-available` —— npm dist-tag 里有比当前**更新**的版本（纯 SemVer 比较）；
2. 未被 dismiss —— localStorage 里的 dismissed key ≠ `${currentVersion}:${latestVersion}`。

例外：`pendingRecheck`（用户点了「已完成后重新检查」且正在查/查不通）强制显示，避免弹窗在用户主动操作时突然消失。

以下情况**不弹**：已是最新、检查失败、用户 dismiss 过这个版本对（除非出了更新的版本，因为 key 变了）。

**第三层：取哪个版本号**

`registryCandidates` 取 **`latest` 和 `alpha` 两个 dist-tag 里较高的那个**。所以装 `latest` 的用户，只要有更新的 `alpha` 也会被提醒——这是有意的，因为该项目的 alpha 线才是主发布线（版本号形如 `0.1.0-alpha.4.39`）。

### 2.3 失败与重试

| 场景 | 行为 |
|---|---|
| 检查失败（`unavailable`） | **5 分钟**后自动重试一次（`OPENAI_CODEX_UPDATE_RECHECK_MS`），仅页面开着期间有效 |
| 点「检查更新」 | `refresh(true)`，**force 绕过 24 小时缓存** |
| 点「已完成后，重新检查」 | 同样 force，额外置 `recheckRequested`，使结果仍是 `update-available` 时显示「升级后当前版本仍是 X」，而不是让人以为没生效 |
| 点 dismiss | 按 `${currentVersion}:${latestVersion}` 存 localStorage |

### 2.4 安全与健壮性（这部分最值得抄）

对上游返回的一切都当**脏数据**处理：

- **字节上限**：metadata 64KB、highlights 64KB、release notes 32KB，超出即 abort（`readBoundedText` 流式累加，不是先读完再判断）；
- **超时**：单次请求 8 秒（`AbortController`）；
- **白名单解析**：`update-highlights.json` 的 `kind` 必须命中固定枚举（18 个），release 数 ≤256，版本号必须能解析，重复版本丢弃；
- **release notes 清洗**：去掉控制字符、`\r\n` 归一、截断 16000 字符；
- **URL 白名单**：链接只允许 `https://github.com`，其他一律不渲染成 `<a>`；
- **host 路由响应再校验一遍**：浏览器侧 `parseOpenAICodexUpdateResult` 会把 host 返回的 JSON 重新验一次（版本号可解析、`releaseUrl` 必须等于按版本号拼出的期望值、`versionsBehind` 必须正整数），不信任同源 host。

这套「不信任上游、不信任 host、不信任缓存」的三层校验，与 workbuddy-connect 对待 WorkBuddy 私有接口的原则一致，可以直接沿用。

### 2.5 用户体验设计：把「怎么做」交给 Agent

这是整个机制里我认为**最有价值**的一点。

界面不给用户 npm 命令，而是给一段可直接复制的 prompt（`agentUpgradePrompt`，内含仓库地址），由 Agent 去读项目说明自行决定安装方式。理由是：插件安装命令随 profile 不同而不同（web / desktop / dsh-tui 三个 profile 命令各异），让用户自己对照文档选是最容易出错的环节。

workbuddy-connect 的 README 目前有**整整一节**在讲这件事（版本对应表 + 三个 profile 各自的安装命令 + 旧版本用户该停在哪一版）。这段说明天然适合交给 Agent 处理。

---

## 3. 关键差异：workbuddy-connect 与 codex-connect 不一样的地方

### 3.1 版本号形态（**最重要的差异**）

| | codex-connect | workbuddy-connect |
|---|---|---|
| 版本号 | `0.1.0-alpha.4.39` | `0.6.0`（标准 SemVer） |
| 发布节奏 | 极快，alpha 线密集（连续 4.5→4.39） | 慢，v0.3→v0.6 跨度数月，十几个版本 |
| 主发布线 | alpha 线 | 正式版线（`latest`） |

影响：

- codex-connect 的 `parseVersionParts` 和 `compareAlphaVersions` 是**为 4 段式 alpha 版本号专门写的**（`isAlphaReleaseVersion`）。workbuddy-connect 用标准 SemVer，**可以直接用成熟的 semver 比较**，不需要自己写解析器；
- 取 dist-tag 的策略要改：codex-connect 取 `latest` ∪ `alpha` 里较高者。workbuddy-connect 的 alpha 线不是主发布线，**只取 `latest` 更合理**（否则会给用户推荐 alpha 版）。

### 3.2 双 provider（已定论）

workbuddy-connect 是**单包双 provider**（`workbuddy` / `workbuddy-ai`），共享同一个 `package.json` 版本号。

**结论（2026-09-23 用户确认）**：更新提醒**按版本号触发，有更新就弹一条**，不做 provider 区分。因为：

1. 检查逻辑比较的是**本插件自己这个 npm 包**的版本，与 provider 完全无关；
2. 两个 provider 共用一个版本号，弹两条完全相同的信息是冗余。

因此提醒**只有一条**，与「设置里有两张卡片」无关。卡片布局（放哪、是否独立成块）是纯展示问题，后议。

### 3.3 `update-highlights.json` 的维护成本（**问题 3 展开**）

这里回答上轮没讲清的「问题 3」。

**它是什么**：仓库根目录一个手写的 JSON，把每个版本的「对用户有什么用」用**固定枚举的标签**列出来：

```json
{
  "schemaVersion": 1,
  "releases": [
    { "version": "0.1.0-alpha.4.8",  "highlights": ["trusted-origins", "runtime-compatibility"] },
    { "version": "0.1.0-alpha.4.9",  "highlights": ["quota-fast-mode"] },
    { "version": "0.1.0-alpha.4.10", "highlights": ["dsh-rc7"] }
  ]
}
```

界面拿到 `["trusted-origins", "runtime-compatibility"]` 后，**通过前端 locale 查表**（`highlightKeys` 映射到本地化文案如「支持受信任来源」）显示成人话。所以这个 JSON 只存**标签**，不存文案，文案在插件代码里，中英各一份。

**为什么要有它**：GitHub Release notes 是给开发者看的（commit 列表、技术细节），普通用户看不懂。这份 JSON 是「给用户的功能摘要」独立通道，两者互不替代。截图里显示「暂时没有整理好的用户功能摘要」就是这个文件里对应版本 `highlights: []`。

**维护成本具体是什么**：

1. **每发一版要手动加一条**（或者省略——`release-metadata.mjs` 允许维护版没有条目，注释写明「maintenance releases may be omitted or have no highlights」）；
2. **枚举是封闭的**：新增一种功能类型，要同时改三处——JSON 里的 kind、`src/update.ts` 的 `HIGHLIGHT_KINDS` 数组、前端 `highlightKeys` 映射，**外加中英两套文案**。少改一处，lint 或运行时校验就会拦下（`release-metadata.mjs:45` 校验未知 kind）；
3. **有发布校验兜底**：`scripts/release-metadata.mjs` 会检查 JSON 版本号递增、唯一、不得高于 `package.json`、kind 必须已知、同版本内不得重复。`scripts/lint.mjs` 也会校验文件是合法 JSON。

**判断**：这是一笔**持续的、每版都要付**的成本，不是一次性代码成本。对 workbuddy-connect 而言要权衡：我们的发布节奏慢（几个月一发），维护负担不高；但我们的「对用户有什么用」本来就是 README 里精炼过的中文段落（如「企业账号积分走企业专用接口」、「Linux XDG 双 base」），把它复制一份成标签 + 中英文案，收益是否抵得上三处同步的复杂度，**需要单独决定**。

**替代方案（未评估）**：直接复用 GitHub Release notes。workbuddy-connect 的 Release notes 本来就是双语、面向用户写的（AGENTS.md 记录「Release notes 措辞按用户修正」），与"技术细节"不是一回事，所以可能不需要 highlights 这层。这条待验证。

---

## 4. 移植到 workbuddy-connect 需要动的地方（粗粒度，非实现方案）

| 模块 | 说明 |
|---|---|
| 版本检查逻辑 | 新增。参考 `src/update.ts`，但版本比较用标准 SemVer，dist-tag 只取 `latest` |
| host 路由 | 新增一个 GET 路由，需复用现有回环 + Host/Origin 门卫（`src/loopback.ts` 已有该设施） |
| 客户端状态 | 新增 store + localStorage 缓存（TTL 待定，见下） |
| UI | 一条提醒（overlay 或卡片内嵌），含版本对比、升级 prompt 复制、dismiss |
| 双 UI 形态 | 需同时适配 0.1.6+ 插件页与 0.1.5 settings 卡片（现有 `settings.plugin.item` / `plugins.bundle.config` 双 seam） |

**待定项**：

- 缓存 TTL：codex-connect 是 24 小时。我们发布慢，是否拉长到 7 天（减少无谓请求）？
- 是否保留 highlights 层（见 §3.3）。
- overlay 形态 vs 仅在设置卡片内显示。codex-connect 两者都有：overlay 常驻框架右上角，设置页另有完整区块。

---

## 5. 与现有约束的关系

- **发布规矩**：本机制只做「检查 + 提示」，不自动升级、不自动安装。与现有「未经明确指令不得 publish」的规矩不冲突。
- **网络请求**：新增对 `registry.npmjs.org` 和 `github.com` 的请求。codex-connect 全部走 host 侧（浏览器不直连），workbuddy-connect 应沿用同一形态，避免浏览器直连外网。
- **隐私**：请求不含账号信息，只是查公开的包元数据。不涉及凭据。
