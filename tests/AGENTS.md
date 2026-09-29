# tests/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

tests/ 特有约束：

- 改动前后跑与本目录相关的 spec，路由见 [README.md](README.md)
- 经 `ctx.llm` 读模型的用例，先等「roster 已服务」再断言：provider 注册早于凭据扫描采纳账号，
  catalog 在未采纳时是空的（`src/index.ts` 构造即 `setVisible(false)`，`adoptIdentity` 才揭示）。
  只等 `listProviders()` 含 `workbuddy` 会落进这个窗口，`resolveModelInfo` 抛 `UNKNOWN_MODEL`
  （2026-09-29 CI 实踩：`reasoning-merge.spec.ts` 首条用例随机红，本机与上一轮 CI 都绿）。
  判据同 [catalog-lifecycle.spec.ts](catalog-lifecycle.spec.ts)：`vi.waitFor` 到 `listModels` 非空
