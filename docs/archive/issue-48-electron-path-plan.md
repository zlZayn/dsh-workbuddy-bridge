# #48 实现方案：macOS Electron 二进制定位

状态：**待评审，未实现**
关联：issue #48（Garnerye）、#43（同批修复，0.6.0 已发）
目标版本：0.6.1（与 #45/#47 等同批）

---

## 1. 问题

WorkBuddy 5.6 起把 `accessToken`/`refreshToken` 封成 `$wbEncrypted` 信封，插件要解密必须**启动 App 自带的 Electron**（`ELECTRON_RUN_AS_NODE=1`）去取 key。找这个二进制的位置靠 `defaultWorkBuddyElectronPath()`：

```ts
const MACOS_ELECTRON_PATH = '/Applications/WorkBuddy.app/Contents/MacOS/Electron'

export function defaultWorkBuddyElectronPath(): string | undefined {
  return process.platform === 'darwin' ? MACOS_ELECTRON_PATH : undefined
}
```

**macOS 只有一个硬编码候选。** 用户把 App 放到 `/Applications/IDE/WorkBuddy.app` 后，`accessSync` 失败 → 抛错 → 解密不了 → 已登录却被判定 `signed-out`。

本质：**我们把「App 装在 `/Applications` 根目录」当成了前提，但它只是常见值。** App 可以装在任意位置（`~/Applications`、子目录、外置卷）。

### 与 #43 的区别（回复口径要用）

| | #43 | #48 |
|---|---|---|
| 位置 | 凭据**文件**路径 | Electron **二进制**路径 |
| 根因 | 漏了 XDG 标准位置 | 假设了唯一位置 |
| 修法 | 补候选列表 | 需要系统级发现 |

`/Applications` 不是"漏了一个标准位置"，而是"路径本来就不固定"。所以**不能靠多列几个候选路径解决**。

---

## 2. 探测手段调研（**仅手工验证了命令本身**）

> **范围声明**：本节只证明下面这些**命令**在本机能返回预期结果。**我们代码里的发现链路（含 plutil 校验、X_OK、helper spawn）尚未验证**，且因为本机默认路径存在，链路至今**没有被真实触达过**——见 §9.1。

| 手段 | 结果 | 延迟 | 依赖 | 结论 |
|---|---|---|---|---|
| `/usr/bin/mdfind "kMDItemCFBundleIdentifier == 'com.tencent.workbuddy.mac'"` | ✅ 返回 `/Applications/WorkBuddy.app` | **47ms** | Spotlight 元数据索引 | **采用** |
| `lsregister -dump` \| grep | ✅ 能查到 | 慢 | 无 | 不采用（输出巨大、含已卸载卷残留如 `/Volumes/WorkBuddy AI 5.5.2-arm64/...`） |
| `osascript` + Finder `application file id` | ❌ 权限违例 `-10004` | — | 自动化权限 | 不采用 |

**bundle id（本机 `lsregister` 实测确认）**：

- 国内版：`com.tencent.workbuddy.mac` ← **本次只查这个**（见 §3.3）
- 国际版：`com.workbuddy.workbuddy-ai` ← 本次不查，仅记录

**为什么 mdfind 是"优雅"的**：我们不是在猜路径，而是**用系统的元数据索引按 bundle id 查**。Spotlight 元数据索引（`kMDItemCFBundleIdentifier`）能按 bundle id 定位**已索引的** App——用户装在哪、叫什么名字，索引里都有。这与"遍历目录"有本质区别。

**注意区分两个系统服务**（本方案用的是前者）：

| | 作用 | 本方案 |
|---|---|---|
| **Spotlight 元数据索引**（`mdfind`） | 按 `kMDItem*` 属性查已索引的文件 | ✅ **采用** |
| **LaunchServices**（`lsregister`） | 系统登记的 App 注册表（打开方式、默认应用） | ❌ 不采用（见上表） |

**这也解释了它的失败模式**：`mdfind` 只回答"索引里有什么"。索引关闭、被排除、或刚装完还没建好时，它会返回空——**此时 App 其实装着**。所以：

- 失败时**不能**说"App 未安装"（§3.5 已作为措辞纪律记下）；
- 这是该方案已知的固有局限，不是实现缺陷。

---

## 3. 方案

### 3.0 设计原则：低侵扰（用户 2026-09-23 定）

**默认路径保留不动，只有识别失败时才启动发现机制。**

这条是方案的总纲，它同时约束了两件事：

1. **不加静态候选路径**（不做 `~/Applications`、不做目录遍历）—— 静态候选本身就是"猜位置"，属于侵扰，且永远猜不全；
2. **mdfind 只在默认路径失败后触发** —— 正常用户（App 在 `/Applications`）从头到尾**不知道这套机制存在**，零进程外调用、零额外延迟、零行为变化。

即：**失败路径才付出代价，成功路径保持原样。**

### 3.1 解析顺序与失败语义（`resolveWorkBuddyElectronPath()`）

**两个独立开关：`explicit`（显式配置权威）与 `discovery`（是否启用默认路径+mdfind）。**

```
① options.electronPath 有值？
     ├─ yes → 只用它。不存在 / X_OK 失败 → 报错（不回落）
     └─ no ↓
② WORKBUDDY_ELECTRON_BIN 有值（trim 后非空）？
     ├─ yes → 只用它。不存在 / X_OK 失败 → 报错（不回落）
     └─ no ↓
③ discovery 开关 = 'none'？（Global 走的路径）
     ├─ yes → 报错「no WorkBuddy Electron binary is known」（不猜、不 mdfind）
     └─ no（CN）↓
④ 默认路径 /Applications/WorkBuddy.app/Contents/MacOS/Electron
     ├─ 存在且 X_OK → 用它
     └─ 失败 ↓
⑤ mdfind com.tencent.workbuddy.mac
     去重 → /usr/bin/plutil 校验 bundle id → X_OK 校验 Electron
     1 个合法候选 → 使用并缓存
     0 个         → 友好报错（→ §5 提示词）
     >1 个        → ambiguous（→ §3.4）
```

**关键一：前两层是显式配置，不是"逐层命中"的候选。**

| 层 | 类型 | 失败行为 |
|---|---|---|
| `options.electronPath` | 显式（测试注入） | **报错，不回落** |
| `WORKBUDDY_ELECTRON_BIN` | 显式（用户指定） | **报错，不回落** |
| 默认路径 + mdfind | **仅 CN** 的自动发现 | CN：落到 mdfind；Global：**不进入** |

**为什么显式配置不能回落（勿回退）**：显式配置代表**用户的明确意图**。如果 env 指了一个不存在的路径，我们却回落到默认路径、甚至 mdfind 找到另一个副本并执行它，那就是**用户明明指定了某个 WorkBuddy 副本，我们却悄悄执行了另一个**。这不仅违背意图，还有安全含义——见 §3.2：**我们会执行这个二进制**，所以必须是用户指定（或验证过身份）的那一个。

**关键二：`discovery` 开关按 variant 分派**（§3.3）——CN 拿 `'macos-workbuddy'`，Global 拿 `'none'`。

```ts
new WorkBuddyAtRestKeyProvider({ discovery: 'macos-workbuddy' })  // CN：默认路径 + mdfind
new WorkBuddyAtRestKeyProvider({ discovery: 'none' })             // Global：无默认、无 mdfind
```

