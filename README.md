<p align="center">
  <h1 align="center">dsh-workbuddy-bridge</h1>
</p>

<div align="center">
  <p><strong>把 WorkBuddy 桌面 App 的模型接进 DSH 对话窗口</strong></p>
  <p><em>WorkBuddy desktop models in DeepSeek Harness</em></p>

  <p>
    <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4176E6?style=flat" alt="DeepSeek Harness Plugin"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT 许可证"></a>
  </p>

  <p>
    <strong><a href="README.md">简体中文</a></strong> · <a href="README_en.md">English</a>
  </p>
</div>

---

> [!NOTE]
> **凭据不出本机**：登录状态取自 WorkBuddy 桌面 App 自己的凭据文件，插件只在本机留一份加密副本；
> 浏览器半边拿不到令牌，界面里也永远不出现凭据原文。

国内版 **WorkBuddy** 与国际版 **WorkBuddy AI** 并存：装哪个就出现哪个模型分组，两个都装就两组并排，
各自用自己的账号与积分。模型直接出现在 DSH 的模型选择器里，不必为它单独配一个 provider。

<p align="center">
  <img src="assets/1.png" alt="WorkBuddy 模型出现在 DSH 模型选择器中" width="430">
  <img src="assets/5.png" alt="WorkBuddy AI 模型出现在 DSH 模型选择器中" width="430">
  <br>
  <em>国内版与国际版各成一个分组，与 DSH 自带的分组并排；只装一版就只出现那一组。</em>
</p>

## 能力

- **开箱即用**：装完启用，模型分组自己出现，没有必填项。
- **两版互不串号**：国内版是「WorkBuddy」分组、国际版是「WorkBuddy AI」分组，模型、账号与积分互不混用；
  **各自只跟随自己那版 App 的登录状态** —— 退出其中一版，对应分组消失，另一版不受影响。
- **图片输入**：多数模型可直接粘贴或拖入图片（GLM-5.3-Flash、GLM-5.2、DeepSeek-V4 系列等）；
  少数纯文字模型（如 GLM-5.1）会明确说明不支持。
