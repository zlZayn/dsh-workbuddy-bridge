# 贡献

缺陷与需求走仓库 Issues。改代码前先读 [AGENTS.md](AGENTS.md)（规则、常用命令、活跃坑）与
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)（设计契约）。

## 本地提交钩子（pre-commit）

提交前自动修复格式（Prettier）与 lint（ESLint）。本仓是三个插件仓里唯一用 pnpm 的，钩子因此走
`pnpm exec`（与 CI 的 `pnpm install --frozen-lockfile` 同一棵树），**不联网下载**；
typecheck、测试与 `check:release` 留在 [ci.yml](.github/workflows/ci.yml)。

前提：需要 uv 与 pre-commit（pre-commit 用 `uv tool install pre-commit` 装到 `~/.local/bin`）。

```bash
uv tool install pre-commit
pre-commit install
```

> 装完需重开终端（或重载 shell 配置），PATH 才生效。

- 手动全量跑：`pre-commit run --all-files`
- 跳过单次：`git commit --no-verify`
- 定义：[.pre-commit-config.yaml](.pre-commit-config.yaml)

## 提交前检查

```bash
pnpm run typecheck && pnpm run build && pnpm run test
pnpm run lint && pnpm run format
```

顺序固定：**build 必须在 test 之前**（[tests/version.spec.ts](tests/version.spec.ts) 断言产物与包版本一致）。
全量命令与判据见根 [AGENTS.md](AGENTS.md) 的「常用命令」。

改文档（README / AGENTS / docs / notes）后再跑一次链接校验与换行校验；命令见根 [AGENTS.md](AGENTS.md)。

## 提交纪律

- 按逻辑拆小 commit：一个 commit 说清「做了什么 / 为什么 / 怎么验证 / 怎么回滚」。
- **`lib/` 是被跟踪的产物**：改源码后要重建并连同源码一起提交。
- 提交信息写清楚动机，不写流水账；渲染面改动要么同批带重截图，要么在 commit body 里写明为什么不重截
  （判据见 [assets/AGENTS.md](assets/AGENTS.md)）。
- 行为 / 契约变化在同一次改动内 bump 版本，语义见 [docs/PUBLISHING.md](docs/PUBLISHING.md)。