**注意不能用"传 `electronPath: undefined`"表达"没有默认值"**：现有解析是 `??` 链，`undefined` 会**穿透**到 `defaultWorkBuddyElectronPath()`，反而拿到 CN 路径。必须用显式开关。

**`WORKBUDDY_ELECTRON_BIN` 对 Global 依然有效**——它是用户的**显式指定**（第 ② 层），不属于"隐式尝试"。Global 用户要指定仍有出口，只是不再自动猜。

**与现有代码的差异**：现有实现（`src/desktop-credential-protection.ts:336-339`）是 `options.electronPath ?? env ?? default` 一次选出唯一路径，两个 variant 共用同一个无参 provider，**Global 也会拿到 CN 的默认路径**。本方案改变这一点：**Global 的默认值收为 `none`**。这是**有意的行为收紧，不是"零变化"**——见 §3.3。

**`~/Applications` 明确不加**（§3.0 已定）：它属于"猜位置"，与低侵扰原则冲突；mdfind 能覆盖它，且覆盖得更全。

**两个 bundle id 都查？不。本次只查国内版**——见 §3.3。

**缓存与恢复：现有 `readonly` 字段不构成缓存，方案必须重新设计（用户 2026-09-23 纠正）**

原稿写"现有 `electronPath` 已是 `readonly` 字段，缓存天然成立"——**这句是错的**。实际代码：

```ts
// src/desktop-credential-protection.ts:329
private readonly electronPath: string | undefined

// 构造函数（336-339）：解析一次，此后不可变
this.electronPath = options.electronPath ?? env ?? defaultWorkBuddyElectronPath()
```

`readonly` 只说明**构造后不可改**，不代表它缓存了 mdfind 的结果——**mdfind 是本次新增的，根本不在现有字段里**。而 `defaultWorkBuddyElectronPath()` **不做任何存在性检查**（第 46-48 行只判断 platform），存在性检查在 `spawnPayload()` 里（第 397 行 `accessSync`）。

所以真实时序是：

| 阶段 | 现有行为 |
|---|---|
| 构造（`src/index.ts:634`，插件加载时） | `electronPath` = 常量 `/Applications/...`，**无 I/O** |
| `protectorKeyFor()` | 经 `source()` → `spawnPayload()` → 此时才 `accessSync`，失败抛错 |
| 失败是否缓存 | **不缓存**——`cache` 只在成功时写入（第 384 行），`inflight` 在 `finally` 里清空（第 362 行） |
| 宿主凭据检查（默认 30s，`src/index.ts` 的 `syncAll()`） | 重新读取凭据；上次取 key 失败时会重试 |
| 卡片轮询（60s） | 收到 `signed-out` 后停止，不能承担失败后的自动恢复 |

**缓存与解析的设计约束**：

1. **解析必须发生在失败之后，不能在构造时**。构造函数是**同步**的（`src/auth.ts:321` 只做 `??` 赋值），而 mdfind 是**进程外异步调用**。所以 discovery **不能放进构造函数**——否则插件加载时就会 spawn 子进程，直接违反 §3.0 低侵扰。正确位置是 `spawnPayload()` 内部（`async`，第 388 行），**仅在默认路径 `accessSync` 失败后**才触发。
2. **失败不得被缓存成"永久失败"**。这是原稿提过的要求，现在有了具体约束：`electronPath` 是 `readonly`，**不能把 mdfind 结果写回它**。需要在 `spawnPayload()` 内用一个**可变的、只缓存成功结果的**字段（如 `resolvedByDiscovery?: string`），失败时保持 `undefined`，下次轮询重试。

3. **成功路径缓存也需要失效规则**。每次确需启动 helper 时，先保留默认路径优先的顺序，再检查已缓存的发现路径。缓存路径不存在或不可执行时清除缓存，并重新发现一次；重新发现失败不保留旧值。helper 已启动但返回坏 payload 或 key 不匹配时，仍报解密错误，不自动轮换副本。显式路径失败始终报错，不进入此失效回退逻辑。

**恢复约定**：修复 App 安装位置后，宿主的凭据检查可在无需重启的情况下恢复模型列表；已打开的失败卡片需点击现有刷新按钮或重新展开以更新。此次保留卡片的轮询门控，不承诺卡片自动消除错误。修改启动环境中的变量仍需重启相应宿主。测试分别覆盖后台恢复与卡片手动刷新。

### 3.2 身份校验（硬要求）

`mdfind` 返回的是**路径字符串**，不是可信对象，且**可能返回多个**（多版本共存）。所以拿到路径后必须先验证身份，再执行。

**为什么是硬要求**：我们会**执行**这个被发现的二进制，并让它运行 helper 脚本（`execFile(electronPath, ['-e', HELPER_SCRIPT])`，见 `src/desktop-credential-protection.ts:402`）。因此发现结果必须先**验证应用身份**，再执行。

**注意不要把理由说过头**（用户 2026-09-23 纠正）：**我们不把 credential / token 作为参数交给 helper**——helper 只接收一段固定脚本文本，凭据从未离开插件进程。所以"把凭据交给别的程序"这个说法是**不准确的**。风险在于**执行一个身份未经验证的二进制**。

#### 3.2.1 `CFBundleIdentifier` 能伪造，所以它单独不够（用户 2026-09-23 提出）

**任何 `.app` 都能把 `Info.plist` 的 `CFBundleIdentifier` 写成 `com.tencent.workbuddy.mac`**——它是个纯文本字段，没有任何密码学保护。所以只校验它，挡不住一个**故意伪造身份**的 App。

但它的**防护定位要说清楚**（避免两种错误结论）：

| `CFBundleIdentifier` 校验**能**挡住的 | 它**挡不住**的 |
|---|---|
| **误命中**：mdfind 因索引脏/名字相近返回了**无关的正常 App** | **蓄意伪造**：攻击者放一个自称 WorkBuddy 的 `.app` |
| 国内版/国际版**串台** | |
| 已卸载但未清理的残留登记 | |

该检查排除声明为其他产品的候选；#48 已知事实仅为 App 位于非标准安装目录。

#### 3.2.2 是否加签名校验：本机已确认可行，但本次不做

本机实测，真实 App 的签名身份是可得且明确的：

```
$ codesign -dv /Applications/WorkBuddy.app
Identifier=com.tencent.workbuddy.mac
TeamIdentifier=FN2V63AD2J
Authority=Developer ID Application: Tencent Technology (Shanghai) Company Limited (FN2V63AD2J)
```

如需验证发布者，需同时验证签名有效性和预期签名身份；仅显示 TeamIdentifier 或仅确认某个签名有效都不够。本次不增加该验证。

**本次不做，理由**：

1. **范围选择**：本次修复非标准安装位置的发现，并排除 bundle id 明确不匹配的候选；不提供发布者真实性保证。文件能够落盘不等于已经执行，不能以此否定签名校验的价值；
2. **问题边界**：#48 已知问题是找不到非标准位置的 App，不能将其描述成已证实的误命中其他 App；
3. **成本与风险**：`codesign` 是又一次进程外调用（落进 §3.0 的低侵扰预算），且**用户自行重签、企业分发重签、ad-hoc 签名**都会让校验失败——把一个"能用的 App"判成不可用，反而制造新 bug；
4. **无证据**：没有真实案例表明存在针对本插件的伪造 App。

