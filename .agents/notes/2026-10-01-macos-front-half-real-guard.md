# 决策：macOS 发现链前半段进 CI，真 plutil 与真 X_OK、只假 mdfind（2026-10-01）

状态：生效

## 问题

- 平台矩阵让 Windows 侧打真实 `reg.exe` 的守卫第一次进 CI，但 macOS 侧没有对等物：整条发现链此前零执行。
- 全链进不了 CI 是硬伤：helper 是 WorkBuddy 自带的 Electron（专有、装不上 runner），密钥在它的 at-rest 加密里，还要真实登录。
- 但**前半段不需要凭据**：`plutil` 读 `CFBundleIdentifier`、`accessSync(X_OK)` 判可执行位，只需要一个真 Darwin 环境。
- 接缝是现成的：`WorkBuddyDiscoveryTools` 注入子进程，`spawnHelper` 只换 payload 而保留 resolution 为真（见 [src/credential/at-rest.ts](../../src/credential/at-rest.ts)）。

## 决策

- `tests/electron-discovery.spec.ts` 新增 `describe('macOS discovery: against the real plutil')`，三条用例都 `skipIf(process.platform !== 'darwin')`：
  1. 合成 `.app`（真 `Info.plist` + 可执行 Electron）→ 真 `plutil` 读出 id → 解析出的二进制被 `spawnHelper` 观察到；
  2. 真 plist 写了别的 bundle id → 该候选被排除，判定为 `electron-binary-not-found`；
  3. bundle id 正确但 Electron 不可执行（`0o644`）→ 同样排除。
- 只假 `findApps`：`{ ...workBuddyDiscoveryTools(), findApps: async () => [bundlePath] }`。Spotlight 索引在托管 runner 上不可控。
- 用例内先断言前提：`/usr/bin/plutil` 存在，且真 `plutil` 确实读回了合成 plist 里的 id —— 前提不成立就红，不留假绿。
- 证不了的两段（Spotlight 查询本身、helper 取 key）仍只在发版清单里，见 [docs/PUBLISHING.md](../../docs/PUBLISHING.md)「发版前确认」。

## 替代方案（强制）

- **把 `scripts/issue-48-forced-fallback-e2e.mjs` 放进 macOS 格**（任务书原方案）：它读真机凭据文件、开头就是前提断言，托管 runner 上必红。
- **挂 self-hosted Mac runner 换全链进 CI**：账号掉登录就变红，维护者会开始忽略这条红色。
- **连 `plutil` 也用替身**：那就是"跑的是 mock"，与这条守卫存在的理由相反。
- **维持只在真机人工跑**：写好的链继续零执行，正是要堵的洞。
- **先在本机验证完再上**：本机没有 Darwin，做不到；改用「本地等价 dry run + 用例内前提断言」把未验证面压到最小。

## 影响

- macOS 格上三条真跑；Windows / ubuntu 上是 skip（**skip 不是绿**）。
- 未验证面只剩"真 `plutil` 在 runner 上的行为"：参数形状与本仓真机脚本同源，且前提断言会在读不到 id 时立刻红。
- 推送后 macOS 格的首次执行才算验证过；在那之前只有本机证据：typecheck 通过、固件与接线的等价 dry run 4/4（把 `plutil` 换成读同一份 plist 的替身，跑完即删）。
