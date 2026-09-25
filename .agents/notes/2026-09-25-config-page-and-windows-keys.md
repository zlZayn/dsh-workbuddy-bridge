# 配置页不出现 + Windows 上取不到密钥（两个静默缺陷）

日期：2026-09-25
状态：已修

## 现象

装进 `web` profile、重启宿主之后：

- 侧栏 Plugins → 本插件详情页里**没有配置区**，页面也不报错。
- 输入区的模型选择器里**没有 WorkBuddy 分组**，无法选它的模型。

两件事都**没有任何错误信息**，所以只能从状态反推。

## 缺陷一：设置命名空间取的是包名，不是条目 id

`src/client/index.tsx` 把 `ctx.configForms.get(BUNDLE_NAME)` 与
`whileServed([BUNDLE_NAME])` 都喂了包名 `dsh-workbuddy-bridge`。

但宿主发布设置文档用的是**条目 id**：

- `dsh-settings/lib/index.js:432,443` —— `ns: entry.options.id`。
- `dsh --profile web --dump-config` 的组装结果印证：

  ```yaml
  # == dsh-workbuddy-bridge
  - id: llm-workbuddy            # 条目 id → 设置命名空间
    name: dsh-workbuddy-bridge   # 包名   → 槽 key
  ```

于是那个命名空间从没被服务过，`whileServed` 永不触发 → 槽不注册 →
插件管理页的 `configured = ledger.bundles.has(pkg.name)` 为假 → **整块配置不渲染**。

**两个 id 的分工**（另两仓因两串相同而看不出差别，本仓把它们分开了）：

| 用途 | 取哪个 |
|---|---|
| 槽 `plugins.bundle.config` 的 `key` | **包名**（宿主按 `pkg.name` 派发） |
| `configForms.get()` 的实参 | **条目 id**（= 设置命名空间） |

修法：客户端拆成 `BUNDLE_NAME` 与 `ENTRY_ID` 两个常量，各自钉在红线上
（`ENTRY_ID` 与 `cordis.patch.yml` 的 `insert[].id` 逐字相等）。

## 缺陷二：Windows 上无法解密桌面凭据

桌面凭据是 at-rest 加密的（`{$wbEncrypted:1, envelope}`），要拿它得用 WorkBuddy
自带的 Electron 当密钥助手跑一次。而发现链路**只认 macOS**：

- `defaultWorkBuddyElectronPath()` 只在 darwin 返回路径。
- `WorkBuddyElectronDiscovery` 只有 `'none' | 'macos-workbuddy'`。
- CLI 与宿主两处都把 CN 变体写死成 `'macos-workbuddy'`。

结果 Windows 上永远 `electron-binary-unavailable` → 签出 → 没有模型分组。
**本机实测**：设 `WORKBUDDY_ELECTRON_BIN=E:\WorkBuddy\WorkBuddy.exe` 后立刻
`signed-in`（凭证可用），说明只差「找到那个 exe」。

修法：

- 新增 `'windows-workbuddy'` 策略：先探默认位置
  （`%LOCALAPPDATA%\Programs\WorkBuddy\WorkBuddy.exe`），再查 Uninstall 注册表键。
- 默认位置改成**按策略**取（`defaultWorkBuddyElectronPath(discovery)`），
  不按平台 —— 否则 macOS 策略在 Windows 上会报出一个永远跑不起来的默认路径，
  与紧随其后的 `discoverMacosApp` 自相矛盾。
- 平台选择收进 `cnAppDiscovery()` 一处，宿主与 CLI 共用（此前两处各写一份）。

### 注册表读取的一个反直觉点

`reg query <hive> /s /f WorkBuddy` 用**退出码 1** 表示「没有匹配」，且有两种形状：

- 键存在但没匹配 → stdout 打本地化的「找到 0 匹配」；
- 键不存在 → stdout 为空，消息走 stderr。

第一版把「stdout 为空且退出码 1」当成正常空结果，于是**第一种形状被判成「查不了」**，
每次发现都失败。正确判据是：只有**被杀死（超时）**或**进程根本没起来**
（`ENOENT`/数字以外的 code）才算「查不了」；退出码是数字就都是答案。

这条**猜不出来**，所以红线上加了一条打真实 `reg.exe` 的守卫 ——
用替身测不出退出码契约。

另外 `/f` 会把不含 "WorkBuddy" 的值一并过滤掉，所以 dump 是键的**局部视图**
（例如 `DisplayVersion` 通常不出现）。解析器只认它真正需要的字段。

## 替代方案

- **只让用户设 `WORKBUDDY_ELECTRON_BIN`**：能解，但要求每台 Windows 机器手工配环境变量
  并重启宿主；本机安装目录还不在默认位置（`E:\WorkBuddy`），默认路径救不了。
- **把条目 id 改成包名**（与另两仓同形，两个 id 又变回同一串）：能解缺陷一，
  但会**重新引入**「两串今天相同、明天改一处就静默坏」的耦合 —— 那正是这个缺陷的成因。
  本仓选择把它们显式分开并各自钉住。
- **Windows 上用 PowerShell 查注册表**：同为子进程，但启动更慢、还多一层执行策略变量；
  `reg.exe` 是这条链上最小的依赖。