**实际保证**：检查 bundle id，拒绝明确不匹配的候选；不验证发布者身份，也不防止蓄意伪造。签名校验属于后续独立决策。

#### 3.2.3 校验实现

1. 定位 `<App>.app`（从 `.../WorkBuddy.app/Contents/MacOS/Electron` 反推，或直接用 mdfind 返回的 `.app` 路径拼 `Contents/MacOS/Electron`）；
2. 用 `/usr/bin/plutil` 读 `Contents/Info.plist` 的 `CFBundleIdentifier`，**确认等于 `com.tencent.workbuddy.mac`**；
3. 再 `accessSync(X_OK)`；
4. 才 `execFile`。

**读法用 `plutil` 绝对路径**（本机实测确认）：

```sh
/usr/bin/plutil -extract CFBundleIdentifier raw -o - /Applications/WorkBuddy.app/Contents/Info.plist
# → com.tencent.workbuddy.mac
```

二进制 plist 直接可读，`-o -` 输出到 stdout、`raw` 去掉引号，输出就是一行 id。语义比 `defaults read` 干净（后者是"读任意文件"，不是专为 plist 设计的解析器）。**用绝对路径 `/usr/bin/plutil`，不走 PATH**——与 `mdfind`、`ps` 同样的理由：PATH 被改时不能解析到别的东西。

### 3.3 只查国内版 bundle id（用户 2026-09-23 定）

**本次只自动查 `com.tencent.workbuddy.mac`，不查国际版 `com.workbuddy.workbuddy-ai`。**

理由（用户给定，勿回退）：

1. **Global 的加密凭据从未真机验证过**（AGENTS.md 亦记：`Global encrypted` 从未见过）；
2. 把两个 bundle 混进同一个候选池，**可能执行错产品**——拿国际版 App 的 Electron 去解国内版的凭据，或反之；
3. **#48 是 CN 问题，就只修 CN**。

#### 光"只查一个 id"不足以让 Global 真正隔离

**当前代码里 CN / Global 共用同一个 provider 实例**（`src/index.ts:634`），且**默认路径也不区分 variant**（`src/desktop-credential-protection.ts:38` 恒为 CN 的 `/Applications/WorkBuddy.app`）。provider 不知道这次 `protectorKeyFor()` 是被 `workbuddy` 还是 `workbuddy-ai` 调起的。

所以只把 mdfind 加进共享 provider 是不够的：**Global 仍会先隐式尝试 CN 的默认路径，失败后再 mdfind 找到国内版并执行它。**

#### 定下来的做法：按 variant 拆 provider（用户 2026-09-23 定）

| variant | provider 配置 | 行为 |
|---|---|---|
| CN（`workbuddy`） | `discovery: 'macos-workbuddy'` | 默认路径 → mdfind（新行为） |
| Global（`workbuddy-ai`） | `discovery: 'none'` | **无默认路径、无 mdfind**，直接报"no binary known" |

**构造入口必须同时覆盖宿主和 CLI**：`index.ts` 按 variant 分别传入 provider；`src/bin.ts` 的 `makeStore(variant)` 同样显式注入对应 provider。CLI 当前没有传 `keyProvider`，若仅修改宿主且把无参构造改成 `none`，国内版 `doctor/status` 会失去原有解密能力。

**明确不做**：通用 variant-aware resolver、改 `protectorKeyFor()` 签名、支持国际 bundle id。

**为什么这个拆法更干净**：差异**收敛在构造点一处**，而不是让 variant 渗透进 provider 内部的解析逻辑。provider 仍是"不知道自己是哪个 variant"的组件，只是**配置不同**。

#### 这不是"零变化"，是有意的行为收紧

| 场景 | 今天 | 改后 |
|---|---|---|
| Global + 加密凭据 + CN App 已装 | **会执行 CN 的 Electron** | 直接报错，不执行任何 App |
| Global + 加密凭据 + CN App 未装 | 报 "not available at /Applications/..." | 报 "no binary known" |

**改后 Global 的行为确实变了**，方向是"**不再隐式执行国内版二进制**"。这是对的：Global 悄悄跑 CN 的 App 本身就是错的，不管它碰巧成功还是失败。文档不得写成"Global 零变化"。

**已知代价（如实记录）**：若 Global 加密凭据的 at-rest key 恰好与 CN 共用（`~/.workbuddy/` 是 per-user 路径，不能排除），今天"隐式跑 CN Electron"**可能碰巧解开**，改后不会。但该组合**从未被验证过**——与其依赖未验证的碰巧成功，不如明确失败并保留 `WORKBUDDY_ELECTRON_BIN` 出口（该出口对 Global 仍然有效，见 §3.1 第 ② 层）。

#### Global 的失败交给 Agent

Global 未指定二进制时说明“当前尚未配置 WorkBuddy AI 的解密程序”，提供 §5 中明确指向 **WorkBuddy AI** 的 Agent 提示词。Agent 可定位 App、配置实际启动环境并协助重启和验证；提示词不声称已经搜索过，也不声称 App 装在非标准位置。国际版自动发现仍不纳入本次范围，真实加密凭据兼容性仍待验证。

**实现约束**：

- 差异必须是**构造参数**（`discovery`），不能靠 provider 读 `process.env` 或全局状态；
- **不能用 `electronPath: undefined` 表达"无默认值"**——`??` 链会穿透到 `defaultWorkBuddyElectronPath()`（§3.1）；
- **无参构造应默认 `discovery: 'none'`**（安全默认）：`src/auth.ts:321` 的 `?? new WorkBuddyAtRestKeyProvider()` 兜底因此不会误跑 CN 二进制；
- 现有测试 `tests/desktop-credential-protection.spec.ts:266-270` 钉住"无参 → CN 默认路径"，**需随之改**（改为显式传 `discovery: 'macos-workbuddy'` 才期望 CN 路径）。

**将来国际版出现同类 case**，再按 variant 传入目标 bundle id（届时是扩展现有 `discovery` 参数，而不是现在混池）。

### 3.4 多候选：不猜，明确报错

去重后按以下口径判定（用户 2026-09-23 定）：

```
mdfind com.tencent.workbuddy.mac
  ↓
去重（CFBundleIdentifier + realpath）
  ↓
合法候选 = 1 → 使用并缓存
合法候选 = 0 → 友好报错（进入 §5 提示词流程）
合法候选 > 1 → 报「发现多个 WorkBuddy，无法安全自动选择」
```

**`=1` 的前提是检查完整结束**：mdfind 成功完成，所有候选均完成检查，且恰好一个候选符合条件。它只表示本次索引结果中的唯一可用候选，不保证它是机器上唯一副本或与凭据匹配。任何候选检查超时、权限错误或结果无法解释时，不得把它排除后宣称唯一；返回 `electron-discovery-incomplete`，不执行 helper。

**`>1` 明确报错，不做"择优"**：`/Applications` 优先、版本号降序、字典序兜底这类规则是**我们猜的，不是用户的意愿**。猜错的代价是**执行了一个用户没打算用的副本**。明确报错让用户自己选，比静默猜更诚实——与项目一贯的「不装成可信数字」原则一致（企业积分那三条设计同源）。

