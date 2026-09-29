# tests/browser/ — 规则层

继承根规则 [../../AGENTS.md](../../AGENTS.md) 与 tests/ 规则层 [../AGENTS.md](../AGENTS.md)。

tests/browser/ 特有约束：

- 本目录跑**真实 React 树**（react-test-renderer），不是纯函数替身
- 全局替身（fetch / 定时器 / 环境变量）与 React 树卸载清理由 `harness.ts` 的 `useBrowserStubs` 与
  `useTree` 负责，用例不自己手写替身
- 折叠头的点法与「不要找第一个按钮」的判据 → 见 [README.md](README.md) 的「折叠头怎么点」
