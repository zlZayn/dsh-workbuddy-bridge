# 架构

本文是插件结构与契约的唯一权威文档：为什么这样分层、哪些行为是兼容性契约、浏览器半边依赖官方的哪些接口。使用方式见 [README](../README.md)；`docs/` 其余文件是按日期归档的专项调查，不承担结构说明职责。

## 总览

插件分为两半，编译为两个独立产物，运行在两个进程里：

```text
src/
├── index.ts            宿主入口：两个变体的组装与生命周期
├── variants.ts         变体描述符（宿主半，含文件系统路径）
├── credential/         凭据：读取桌面 App 登录文件、自留副本、静态加密
├── catalog/            模型目录：上游抓取、降级链、模型显隐
├── protocol/           上游协议：chat / 目录 / 账单 / 错误分类 / 身份
├── llm/                接入 DSH：adapter、shim（loopback 端点）、附件
├── probe/              推理档位探测：发请求、存档、服务判定
├── web/                宿主暴露的 HTTP 路由：status / probe 控制路由 / 心跳
├── shared/paths.ts     两半共用的路由路径与文档类型
└── client/             浏览器半边：设置页、两张卡片、composer 控件
```

两半之间唯一的桥是 `shared/paths.ts` 里的路由路径和 JSON 文档形状。浏览器半边**永远拿不到**文件路径、凭据、平台事实——变体的浏览器可见面是 `src/client/variants.ts` 里的独立描述符，不是宿主的 `variants.ts`。

## 宿主半（src/index.ts）

两个产品变体（`workbuddy` 国内版、`workbuddy-ai` 国际版）由同一工厂组装，只差 `WorkBuddyVariant` 描述符：各自的凭据存储、目录、上游客户端、shim、探测状态、路由。任何一个变体启动失败都不影响另一个注册——只装一个 App 的用户只看到那一个分组。

**目录降级链**（每个变体独立）：`live`（本次抓取）→ `saved`（该账号上次成功目录，重启可恢复）→ `fallback`（编译进插件的名单）。凭据消失时分组隐藏，账号切换时按身份键（`uid:enterpriseId`）切换各自的数据。

**轮询**：30 秒一次凭据存在性检查（`DSH_WORKBUDDY_POLL_MS` 可覆盖，仅测试/诊断用，不是产品设置）。同身份的令牌轮换不触发目录重抓；失败的抓取按退避重试，成功落地后停止。

## 浏览器半（src/client）

官方契约按宿主声明走，没有宿主版本探测、没有防御性包装：

| 契约 | 用法 |
|---|---|
| `plugins.bundle.config` | 本插件在插件页的配置入口，key = 包名 |
| `conversation.input.right` | 输入区紧凑控件行的推理等级控件。**必须选 `kind: 'list'` 的槽**——`conversation.input.model` 是 `single`，已被宿主自带的 `ModelSelect` 占用，同 priority 再注册会抛错并顶掉宿主的模型选择器（判据见 [PUBLISHING.md](PUBLISHING.md) 的「平台契约的取真源方式」，经过见 [.agents/notes/2026-09-25-composer-seat-single-occupancy.md](../.agents/notes/2026-09-25-composer-seat-single-occupancy.md)） |
| `ctx.configForms.whileServed` | 宿主真正在服务本条目时才注册页面——不可写的部署上不会出现一个存不了的表单 |
| `SettingsForm` / `SettingsFormModel` | 与官方设置页同一套表单栈，一次 revision 封装的 mutation 保存全部字段 |
| `ctx.locale` | `settings.workbuddy` 命名空间，zh/en 双语 |
| 官方 primitives | 卡片壳 `DisclosureRow` + `StateDot`，面板用 `SegmentedTabs` / `Tag` / `Checkbox` / `Button` / `Tooltip`，插件不自带任何手搓控件 |
| CSS Modules | `*.module.css` 经 lightningcss 编译为 `[hash]_[local]` 类名并注入 `<style>`（`tsdown.config.ts` 里的构建插件复刻了官方链路） |

`ctx.slots.inject` 跟随槽位的**声明方**生命周期：宿主没有插件页或没有 composer 时，回调根本不会运行，所以不需要任何版本判断。

## 配置与实时状态的分界

这条分界是本插件最重要的设计决定：

- **静态部署状态** → `Config` schema（`authFile`、`authFileAI`、`probeConsent`、`useMaximumContextWindow`）。`Config` schema **就是**设置文档，宿主按包名服务它，写入走 revision 封装的 `mutate`。没有第二份「设置区」。
- **实时账号状态**（账号、积分、目录来源、上下文与显隐、探测结果）→ 只读。卡片是宿主事实的报告者，不是编辑者；唯一的写路径是探测控制路由，且每次写完回读，让宿主的真相留在屏上。

由此不存在「卡片说保存了、宿主却拒绝了」那一类错误：写路径只有一条，且写入后必回读。

## 兼容性契约（改动前必读）

以下行为不是实现细节，改动它们等于丢弃用户磁盘上的数据：

- **`fingerprintModel` 的输入键序**（`src/probe/store.ts`）：指纹是 `JSON.stringify` 的直接哈希，`reasoning` 对象的**键插入顺序**是哈希的一部分。重排 `resolveUpstreamReasoning`（`src/protocol/client.ts`）里的键会静默作废所有已存的推理档位观测。键序在此文件里是故意固定的。
- **`canDisableThinking` 的缺省不对称**：行内没有 `reasoning` 块时缺省 `true`（这种行 adapter 根本不会发 effort，值无关紧要）；**有**块但没写这个字段时严格 `=== true`（这类是会在 wire 上拒绝 `off` 的老模型）。不要"统一"成一边。
- **上游解析的严格性**（`src/protocol/client.ts`）：字段一律 `typeof` 收窄，不用 schema 校验库替代——schemastery 会把 `'120'` 强转成 `120`、给缺失的可选子对象补 `{}`，两类静默转换分别破坏"usage 字段非数字要报错"和"reasoning 块缺省"两条已测行为。
- **探测记录的账号归属**：每条观测绑定产生它的账号，切换账号后旧账号的观测不消失（留在盘上）但不再被读出。

## 测试

```sh
pnpm test          # 全量
npx vitest run tests/browser   # 只跑浏览器半边
pnpm typecheck     # 两个 tsconfig（宿主 / 浏览器）严格模式
pnpm build         # tsdown，含 CSS Modules 编译
```

- `tests/` 宿主半边：协议解析、目录生命周期、凭据、路由。**不**起真实网络，上游一律 stub。
- `tests/browser/` 浏览器半边：`react-test-renderer` + stub 的 `window`/`fetch`。`harness.ts` 提供时钟推进（`tick()`）与合成事件——官方组件的事件处理器会读 `stopPropagation`，裸 `onClick()` 会炸。
- 宿主测试的断言按"用户可见事实"写（如"卡片仍显示账号名"），不按实现写。

## 已知未覆盖

沙箱环境跑不了真实上游与真实桌面 App：探测的真实往返、企业账单的真实形状、macOS 路径发现的真机行为，均只有单测级覆盖。改动这些路径时以"保守回退 + 明示失败"为默认策略。