**未来方向（本次不做，属另一层改造）**：真要做多副本的智能选择，正确依据是 **credential key id**——用它去逐个匹配副本，而不是按路径/版本号猜。理由：key id 是**凭据自己声明**的"该用哪个 App 解"，来自事实而非启发式规则。前提是不管选哪个都不会执行错产品（见 §3.3）。本次判 ambiguous 即可。

**去重口径要划清**（避免误报）：同一份 App 被多个路径指到（路径别名、`/System/Volumes/Data/...` 视图、mdfind 对同一 bundle 返回多次）**不算多个**，按 `realpath` + bundle id 收敛成一个。真正的 `>1` 指：**两个不同实体**（不同路径 / 不同版本）。

**`>1` 的报错必须列出候选路径**，否则用户还得自己猜是哪两个（另一个很可能是他忘了删的旧版）：

```
发现多个 WorkBuddy 应用，无法自动选择：
  - /Applications/WorkBuddy.app（5.6.2）
  - /Applications/IDE/WorkBuddy.app（5.6.0）
请手动指定要使用的那个。
```

版本号同样走 `/usr/bin/plutil -extract CFBundleShortVersionString raw -o -`。

### 3.5 失败时的行为

**不做** `lsregister -dump` 兜底解析（输出脆、含残留卷）。失败直接抛错，但**错误信息必须说人话**：

现状：

```
the WorkBuddy Electron binary is not available at /Applications/WorkBuddy.app/Contents/MacOS/Electron; set WORKBUDDY_ELECTRON_BIN if it lives elsewhere
```

问题：用户读不出「凭据是好的，只是找不到 App」，且被要求理解环境变量。

改为（分三层）：

- **面向卡片/人（CN）**：`已找到加密的登录凭据，但没找到 WorkBuddy App 本体（已查过默认位置与系统索引）。请确认 WorkBuddy 已安装。`——**不承诺"可在设置里手动指定"**（§4-C 已移出 0.6.1，没有那个输入框）；引导走 §5 的提示词。
- **面向卡片/人（Global）**：说明未配置 WorkBuddy AI 的解密程序，并给对应 Agent 提示词。
- **面向卡片/人（CN / Windows / Linux）**：说明当前平台需手动指定解密程序，并给对应 Agent 提示词——**不声称做过自动搜索**（§3.6：这些平台本就不新增发现机制）。提示词让 Agent 协助定位、配置**实际启动环境**（不是当前 shell 的临时变量）并验证恢复。
- **发现未完成或显式路径不可用**：分别说明“自动定位未能完成”或“指定的程序路径不可用”，不声称“已查过系统索引但没找到”。
- **面向 doctor**：此次复用 `reason`，与卡片显示同一份简短诊断，包含失败阶段和必要路径，不承诺额外的完整候选/工具诊断报告。不得拼接子进程 stdout/stderr、key、payload 或 token。

**注意措辞纪律**：不能**断言**"App 未安装"——Spotlight 索引被禁用时 mdfind 也会返回空，此时 App 其实装着。只能说"没找到"。（CN 那句"请确认 WorkBuddy 已安装"是**请求用户确认**，不是断言，可用。）

### 3.6 Windows / Linux：暂不新增自动定位（用户 2026-09-23 定）

**本次只做 macOS。** 理由（用户给定，勿回退）：

1. **Windows / Linux 没有同等明确的问题证据**。#48 是 macOS 上被实测复现的具体 case；其他平台目前没有对应的真实报告；
2. **贸然一起抽象成"跨平台应用发现框架"会立刻把 scope 放大**——每个平台的发现机制完全不同（macOS 靠 Spotlight 元数据；Windows 要靠注册表/已知目录；Linux 要靠 desktop entry / XDG），共性是假的。

**既有现状保持不变**：`defaultWorkBuddyElectronPath()` 在非 darwin 一律返回 `undefined`，加密凭据链路靠 `WORKBUDDY_ELECTRON_BIN` 手动指定。这是既有行为，**#48 不改变它**。

**但提示词照给（用户 2026-09-23 定）**：不新增自动定位 ≠ 不给 Agent 协助。Windows/Linux 未配置解密程序时，**同样提供提示词**，由 Agent 协助定位、配置启动环境并验证恢复——困难点在"怎么把路径配进宿主启动环境"（跨平台），不在"我们没搜"（§5.5 统一规则）。**措辞不得声称执行过搜索。**

**README 如实说明**：已知限制里应写清"非 macOS 平台需手动指定 `WORKBUDDY_ELECTRON_BIN`"（若原本未写明）。

**将来处理的前提**：出现真实的 Windows / Linux 案例，再按平台逐个设计——不做预先抽象。

### 3.7 发现流程的超时、输出上限与错误分类（用户 2026-09-23 定）

**关键事实：现有 10s timeout 覆盖不到发现流程。**

`timeoutMs` 只有一个使用点（`src/desktop-credential-protection.ts:403`）：

```ts
execFile(electronPath, [HELPER_SCRIPT_ARGUMENT_FLAG, HELPER_SCRIPT], {
  timeout: this.timeoutMs,        // ← 只包住 helper 这次 execFile
  maxBuffer: 1024 * 1024,
  ...
})
```

`mdfind` 与 `/usr/bin/plutil` 是**新增的两类子进程**，各自独立于该 timeout。**原稿风险表写"沿用现有 10s timeout 语义"是不准确的**，已删除。

#### 各自的边界（发现流程自带）

| 项 | mdfind | plutil |
|---|---|---|
| 超时 | **新增独立值**（建议 3s：实测 47ms，3s 已是 60 倍余量） | **新增独立值**（建议 3s，单次读 plist 应为毫秒级） |
| 输出上限 | 新增独立 `maxBuffer`（建议 1MB：一个 id 的路径列表远小于此） | 新增独立 `maxBuffer`（建议 64KB：输出是一行 bundle id） |
| 超时/超限后的行为 | `electron-discovery-incomplete`，不给出候选选择结果 | `electron-discovery-incomplete`，不能将未完成检查的候选当作不存在 |

**整个发现流程总预算为 10s**（独立于 helper 的 10s）：包含 mdfind、去重和所有候选的 plutil 检查。每次子进程超时取单次上限与剩余预算的较小值；预算用完终止发现并报告 incomplete。版本号仅供展示，读取失败显示路径即可，不影响已完成的候选身份判定，也不得突破总预算。

**不要复用 `timeoutMs`**：它是 helper 的语义（10s，因为要 spawn 一个完整 Electron 进程取 key），与"查一次系统索引/读一个 plist"的合理耗时差两个数量级。共用一个值会让实现者在调 mdfind 超时时**误改 helper 的超时**。

#### 错误分类（必须区分，不能都归成"失败"）

发现阶段有三类不同性质的失败，**对用户和 Agent 含义完全不同**：

| 类别 | 例子 | 归类 | 用户可见行为 |
|---|---|---|---|
| **工具不可用** | `mdfind` 不存在 / 不可执行 / EPERM | `electron-discovery-incomplete` | 自动定位未能完成，交给 Agent |
| **检查未完成** | 超时、输出超限、plist 无法读取或解析 | `electron-discovery-incomplete` | 不选择其余候选，交给 Agent |
| **明确不可用** | 路径已不存在、bundle id 明确不同、Electron 不可执行 | 记录简短原因，排除该候选 | 全部排除时用 `electron-binary-not-found`，措辞为“未找到可用的解密程序” |

