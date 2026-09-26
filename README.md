<p align="center">
  <img src="icon.svg" alt="dsh-workbuddy-bridge" width="80" height="80">
</p>

<p align="center">
  <h1 align="center">dsh-workbuddy-bridge</h1>
</p>

<div align="center">
  <p><strong>把 WorkBuddy 桌面 App 的模型接进 DSH 对话窗口</strong></p>
  <p><em>WorkBuddy desktop models in DeepSeek Harness</em></p>

  <p>
    <a href="https://www.npmjs.com/package/dsh-workbuddy-bridge"><img src="https://img.shields.io/npm/v/dsh-workbuddy-bridge?style=flat" alt="npm"></a>
    <a href="https://github.com/zlZayn/dsh-workbuddy-bridge/actions/workflows/ci.yml"><img src="https://github.com/zlZayn/dsh-workbuddy-bridge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
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

国内版 **WorkBuddy** 与国际版 **WorkBuddy AI** 并存：装哪个 App 就出现哪个模型分组，两个都装就两组并排，
各自用自己的账号与积分。模型直接出现在 DSH 的模型选择器里，不必为它单独配一个 provider。

<p align="center">
  <img src="assets/1.png" alt="WorkBuddy 模型出现在 DSH 模型选择器中" width="300">
  <br>
  <em>国内版在模型选择器中自成一组，模型名后直接跟积分倍率与促销徽章；装国际版则出现「WorkBuddy AI」组。</em>
</p>

## 它能做什么

- **开箱即用** —— 装完启用，模型分组自己出现，没有必填项。
- **两版互不串号** —— 国内版是「WorkBuddy」分组、国际版是「WorkBuddy AI」分组；模型、账号与积分互不混用，
  各自只跟随自己那版 App 的登录状态。退出其中一版，对应分组消失，另一版不受影响。
- **推理档位** —— 上游声明了档位的模型直接可选；没声明的模型可以在插件页里**手动检测**
  （见[为什么是手动检测](#为什么是手动检测)）。未检测或没有可用档位的模型继续用 WorkBuddy 的默认档位。
- **模型显隐** —— 卡片的「模型」标签里勾选哪些模型出现在选择器里，按登录账号分别保存；
  隐藏只影响可选择性，已在用该模型的会话照常继续。
- **积分与账户** —— 插件页里看登录账号、剩余积分、各套餐余量，并可手动刷新模型列表。
- **图片输入** —— 多数模型可直接粘贴或拖入图片；少数纯文字模型会明确说明不支持。
- **三种界面** —— Web / Desktop / TUI 都能跑；只有 TUI 不提供手动检测。

<p align="center">
  <img src="assets/2.png" alt="插件详情页：配置表单与两张状态卡片" width="560">
  <br>
  <em>插件页里的样子：上面是配置表单，下面两张卡片各跟随自己 App 的登录状态。</em>
</p>

## 安装

前置只有一条：已安装并登录 **WorkBuddy 桌面 App**（国际版为 WorkBuddy AI App）—— 插件复用 App 的登录状态，
账号切换自动跟随。

```sh
dsh plugin --profile web add dsh-workbuddy-bridge
dsh web
```

Desktop 与 TUI 把 `--profile web` 换成 `desktop` / `dsh-tui` 即可（TUI 需终端插件
`@deepseek-harness-tui/dsh-tui` ≥ `0.10.0-beta.5`，且用 pnpm 11 安装，详见其文档）。

也可以从源码安装：

```sh
git clone https://github.com/zlZayn/dsh-workbuddy-bridge.git
cd dsh-workbuddy-bridge
pnpm install && pnpm build
dsh plugin --profile web add "$PWD"
```

## 插件页

侧边栏 **插件（Plugins）** → 已安装 → 点 **DSH WorkBuddy Bridge** 进详情页。配置区就在描述下面，直接可改，保存即生效：

- **登录文件路径**（国内版 / 国际版）—— 留空即用 App 自己的位置，一般不用填。
- **允许推理档位检测**、**使用上游声明的最大上下文窗口** —— 两个开关，默认够用。

配置改动立即生效，不需要重启；卡片上的实时状态（账号、积分、模型列表）则来自下面的两张卡。

<p align="center">
  <img src="assets/6.png" alt="模型标签：显隐、窗口、倍率" width="300">
  <img src="assets/7.png" alt="检测标签：推理档位检测" width="300">
  <br>
  <em>展开「WorkBuddy（国内版）」卡片：左「模型」标签管理显隐、看窗口与倍率；右「检测」标签一模型一行，点「开始检测」确认它接受哪些推理档位，结果也回写到模型选择器里。</em>
</p>

<p align="center">
  <img src="assets/3.png" alt="积分标签：合计与套餐余量" width="640">
  <br>
  <em>「积分」标签：合计一行，下面是各套餐余量条。</em>
</p>

## 为什么是手动检测

WorkBuddy 的推理档位信息分散在上游接口与客户端私有 UI 逻辑里，且模型目录变化很快；而实测有些模型
**接受** `reasoning_effort` 却忽略未知值、回退到默认行为 —— 一次请求成功并不能证明某个档位真的可用。
所以插件不猜：先由你在配置里授权，再按需对单个模型发少量真实请求确认。检测可能消耗少量积分；
结果只表示**上游当前接受该档位**，不承诺它改变推理效果、速度或积分消耗。

## 命令行

不改界面也能查状态：

```sh
dsh plugin --profile web exec dsh-workbuddy-bridge status          # 登录状态与剩余积分
dsh plugin --profile web exec dsh-workbuddy-bridge status --json   # 机器可读
dsh plugin --profile web exec dsh-workbuddy-bridge doctor          # 诊断 App 发现与凭据
dsh plugin --profile web exec dsh-workbuddy-bridge logout          # 清理插件自留的凭据副本
```

默认操作国内版，加 `--provider workbuddy-ai` 操作国际版。`logout` 不动桌面 App 自己的登录。

## 兼容与已知限制

- 只支持 **DSH `0.1.7` 线**；下限以 [package.json](package.json) 的 `engines.dsh` 为准，不做跨代兼容。
- **凭据发现按平台**：macOS 直接支持；Windows 依次探测 Local 与 Roaming AppData（实测可用）；
  WSL 优先读挂载的 Windows 用户目录。找不到时用 `WORKBUDDY_AUTH_FILE`（国际版 `WORKBUDDY_AI_AUTH_FILE`）指定。
- **国际版目录来自 App 界面接口**（私有实现，上游改动可能失效）；国内版走官方 CLI 同款接口。
- 无凭据时该版模型分组不再显示 —— 插件不会展示一份选了必然报错的兜底列表。
- 企业账号积分目前仅覆盖国内版。

设计取舍 → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)；发版流程 → [docs/PUBLISHING.md](docs/PUBLISHING.md)；
维护者文档地图 → [AGENTS.md](AGENTS.md)。

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