- **推理档位**：上游声明了档位的模型直接可选（如 GLM-5.3 / GLM-5.3-Flash 的 low / high / max）；
  没声明的模型可在 Web 与 Desktop 上**手动检测**（见[为什么是手动检测](#为什么是手动检测)）。
  未检测或没有可用档位的模型继续用 WorkBuddy 的默认档位。
- **模型显隐**：卡片的「上下文窗口」标签里勾选哪些模型出现在选择器里；**按登录账号分别保存**，
  切换账号自动切换各自的配置。隐藏只影响可选择性，**已在用该模型的会话照常继续**。
- **账号与积分**：插件页里看账号、令牌有效期（自动续期）、剩余积分与模型优惠，可手动刷新模型列表，
  并看到当前列表来自上游还是内置兜底。
- **费率与促销**：模型名后直接跟积分倍率（如 `GLM-5.2 · x0.79`）与促销徽章（限时免费 / 夜间折扣），
  `/model` 弹窗与输入框下拉都能看到。倍率只是显示，不影响请求。
- **企业账号**：国内版企业账号走企业专用计费接口读周期额度，卡片显示「企业额度」与周期重置时间。
- **三种界面**：Web / Desktop / TUI 都能跑；只有 TUI 不提供手动检测。
- **插件页里以显示名出现**：`DSH WorkBuddy Bridge`（中英界面同名），标题下面另有一行代码体写着包名
  `dsh-workbuddy-bridge` —— 两处都要能对上，才不会在插件列表里认错。

## 安装

### 前置

- 已安装并登录 **WorkBuddy 桌面 App**（国际版为 WorkBuddy AI App）。插件复用 App 的登录状态，
  账号切换自动跟随；两版互不影响。
- DSH 的版本范围以 [package.json](package.json) 的 `engines` 与 `peerDependencies` 为准 —— 本仓只跟 **DSH `0.1.7` 线**。
- Node 22+（同上，真源是 `engines.node`）。

### 从 npm 安装

```sh
dsh plugin --profile web add dsh-workbuddy-bridge
dsh web
```

### 从源码安装

```sh
git clone https://github.com/zlZayn/dsh-workbuddy-bridge.git
cd dsh-workbuddy-bridge
pnpm install && pnpm build

dsh plugin --profile web add "$PWD"
dsh web
```

### 三种界面

```sh
# Desktop（DSH Desktop 桌面版）
dsh plugin --profile desktop add dsh-workbuddy-bridge
dsh --profile desktop
```

```sh
# TUI（终端界面）
dsh plugin --profile dsh-tui add dsh-workbuddy-bridge
dsh --profile dsh-tui
```

> **TUI 的版本搭配**：终端界面插件 `@deepseek-harness-tui/dsh-tui` 需 **`0.10.0-beta.5` 及以上** ——
> 更早的版本装了本插件会启动失败，报 `events is not iterable`。先用 TUI 自带的方式把壳升上去，再装本插件。

> **TUI 的 pnpm**：`dsh-tui` profile 需用 pnpm 11 安装（PATH 里是其他版本会报 `ERR_PNPM_UNEXPECTED_STORE`，
> 用 `npx pnpm@11` 即可）。

### 发现与安装

- **GitHub**：[`zlZayn/dsh-workbuddy-bridge`](https://github.com/zlZayn/dsh-workbuddy-bridge)
- 仓库带 GitHub topic `dsh-plugin`，插件市场据此自动发现。

## 版本兼容

- 本仓（`0.1.0` 起）只支持 **DSH `0.1.7` 线**，实测在 `0.1.7-rc.2` 上通过；下限见 [package.json](package.json) 的 `engines.dsh`，本文不重抄。
- 本仓是 [`dsh-workbuddy-connect`](https://github.com/corrinehu/dsh-workbuddy-connect) 的重做版本：
  **包名不同、版本线也不同** —— 旧线的 `0.2.x`–`0.7.x` 发布在旧包名下，本仓不再发布那些号。
  仍在更早 DSH 核心上的用户，请留在旧包名那条线。
- 本仓**不查宿主版本号**：它按宿主声明的契约注册（槽、服务、配置接缝），没有防御性包装；
  接缝缺席时对应功能静默不出现，不会拖垮界面。

## 配置

侧边栏 **插件（Plugins）** →「已安装（Installed）」→ 点插件名进详情页 ——
**配置区就在描述下面，直接可改**，那一行上没有第二个 Configure 步骤：

- **配置表单**：`authFile`（国内版登录文件路径）、`authFileAI`（国际版）、**允许推理档位检测**、
  **使用上游声明的最大上下文窗口**。前两项留空即用 App 自己的位置。
- **两张卡片**：国内版与国际版各一张，各显示自己账号的信息；展开后分「状态 / 上下文窗口 / 明细」三个标签。
  - **状态**：账号、令牌有效期、合计积分、模型列表来源、推理档位检测入口。
  - **上下文窗口**：各模型的窗口与**模型显隐**勾选。
  - **明细**：各套餐余量与模型优惠。

<p align="center">
  <img src="assets/6.png" alt="插件配置页：配置表单与上下文窗口里的模型显隐" width="480">
  <br>
  <em>配置表单与两张卡片上下排列；「上下文窗口」标签里勾选哪些模型出现在选择器里。</em>
</p>

<p align="center">
  <img src="assets/2.png" alt="卡片展开后的三个标签" width="420">
  <img src="assets/3.png" alt="卡片显示账号与剩余积分" width="420">
  <br>
  <em>卡片展开分三个标签：状态（账号、令牌、合计积分、目录来源）、上下文窗口、明细（套餐余量与优惠）。</em>
</p>

保存即生效。**配置改动不需要重启宿主**（配置是 volatile 引用）；**改了插件代码才需要**。

> 设置弹窗里的「内置插件」页是**只读清单**（名称与运行状态），没有配置入口 —— 别在那里找配置。

## 为什么是手动检测

WorkBuddy 的推理档位信息分散在上游接口与客户端私有 UI 逻辑里，且模型目录变化很快。
若插件按经验给所有未声明模型补齐一套统一档位，就得持续追赶没有稳定契约的未公开逻辑。

实测还发现：有些模型**接受** `reasoning_effort` 却忽略未知值、回退到默认行为 ——
一次请求成功并不能证明某个档位真的可用。

<p align="center">
  <img src="assets/4.png" alt="输入框模型选择器旁的「推理等级」检测控件" width="620">
  <br>
  <em>检测控件就在模型选择器旁；结果显示在模型下拉里，也回写到卡片上。</em>
</p>

所以对没有声明档位的模型，Web 与 Desktop 改为**先授权、再按需检测**：先确认上游会校验这个参数，
再逐项确认哪些规范档位被接受。检测会发送少量请求、可能消耗积分；结果只表示**上游当前接受该档位**，
不承诺它改变推理效果、速度或积分消耗。

## 命令行

```sh
dsh plugin --profile <web|desktop|dsh-tui> exec dsh-workbuddy-bridge status
```

登录状态与剩余积分；`--json` 输出机器可读格式，另有 `doctor`（诊断）与 `logout`（清理凭据）。

默认操作国内版，加 `--provider workbuddy-ai` 操作国际版：

```sh
dsh plugin --profile web exec dsh-workbuddy-bridge status --provider workbuddy-ai
dsh plugin --profile web exec dsh-workbuddy-bridge doctor --provider workbuddy-ai
```

`logout` 只删除该版插件自留的凭据副本，不动桌面 App 自己的登录，也不承诺模型分组一定消失
（App 的凭据文件仍在时依然生效）。

## 安全与边界

- **凭据只在本机**：从 App 的凭据文件读出后，插件自留一份**静态加密**的副本；
  浏览器半边永远拿不到令牌、文件路径或平台事实。
- **界面里不出现凭据原文**：卡片只报账号与状态。
- **只访问 WorkBuddy 自己的接口**，不代理、不转发其他流量。
- 依赖的是 **WorkBuddy 客户端接口（非公开 API）**，上游改动可能使其失效；届时按
  「本账号上次成功目录 → 内置目录」降级，并在卡片上标明来源与失败原因。

## 已知限制

- 在 macOS 的 DSH Web / Desktop / TUI 下验证通过。Windows 依次探测 Local 与 Roaming AppData；
  WSL 优先从挂载的 Windows 用户目录读取登录凭据。Windows 与 Linux 用户名不同、且 Windows 环境变量
  未传入 WSL 时，用 `WORKBUDDY_AUTH_FILE`（国际版 `WORKBUDDY_AI_AUTH_FILE`）指定实际位置。
- **国际版的模型目录来自 App 界面接口**：服务端按 User-Agent 分流，属私有实现，改动可能使其失效；
  国内版走官方 CLI 同款接口，不受此影响。
- **国际版仍未覆盖的环境**：Windows / WSL / Linux 下国际版 App 的版本读取尚未找到可靠来源，
  会退回最近保存的版本或内置值。
- **无凭据时的行为**：某版 App 从未登录、也没留下插件自留副本时，该版模型分组不再显示
  （此前国内版会显示一份内置兜底列表，但那些模型选了必然报错）。
- **企业账号积分目前仅覆盖国内版**：国际版企业计费接口尚未验证，仍按个人版接口读取。
- 手动检测只在 Web 与 Desktop 提供，TUI 没有。

## 免责声明

- 本项目**仅供个人学习和研究使用**，仅驱动使用者自己的 WorkBuddy 账号在本机调用，请勿用于商业用途或超出个人合理使用的场景。
- 使用者需遵守 WorkBuddy 的服务条款；因使用本项目产生的任何后果（包括但不限于账号被限制、额度被清空、服务中断），由使用者自行承担。
- 本项目作者不对任何因使用或滥用本项目产生的直接或间接损失负责。
- 本项目与腾讯、WorkBuddy、DeepSeek 均无关联，未获其授权或认可；文中出现的名称仅用于描述兼容关系，其商标权利归各自所有。

## 致谢

- [Sliverkiss/workbuddy2api](https://github.com/Sliverkiss/workbuddy2api)（MIT）— WorkBuddy 上游协议的参照实现。
- [franksong2702/dsh-codex-connect](https://github.com/franksong2702/dsh-codex-connect)（Apache-2.0）— DSH 插件结构与 provider 注册的参照。

## 许可

[MIT](LICENSE)。

## 贡献

报缺陷请附 DSH 版本、插件版本与复现步骤；提功能前先翻 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 看设计取舍。

设计取向 → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)；发布流程与版本号判定 → [docs/PUBLISHING.md](docs/PUBLISHING.md)；
维护者文档地图 → [AGENTS.md](AGENTS.md)。
