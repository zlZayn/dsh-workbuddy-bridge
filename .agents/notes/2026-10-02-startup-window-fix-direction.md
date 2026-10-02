# 决策：空窗的修法方向是「先采纳账号，再注册 adapter」

状态：生效
日期：2026-10-02

## 问题

provider 注册与 catalog 揭示之间有一个空窗（[issue #2](https://github.com/zlZayn/dsh-workbuddy-bridge/issues/2)）：

- 构造 runtime 时即 `catalog.setVisible(false)`（[src/index.ts](../../src/index.ts)：选了必然报错的兜底列表比空分组更糟）；
- `WorkBuddyCatalog.current()` 在未 visible 时返回 `[]`（[src/catalog/index.ts](../../src/catalog/index.ts)）；
- adapter 的 `buildModels()` 由 `catalog.current()` 生成，于是 provider 已出现在 `ctx.llm.listProviders()`，却没有任何已配置模型；
- 首次揭示发生在 `startVariant` **之后**，且是 `void syncAll()`（fire-and-forget）。

窗口内 `resolveModelInfo('workbuddy', <id>)` 抛 `LlmError: pi-ai provider "workbuddy" has no configured model`，即 `UNKNOWN_MODEL`。
本机窗口是几十毫秒，但真实发现路径可以长得多（macOS 走 Spotlight + Electron 解锁、Windows 走 `reg query` + at-rest 解密、凭据在慢盘或网络目录上）。

## 决策

**把「首次凭据读取 + `adoptIdentity`」提到 `registerAdapter` 之前。**

`startVariant` 目前的顺序是：起 shim → 构造 adapter → 注册 → 返回；揭示在调用方的 `.then()` 里。改为在构造 adapter **之前**先读一次凭据并采纳身份，于是 provider 一出现，catalog 就已经揭示（或明确以隐藏态注册）。

- 凭据读取失败或未登录时，照常以隐藏态注册，之后交给 30 秒轮询——即**今天的行为**，不引入新失败面。
- 凭据读取与 shim 启动可以并行等（两者互不依赖），所以最坏情况并不比现在慢一个 I/O 往返以上。
- 这条路径是一次性的：轮询仍按原样处理后续账号切换与令牌轮换。

## 替代方案

- **首次采纳后才注册 adapter**（issue 里的方向 1）：窗口同样消失，但 signed-out 时分组**完全不上屏**。今天的行为是「注册 + 空 catalog」，宿主自己丢弃空分组；改成不注册会让「启动后再登录」必须重新注册，把一条已经在跑的路径换成两条。
- **注册后暴露「等待凭据」状态**（issue 里的方向 2）：`resolveModel` 在隐藏期返回可区分的错误码（如 `NOT_ADOPTED`）而非 `UNKNOWN_MODEL`，客户端可提示「正在读取登录状态」。语义最好，但要宿主侧配合，跨仓。
- **保持现状**（issue 里的方向 3）：认定窗口足够短、且 picker 里看不到模型所以用户选不到。实测否掉了这一条：一个**已经选中** workbuddy 模型的会话（恢复的历史会话、或 `agent-default-model` 配了 workbuddy）在窗口内发第一条消息就会撞上。

## 影响

- 启动分三相：**读凭据并采纳身份 → 注册 provider → 抓目录**。第一相与第二相之间是硬顺序，第二相与第三相之间也是（目录抓失败落在「已可用的分组」上，而不是落在空处）。
- 两个变体各自并行，互不等待：一个慢凭据读不能拖住另一个产品的模型上屏。
- 降级路径不变：读失败或未登录时照常以隐藏态注册，之后交给 30 秒轮询。
- 守卫：`tests/catalog-lifecycle.spec.ts` 的「never exposes the provider without its models」。
  它的采样循环**必须在 `ctx.plugin(WorkBuddy)` 之前启动并与之并发** —— 等 `boot()` 之后再采样已经错过窗口，
  两种顺序下都会绿（第一版就是这么写的，等于没守）。已验证：把顺序改回「先注册」该用例报 2 处违规，改回「先采纳」即绿。
- 关联：[决策记录](2026-10-02-effort-bulb-means-switchable.md)（同轮改动）、[tests/AGENTS.md](../../tests/AGENTS.md)（测试侧「等 roster 就绪」的 gate 仍是必要的权宜，产品侧窗口由本条关闭）
