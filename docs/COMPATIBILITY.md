# COMPATIBILITY — 平台支持与已知限制

**层：活**（随代码走；宿主下限以 `package.json` 的 `engines.dsh` 为准）。

## 宿主版本

宿主下限以 [package.json](../package.json) 的 `engines.dsh` 为准（唯一真源，此处不复制会漂的值），
不做跨代兼容。**devDeps 锁定的宿主版本可能与实际运行的宿主错位**——改代码前先核对，
判据与处置见根 [AGENTS.md](../AGENTS.md) 的活跃坑。
判定方式与判据命令见 [PUBLISHING.md](PUBLISHING.md) 的「平台契约的取真源方式」。

## 凭据发现（按平台）

| 平台 | 行为 |
|---|---|
| macOS | 直接支持（读 App 自己的凭据文件） |
| Windows | 依次探测 Local 与 Roaming AppData（实测可用） |
| WSL | 优先读挂载的 Windows 用户目录 |

找不到时用 `WORKBUDDY_AUTH_FILE`（国际版 `WORKBUDDY_AI_AUTH_FILE`）指定实际文件。

桌面凭据是 at-rest 加密的，**取凭据必须用 WorkBuddy 自带的 Electron**；发现策略按平台选
（`cnAppDiscovery()`，宿主与 CLI 共用一处），默认路径也按策略取 —— 两者混用会让一条策略
报出另一条平台的路径。判据见根 [AGENTS.md](../AGENTS.md) 的活跃坑。

## 模型目录来源

- **国内版**：走官方 CLI 同款接口。
- **国际版**：来自 App 界面接口（**私有实现**，上游改动可能失效）。

## 已知缺口

- **无凭据时该版模型分组不再显示** —— 插件不展示一份选了必然报错的兜底列表。
- **企业账号积分目前仅覆盖国内版**。
- **TUI 无手动检测**（界面能力，非平台缺口）。