这些状态都可交给 Agent，但必须保留“已完成检查”和“未完成检查”的区别，才能避免在多副本场景下错误自动选择。

**注意区分**：`electron-binary-unavailable`（未显式指定程序，且当前产品或平台不支持自动定位）与 `electron-binary-not-found`（检查完成但无可用候选）是两回事——前者不声称搜索过。两者都提供 Agent 提示词，但失败摘要不同（§5.3）；错误码与触发条件见 §5.5。

#### 与低侵扰的关系（§3.0）

发现流程**只在默认路径失败后启动**，所以正常情况下这三类失败的代码路径**一次都不会执行**。超时值取多小都不影响主路径用户。

---

## 4. 范围分级

**0.6.1 范围 = A + 提示词，自动定位仅 macOS。** B 已删除（现有链路够用），C 已移出（§4 各自的理由），Windows / Linux 暂不新增自动定位——但**仍提供 Agent 提示词**（§3.6）。

### A. 最小集（修掉用户的实际阻塞）

| 改动 | 文件 |
|---|---|
| `resolveWorkBuddyElectronPath()` 分层探测 + mdfind | `src/desktop-credential-protection.ts` |
| bundle id 校验（`/usr/bin/plutil`） | 同上 |
| 多候选判定（`0` 报错 / `1` 用 / `>1` ambiguous） | 同上 |
| 错误措辞改人话（§3.5） | 同上 |
| **discovery 开关构造参数 + 按 variant 拆 provider**（§3.3） | 同上 + `src/index.ts:634` |
| CLI `makeStore()` 按 variant 注入 provider，保持 CN 解密能力 | `src/bin.ts` |
| **`reasonCode` 枚举产出**（§5.5） | `src/desktop-credential-protection.ts` + `src/auth.ts` + `src/web-status.ts` |
| 单测（探测顺序、bundle id 拒绝、多候选判定、全部失败、**Global 不触发 mdfind**） | `tests/desktop-credential-protection.spec.ts` |

不动 UI、不动配置项。**大多数 #48 用户（含 `IDE/` 这类位置）的问题在此范围内被自动修掉。**

### A+ 提示词（推荐，见 §5）

在 A 基础上，对路径缺失、多副本、发现未完成、显式路径失效及 Global 未配置程序的失败态给出可复制的 Agent 提示词。

| 改动 | 文件 |
|---|---|
| 失败态的结构化呈现（说明 + 提示词 + 复制按钮） | `src/client/WorkBuddyPluginCard.tsx` + `src/client/locales.ts` |
| 失败态文案与提示词内容（中/英） | `src/client/locales.ts` |
| 状态文档能判定这个具体失败态（§5.5） | `src/web-status.ts` |

用户不用知道路径、不用写 `export`，**只需复制一句话发给 Agent**。

错误码类型、状态文档校验与 UI 块须一并更新；提示词不拼入 `reason`。

### B. 诊断可见性（**已删除，不需要**，用户 2026-09-23 定）

原方案：`electronBinary: { path, source }` + 改 doctor + 改 status schema + 改 UI。**不做。**

**理由：现有链路已经把失败信息送到卡片了，不需要为 #48 新开一条通道。**实测已确认的完整链路：

```
spawnPayload() 抛 Error
  → auth.status() 的 catch 包成 signed-out + reason   (src/auth.ts:437)
  → web-status 直接透传 reason（此分支不经过 safeMessage）
  → 卡片直接渲染 reason
```

`src/auth.ts:436` 的注释本来就写明这个设计意图：

> Reported as a status rather than thrown, because `status()` is documented never to throw and **the card renders `reason` verbatim**.

现有通路足以显示简短错误；本次仍需新增 §5.5 的 `reasonCode` 及 §5.4 的提示词 UI，但不新增独立诊断报告。

这条同时印证了 0.6.0 那次改造的价值：错误信息的表达通路是现成的，缺的只是**措辞**。

`source`（`env`/`default`/`mdfind`）这个字段因此也不必加。它唯一的价值是"给 Agent 看的技术细节"，但 §5 的提示词让 Agent **自己去定位**，不需要我们预先告知。

### C. 界面手填路径（**已确定移出 0.6.1 scope**，用户 2026-09-23 定）

原方案：配置项 + 卡片输入框 + 校验 + 持久化。**被提示词方案取代**（§5），且**不再作为 0.6.1 的候选范围**。

**移出的两条理由**：

1. **复杂度**：要动配置系统、UI、校验、持久化四条链路，而它替代的只是一个复制按钮；
2. **会把跨代兼容问题重新拉进来**（更关键，此前未识别）：DSH **0.1.7 已移除 settings 的持久化 seam**（`installSection` / `update` 被删，无替代）。现有代码是**特性检测降级**（`src/index.ts:867`）：

   ```ts
   if (typeof settingsCtx.settings.installSection !== 'function') {
     ctx.logger.warn('...host settings service has no installSection API; per-variant settings and the maximum-context preference are unavailable')
     return
   }
   ```

   也就是说 0.1.7 上**本来就没有"用户可编辑设置"这条路**，"最大上下文窗口"偏好也因此缺席。**新增一个可编辑的路径配置，等于在一个已经降级的 seam 上再叠一层跨 0.1.5/0.1.6/0.1.7 的兼容分支**——0.6.0 刚为跨代 UI 做完大量工作，不该为了一个边缘场景把这块重新搅动。

**结论**：C 移出 0.6.1。失败态一律走 §5 的提示词流程；用户确需手动指定时，`WORKBUDDY_ELECTRON_BIN` 仍是既有出口（由 Agent 按 §5.3 协助）。

---

## 5. 失败时交给 Agent：可复制提示词

### 5.1 为什么这个方案优于"界面教用户 export"

用户 issue 里说：普通用户不知道 `export` 怎么写、写在哪、还要重启 DSH 才生效。

| | C：卡片输入框 | 提示词方案 |
|---|---|---|
| 用户要做的 | 找到路径，手动粘进输入框 | **复制一句话发给 Agent** |
| 谁去找路径 | 用户自己 | **Agent 自己找** |
| 新增代码 | 配置项 + UI + 校验 + 持久化 | **一段文案 + 复制按钮** |
| 跨代兼容 | **重新引入 0.1.5/0.1.6/0.1.7 分支**（§4-C） | 无影响 |

**关键差别**：C 要求用户**先知道 App 装在哪**——而这恰恰是遇到该 bug 的用户最不知道的事（他若知道，早就设好环境变量了）。提示词方案把"找路径"也交出去，用户只需要会复制粘贴。

而且它复用了**已经存在的能力**：用户装了 DSH，本来就有一个能跑命令的 Agent。codex-connect 已验证该模式（`agentUpgradePrompt` + 复制按钮）。

**成本对比**：C 要动配置系统、UI、持久化、校验四条链路（并重新触及 0.1.7 缺失的 settings seam），提示词只加文案 + 一个复制按钮。

### 5.2 草稿的陷阱：不要在提示词里写死 `WORKBUDDY_ELECTRON_BIN`

用户给的草稿：

> 请帮我找到本机 WorkBuddy.app 的实际安装位置，并为 dsh-workbuddy-connect 配置 WORKBUDDY_ELECTRON_BIN。

