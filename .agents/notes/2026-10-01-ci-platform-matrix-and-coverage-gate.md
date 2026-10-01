# 决策：CI 上三平台矩阵与覆盖率门槛，真机验证留在发版清单（2026-10-01）

状态：生效

## 问题

- CI 只有 `ubuntu-latest` 一格，而平台分支代码是真的：Windows 注册表探测、WSL 支持、macOS 默认路径布局。
- 单测的平台 API 是 mock 注入的，所以矩阵的价值是**只有真平台才会执行**的那批断言，不是"把同样的用例再跑一遍"。
  断言清单与 `fail-fast: false` 的理由写在 [ci.yml](../../.github/workflows/ci.yml) 的矩阵注释里。
- 两个写好的脚本零执行：`scripts/verify-shim-hardening.mjs`（纯离线，能进 CI）、`scripts/issue-48-forced-fallback-e2e.mjs`（真机）。
- 源文件与用例没有覆盖率数字与红线，回归保护靠"尽力而为"。

## 决策

- `ci.yml` 的 `verify` job 上三平台矩阵（ubuntu / windows / macos），`fail-fast: false`：一格红了也要看清另外两格。
- `scripts/verify-shim-hardening.mjs` 进 CI，排在 build 之后 —— 它 import `lib/` 产物，排在 build 之前必红。
- Test 步改为 `pnpm exec vitest run --coverage`；阈值与 include / exclude 定义在 [vitest.config.ts](../../vitest.config.ts)。
- 覆盖率 `include` 写 `src/**/*.{ts,tsx}`，不写 `src/**`。
- 三条真机脚本（`live-e2e.mjs`、`client-identity-live-matrix.mjs`、`issue-48-forced-fallback-e2e.mjs`）写进
  [docs/PUBLISHING.md](../../docs/PUBLISHING.md)「发版前确认」第 5 条，**不进 CI**。
- `vitest` 抬到与 `@vitest/coverage-v8` 同版（4.1.11）。
- `package.json` 的 `check` 脚本改成 `typecheck && build && test`，与「build 必须先于 test」的既有顺序契约一致。
- macOS 发现链**前半段**（真 `plutil` 读 bundle id + 真 `X_OK`）也进 CI：三条 darwin 用例，只假 `mdfind`；
  为什么不把 `plutil` 也替身、以及它证不了什么 →
  [2026-10-01-macos-front-half-real-guard.md](2026-10-01-macos-front-half-real-guard.md)。

## 替代方案（强制）

- **把 `issue-48-forced-fallback-e2e.mjs` 放进 macOS 格**（任务书原方案）：脚本读真机凭据文件且无 try/catch，开头是
  「真机默认路径存在 / 真机凭据在位」的前提断言，还钉死 helper 必须是真机那个 App。托管 runner 上没有 WorkBuddy、
  没有登录态 → 每次 macOS 必红。它的定位是
  [docs/archive/issue-48-electron-path-plan.md](../../docs/archive/issue-48-electron-path-plan.md) §9.2-A 的「发布前做一次」真机验证，
  与 `live-e2e.mjs` 同类。
- **挂 self-hosted Mac runner 换全链进 CI**：唯一能让真机链进 CI 的办法。否掉 —— 账号掉登录就变红，
  维护者会开始忽略这条红色，代价大于收益。
- **覆盖率 `include` 用 `src/**`**（任务书原写法）：v8 会把子树的文档双件与 `.css` 一起解析，
  每次刷 20 组 `RolldownError: Parse failed`；数字一样（分母都是 2277 行），只有日志不可接受。
- **覆盖率不开 `exclude` 硬上**：浏览器 lane 会 inline 两个官方包，它们的 `//# sourceMappingURL=index.js.map`
  指向没有发布的 map，v8 的 remap 直接抛。
- **`@vitest/coverage-v8@^4` 单独装、不抬 `vitest`**：双向 unmet peer（`pnpm peers check` 报错），锁文件里留一个未满足的 peer。
- **给 `test` 脚本加 `--coverage` 而不是改 CI 的 Test 步**：会同时改掉 [release.yml](../../.github/workflows/release.yml) 的测试行为
  （它调 `pnpm run test`），超出本次范围。

## 影响

- ubuntu 格多花约 10 秒（coverage + 离线 shim 验证）；矩阵把 CI 用量抬到三倍。
- 覆盖率实测：lines 80.1–80.2%、statements 77.5–77.6%、functions 75.24%、branches 71.7–71.9%
  （三次运行抖动 ≤0.1 点），四项阈值余量 ≥10 点，不会因抖动误红。
- 未被任何测试加载的源文件计入 0%，门槛是真门槛，不是"只统计跑到的文件"；阈值双向生效：砍测试会红，加一批新源文件也会红。
- 矩阵与门槛**尚未推送**，windows / macos 两格的真机结果以
  [CI 运行记录](https://github.com/zlZayn/dsh-workbuddy-bridge/actions/workflows/ci.yml) 为准；
  本机只有 Windows 一格的实跑证据（全量流水线 8 步全绿、frozen install 通过、actionlint 零 findings），macOS 从未真机跑过。
- 真机脚本从「零执行、零台账」变成发版清单里的显式步骤；除 macOS 前半段（已进 CI）外，它们仍不可自动执行 —— 这是平台事实。