**「配置 `WORKBUDDY_ELECTRON_BIN`」在 DSH 里是个坑**：

- 环境变量必须在**启动 `dsh web` 的那个 shell** 里设置才生效——Agent 在会话里 `export` **够不到**宿主进程；
- Agent 很可能改 `~/.zshrc`，但**当前 DSH 进程不会重新读取**，用户会以为改了没用；
- 更糟：Agent 可能写入全局 rc，影响其他程序。

**这正是 issue 里用户抱怨的点**（"该变量必须写在 `dsh web` 启动命令前才生效"）。提示词不该把用户推进同一个坑。

### 5.3 按产品和失败原因生成提示词

**中文模板**（`{appName}` 由卡片 variant 提供，国内版为 WorkBuddy，国际版为 WorkBuddy AI；`{failureSummary}` 由已知错误码对应的本地化文案提供）：

> DSH 的 dsh-workbuddy-connect 无法使用我的 {appName}：{failureSummary}。请帮我检查实际安装位置和已有路径配置，让插件能正确使用它，并验证恢复结果；如果需要修改 DSH 的启动环境或重启，请给我明确的操作步骤，不要只在当前 shell 临时设置环境变量。

**英文模板**：

> DSH's dsh-workbuddy-connect cannot use my {appName}: {failureSummary}. Please check the actual installation location and any existing path configuration, help the plugin use it correctly, and verify recovery. If the DSH launch environment must be changed or DSH restarted, give me clear steps; do not only set an environment variable temporarily in the current shell.

失败摘要分别说明：未找到可用程序、发现多个副本无法选择、自动定位未完成、已有显式路径不可用、尚未配置该产品的解密程序。不得推断“安装位置非标准”。Agent 应根据实际 DSH 启动方式协助完成配置、重启和验证；插件本身不执行这些修复。

**为什么这个措辞是对的**：

1. **不写死手段**——不点名 `WORKBUDDY_ELECTRON_BIN`，让 Agent 按实际情况选（将来我们自己的实现变了，提示词不用改）；
2. **最后一句是关键补强**：`不要只在当前 shell 临时设置环境变量`。这一句直接堵住 §5.2 说的那个坑——Agent 在会话里 `export` 够不到宿主 `dsh web` 进程，用户会以为改了没用。**这是用户加的一句，比原稿更准，勿删。**
3. **要求给"明确的操作步骤"**——把"该怎么做"的说明责任交给 Agent，而不是让用户自己推断。

**约束（实现时必须满足）**：这段文字是**用户提示词**，不是承诺。它要求 Agent 去做的事（修改启动环境、重启）由 Agent 与用户协商执行，插件本身不据此改变任何行为。

中英文模板均保留“临时设置当前 shell 不足以修复宿主环境”的要求。

### 5.4 呈现方式（已确定：独立 UI 块 + 复制给 Agent + 重新检查）

现状：web-status 的 signed-out 分支直接透传 reason，卡片显示原文；该分支未调用 safeMessage。新增错误必须在产生时控制内容，不能依赖不存在的下游脱敏。

**采用用户提供的 Codex Connect 截图中的交互形式**：在对应产品卡片的失败态中，独立展示协助区域。截图只作为布局与交互参考，此处处理的是应用定位故障，不引入版本更新信息、发布说明或升级检查。

从上到下依次呈现：

1. **失败说明**：沿用 `reason` 的简短诊断；不将长提示词拼进 `reason`，也不重复显示同一条错误。
2. **标题「让 Agent 帮你处理」**；说明「把下面这段请求发给你的 Agent，它会协助检查应用位置和启动配置。」
3. **提示词区域**：使用 §5.3 的完整文本，按当前产品和错误原因生成；浅色/深色主题均使用现有卡片样式与主题变量。文本可选中、自动换行，旁边放置 **「复制给 Agent」** 按钮；窄屏时按钮排到文本下方。
4. **完成后的指引**：「Agent 处理完成后，回到这里重新检查；如果修改了 DSH 的启动环境，请先按指引重启 DSH。」
5. **「已处理，重新检查」按钮**：复用现有 `manualRefresh()` 读取当前状态的逻辑。在此失败态内替代同用途的刷新操作，避免同时出现两个等价按钮。

**按钮行为与结果**：

- 「复制给 Agent」只复制可见的完整提示词，不自动发消息或启动 Agent。成功后反馈「已复制」；失败时提示「复制失败，请手动选择上方文字复制」，保持文本可选中。反馈应可由辅助技术读出。
- 「已处理，重新检查」点击后显示「检查中…」，请求结束前禁用以避免重复提交。它只重新读取宿主状态，不设置环境变量，也不自动重启。
- 返回 `signed-in` 才移除协助区域并显示正常账号卡片；仍为路径错误时更新说明和提示词；变为其他错误时按现有对应错误显示。网络请求失败时保留原提示词并显示读取失败，不能将点击按钮视为修复成功。
- 此检查确认凭据已可用，不代表实际模型对话已经验证成功。
- 仅在 §5.5 列出的错误码下显示此区域；国内版和国际版各显示自己的产品名。中英文同步提供标题、说明、按钮与反馈文案。

### 5.5 失败态标记：定 `reasonCode`（用户 2026-09-23 定，勿留给实现自由发挥）

**不要解析 `reason` 字符串。** 现有 `reason` 是自由文本（`status-paths.ts:192` 的 `reason?: string`），拿它做字符串匹配既脆又会被措辞改动打破。**必须用结构化字段。**

**定下来的字段**：在 `signed-out` 分支上新增一个**封闭枚举**字段

```ts
{
  status: 'signed-out'
  reason?: string          // 现有：自由文本，给人看，原样渲染
  reasonCode?: WorkBuddySignedOutReasonCode   // 新增：给程序判定，封闭枚举
}

type WorkBuddySignedOutReasonCode =
  | 'no-credential'            // 没有可用凭据（就是"没人登录"）
  | 'credential-region-mismatch' // 凭据属于另一个 product（#43 类）
  | 'encrypted-credential-unreadable' // 加密凭据存在但解不开（keyId 不匹配 / GCM 失败 / helper 崩溃）
  | 'electron-binary-not-found'       // CN/macOS：检查完成，无可用候选
  | 'electron-binary-ambiguous'       // ← 仅 CN：找到多个（§3.4）→ 给提示词
  | 'electron-binary-unavailable'     // 无自动定位能力且未指定路径，包括 Global 与非 macOS
  | 'electron-path-invalid'          // options/env 显式路径不存在或不可执行；不回落
  | 'electron-discovery-incomplete'  // 工具失败、超时或候选检查未完成；不自动选择
```

**提示词的触发条件（精确定义）**：`status === 'signed-out' && reasonCode` ∈ `{ 'electron-binary-not-found', 'electron-binary-ambiguous', 'electron-binary-unavailable', 'electron-path-invalid', 'electron-discovery-incomplete' }`。产品名来自 variant，不能从错误码推断 CN/Global。

**路径错误的分类与处理**：

| code | 谁产出 | 含义 | 给提示词 |
|---|---|---|---|
| `electron-binary-not-found` | **仅 CN/macOS** | 默认路径没有，检查完成后无可用候选 | ✅ |
| `electron-binary-ambiguous` | **仅 CN/macOS** | 找到多个（§3.4） | ✅ |
| `electron-binary-unavailable` | Global，或**不支持自动定位的平台**（Windows/Linux） | 未指定解密程序；**不声称执行过搜索** | ✅ |
| `electron-path-invalid` | 任一 variant 的显式路径检查 | 指定路径不可用，不回落 | ✅ |
| `electron-discovery-incomplete` | CN/macOS 发现流程 | 检查未完成，不能判断唯一候选 | ✅ |

**统一规则：是否支持自动定位，与是否提供 Agent 提示词，是两件独立的事。**

- **自动定位能力**只由平台 + 产品决定：目前仅 **CN/macOS** 具备（§3.6 明确 Windows/Linux 不新增发现机制）；
- **Agent 提示词**则**对所有"缺少可用解密程序"的失败态都提供**——包括**不支持自动定位的平台**。

| 产品/平台 | 自动定位 | Agent 提示词 |
|---|---|---|
| CN / macOS | ✅（默认路径 → mdfind） | ✅ 有帮助（提示词可让 Agent 处理非标准安装） |
| Global / macOS | ❌（`discovery: 'none'`） | ✅ 有帮助（Agent 可定位 WorkBuddy AI 并配置启动环境） |
| CN / Windows/Linux | ❌（§3.6 不做） | ✅ 有帮助（Agent 可协助定位并配置 `WORKBUDDY_ELECTRON_BIN` 的实际启动环境） |

**为什么"不支持自动定位"仍要给提示词**：提示词解决的不是"我们没搜"，而是"**用户不知道怎么把路径配到宿主启动环境里**"。这个困难与平台无关——尤其"不要只在当前 shell 临时 export"那个坑是**跨平台**的（§5.2）。

**Global 与非 macOS 的失败摘要**：都用 `electron-binary-unavailable`，但摘要各自表述——Global 说"未配置 WorkBuddy AI 的解密程序"，Windows/Linux 说"当前平台需手动指定解密程序"。**两者都不得描述成"已经搜索但未找到"**（我们确实没搜）。产品名一律来自 variant，**不从错误码推断 CN/Global**。

**`encrypted-credential-unreadable` 要与上述路径类错误分开**：加密凭据解不开有很多原因（keyId 不匹配、GCM 校验失败、helper 崩溃），**这些都不该给"去找 App"的提示词**——找 App 解决不了。

**实现要求**：

1. **`reasonCode` 由 host 侧产出**，不由卡片推断——错误在哪发生，就在哪打标（`desktop-credential-protection.ts` 抛的错 → `auth.ts` 归类 → `web-status.ts` 透传）；
2. **不要在卡片里比对 `reason` 文本**；
3. **`status-document.ts` 的校验要认识这个字段**（现有只校验 `status` 与 `message`，见 `src/client/status-document.ts:20`）；
4. **`reasonCode` 缺失时的行为**：卡片不显示提示词（向后兼容——旧 host 没有这个字段，卡片照旧渲染 `reason` 文本）。

**注意与现有 `reason` 的关系**：两者**并存**，不是替代。`reason` 继续做"给人看的说明"（卡片第 1154-1155 行原样渲染），`reasonCode` 只做"给程序判定"。**保留现有渲染路径不变**，这也是 §4-B 被删掉的原因——我们不需要新通道，只需要一个判定标记。

### 5.6 待办

中英文模板见 §5.3。实现时仍需补齐：

- **错误摘要与复制反馈的中英文 locale**——模板和错误摘要分别测试；
- **是否顺带给出 `mdfind` 命令作为线索**（倾向不给：提示词是给 Agent 的，Agent 自己能查，写死命令反而限制它）；
- **长度**——当前长度适中，不再加长。

---

## 6. 待拍板点

| # | 问题 | 状态 |
|---|---|---|
| 1 | 范围 | **A + 提示词，自动定位仅 macOS**（§4）；B 已删除、C 已移出、Win/Linux 不新增自动定位但给提示词 |
| 2 | `~/Applications` 要不要静态候选 | **已定：不加**（§3.0，属"猜位置"，mdfind 覆盖更全） |
| 3 | Windows / Linux 是否处理 | **已定：不新增自动定位，但仍提供 Agent 提示词**（§3.6） |
| 4 | 国际版 bundle id 是否支持 | **已定：不支持**——本次只查 `com.tencent.workbuddy.mac`（§3.3） |
| 5 | 多候选怎么选 | **已定：不猜，`>1` 明确报错并列出候选**（§3.4） |
| 6 | 提示词措辞 | 按产品和失败原因生成，保留临时 export 补强句（§5.3） |
| 7 | 提示词呈现 | **已定：独立 UI 块 +「复制给 Agent」+「已处理，重新检查」**（§5.4，参考用户提供的截图） |
| 8 | 失败态标记字段的形态 | **已定：`reasonCode` 封闭枚举（§5.5）** |

呈现方式已确定，按 §5.4 实现；提示词按 §5.3 区分产品与实际失败原因。

---

## 6.1 低侵扰原则的具体含义（供实现时对照）

用户 2026-09-23 定：**默认路径保留，识别失败时才发动各种措施。**

实现时必须满足：

- ✅ 默认路径（`/Applications/WorkBuddy.app/...`）**代码不动、顺序不动、行为不动**；
- ✅ mdfind **仅在前序候选全部失败后**触发，成功路径零额外进程调用、零额外延迟；
- ✅ **不新增静态候选路径**（不做 `~/Applications`、不做目录遍历）；
- ✅ 提示词与诊断信息**只在失败态出现**，主路径用户不可见；
- ❌ 不做：启动时预扫描、后台预热、对正常用户的任何额外检查。

---

## 7. 测试计划

- **显式配置是 authoritative（新增，钉死 §3.1 契约）**：
  - `options.electronPath` 指向不存在的路径 → 抛错，**且不得回落**到 env / 默认 / mdfind（断言 mdfind 未被调用）；
  - `WORKBUDDY_ELECTRON_BIN` 指向不存在的路径 → 抛错，**且不得回落**到默认 / mdfind；
  - 这是**新增行为**吗？不是——现有实现已经是"选中即用、失败即抛"，这些用例是把既有契约**显式钉住**，防止本次改动把它变成"逐层命中"。
- **默认路径失败才 mdfind**：默认路径存在时不调用 mdfind（断言未调用，体现 §3.0 低侵扰）。
- **bundle id 拒绝**：mdfind 返回一个 id 不匹配的 `.app` → 必须拒绝，不得 spawn。
- **多候选判定**：`0` → 报错；`1` → 使用；`>1` → ambiguous 报错并列出候选。**不测"择优"**（§3.4 已删除该算法）。
- **Global 隔离守卫（新增，钉死 §3.3）**：Global provider（`discovery: 'none'`）在默认路径失败时**不得调用 mdfind**（断言未被调用），且**不得拿到 CN 默认路径**（`helperPath()` 为 undefined，除非显式 env/选项）。
- **无参构造默认安全**：`new WorkBuddyAtRestKeyProvider()` 应为 `discovery: 'none'`（`src/auth.ts:321` 的兜底因此不会误跑 CN 二进制）；现有 spec:266-270 的期望需随之改为显式传参。
- **构造期零 I/O（钉死 §3.0 低侵扰）**：构造 provider 时**不得**调用 mdfind / plutil（断言未调用）——discovery 只在 `spawnPayload()` 内、默认路径失败后才触发；构造函数是同步的，异步发现不能放进去。
- **失败不缓存，可自愈**：discovery 失败后，**下一次 `protectorKeyFor()` 要重新尝试**（第二次调用 mdfind）；成功后才缓存（第二次不再调用）。这条对应"用户装好 App 后无需重启 DSH"。
- **去重**：同一 `.app` 的多个路径别名（如 `/System/Volumes/Data/...`）→ 收敛为 1，不判 ambiguous。
- **无可用候选与检查未完成**：分别产出 not-found 和 incomplete，均不得断言“未安装”。
- **发现流程的边界（钉死 §3.7）**：
  - mdfind 超时 / 输出超限 / 不可用 → `electron-discovery-incomplete`，不执行 helper；
  - A 候选合法、B 候选 plutil 超时 → incomplete，不得把 A 当唯一候选执行；
  - plutil 明确返回其他 bundle id → 排除；全部检查完成后才判断候选数量；
  - 多候选检查的累计耗时不得超过发现总预算；可选版本号查询也在预算内；
  - **断言发现流程用的是自己的超时**，不是 helper 的 `timeoutMs`（可用不同值注入来区分）。
- **Global 的失败不归入"没找到"**：`discovery: 'none'` 产出 `electron-binary-unavailable`，**不得**产出 `electron-binary-not-found`（§5.5 / §3.6）。
- **回归**：现有 `desktop-credential-protection.spec.ts` 的 env / options 优先级用例**不得改动**（钉死既有契约）。
- **不新增真实进程调用**：`mdfind` 与 `/usr/bin/plutil` 走注入 seam，测试不发真实子进程。
- **CLI 回归**：CN 加密凭据分别经宿主和 `doctor/status` 入口验证；标准路径可用和默认路径失效后的发现均覆盖。Global 的 CLI 仍不尝试 CN 默认路径。
- **缓存失效**：成功发现后移动 App，下一次需要 helper 时旧缓存被清除并重新解析；显式路径失效仍不回落。
- **恢复闭环**：宿主凭据检查在失败后重试并恢复模型列表；卡片在手动刷新后消除旧错误，不要求失败态自动轮询。
- **错误码与提示词闭环**：错误从 provider 经 auth/status 到卡片保持 code；五类路径错误显示对应提示词，Global 明确写 WorkBuddy AI，显式路径错误不声称查过索引；解密错误、缺失或未知 code 保留原 reason，不显示路径提示词。验证复制成功及失败反馈。
- **"不支持自动定位"仍给提示词（钉死 §5.5 统一规则）**：`discovery: 'none'` 与**非 macOS** 都产出 `electron-binary-unavailable` 且**都渲染提示词**——断言这两条路径确实显示协助区域（防止实现者把"没有自动定位"误当成"不给提示词"）。
- **提示词不声称搜索过**：`unavailable` 路径的失败摘要**不得**包含"已搜索/已查找/未找到"类表述（我们确实没搜）；断言文案与 `not-found` 的摘要不同。

---

## 8. 风险

| 风险 | 缓解 |
|---|---|
| 误执行非 WorkBuddy 二进制 | §3.2 bundle id 硬校验 |
| Spotlight 索引关闭 → mdfind 空 | 不作为"未安装"上报；错误信息给两条指引 |
| mdfind / plutil 阻塞或挂起 | **发现流程自带超时与输出上限**（§3.7），**不依赖** helper 的 10s timeout——该 timeout 只包住 `execFile(electronPath,...)`（`src/desktop-credential-protection.ts:403`），覆盖不到发现阶段 |
| 多副本存在 | **不选择，明确报 ambiguous**（§3.4） |
| 非 macOS 平台行为变化 | 明确不动，README 如实说明 |

---

## 9. 发布口径（0.6.1）

- 与 #45/#47 同批，版本号 0.6.1。

### 9.1 当前真实验证状态：**只验了 mdfind 命令本身**

**必须写准，不要拔高**（用户 2026-09-23 纠正）：

| 环节 | 是否验证 |
|---|---|
| `/usr/bin/mdfind "kMDItemCFBundleIdentifier == 'com.tencent.workbuddy.mac'"` 能返回路径 | ✅ 本机实测（§2） |
| **我们代码里的完整发现链路** | ❌ **未验证** |
| bundle id 校验（plutil） | ❌ 未验证 |
| X_OK / helper spawn | ❌ 未验证 |

**为什么"标准安装位置"证明不了链路**：本机 `/Applications/WorkBuddy.app` **存在**，所以按 §3.1 的流程**根本不会进入 mdfind**（第 ④ 步 `accessSync` 就返回了）。也就是说，**到目前为止没有任何一次真实运行触达过 discovery 分支**。

**原稿曾写"自动发现机制已在标准安装位置验证"——这句不成立，已删除。**

### 9.2 发布前必须补：强制走 fallback 的端到端验证

0.6.1 发布前应做**一次**强制 fallback 的端到端验证，覆盖完整链路：

```
mdfind → 去重 → /usr/bin/plutil bundle id 校验 → X_OK → helper spawn → 拿到 key
```

**做法（二选一，倾向 A）**：

- **A. 注入"默认路径不存在"，其余全真**：在集成测试/临时脚本里令默认路径解析失败（走 `options.electronPath` 之外的注入点或临时改常量），**mdfind / plutil / accessSync / execFile 全部使用真实实现**。这样真实触达 discovery，且**不动用户的 App**。
- **B. 真机临时改名**：把 `/Applications/WorkBuddy.app` 临时移开再跑。**不推荐**——会中断用户正在运行的 WorkBuddy，且 App 被移动时其凭据链路本身可能受影响，验证结果不干净。

**验证必须确认的点**：

1. discovery 真的被触达（而非又一次走了默认路径）——需有可观察证据（日志/断言）；
2. plutil 返回 `com.tencent.workbuddy.mac` 且校验通过；
3. helper 真的以该二进制 spawn 并**成功取到 key**（这是端到端的终点，只到 X_OK 不算）；
4. 默认路径存在时**不**触发 discovery（低侵扰反向断言，§3.0）。

**未完成前，Release notes 不得声称自动发现"已验证/可用"。** 可写的上限是"新增了 macOS 自动发现（待实测反馈）"。

### 9.3 与 reporter 的分工

- #48 reporter 提供的是**真实非标准位置**场景（`/Applications/IDE/WorkBuddy.app`），**待 0.6.1 candidate 由他回归确认**才是该场景的闭环；
- 我们的 9.2 端到端验证证明的是**链路本身可跑通**（在受控条件下）；
- **两者不可互相替代**：9.2 不覆盖"真机非标准安装"的多样性，reporter 回归也不覆盖"代码链路是否完整"。

### 9.4 其他

- 回复 #48 时按 §1 的表格更正归类（不是"#43 的遗漏"），并说明 bundle id 校验已按要求加上（他自己提的风险点）。

---

## 10. 本方案未做的事

- 未改任何代码（本文档为唯一产出）。
- **未做任何真实运行验证**——只手工跑过 mdfind 命令本身；代码链路、plutil 校验、helper spawn 均未验证（§9.1）。9.2 的端到端验证**待实现完成后进行**。
- **本版本不实现界面路径输入框**；如未来需要，再单独设计。
