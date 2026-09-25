# src/client/ — 文件索引

职责：见 [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) 的「浏览器半边」一节。

## 文件

- index.tsx —— 槽注册：`plugins.bundle.config`（key = **包名**）、`conversation.input.right`（探测控件）
- config-controller.ts —— `ctx.configForms.get(ENTRY_ID)` 的staged 表单模型；四字段全部 volatile
- WorkBuddyConfigPage.tsx —— 配置页：宿主 `SettingsForm`（两个文本字段）+ 两个官方开关行，然后是实时卡片
- WorkBuddyCard.tsx —— 变体卡片：宿主 `DisclosureRow` 壳（`expandOnRowClick`，整行可点）；账号、令牌有效期、
  目录来源常驻展开区顶部，下面按「读者任务」分三个 SegmentedTabs：积分（合计+套餐）/ 模型（显隐+窗口+倍率）/ 检测
- panels.tsx —— 标签页内容：积分条与套餐明细 / 模型目录表（`ModelsPanel`）/ 档位检测（`ProbePanel`）/ Agent assist
- probe-control.tsx —— 输入区推理档位控件：一个图标按钮 + 一个陈述式浮层（一个按钮，无确认/取消）
- use-status.ts —— 状态文档的轮询与读写
- status-document.ts —— 状态文档的形状守卫
- locales.ts —— 词条（键集真源）；双语同键
- format.ts —— 数字 / 时间 / token 的展示格式化
- variants.ts —— 两个变体（CN / AI）与卡片路由
- workbuddy.module.css —— 配置页与卡片的样式
- probe-control.module.css —— 控件与浮层的样式
- css-modules.d.ts —— `*.module.css` 的类型声明

## 样式从哪抄（改样式前先看）

**不自定一档**。取值真源按用途分：

- 字段 / 开关行 / 表单节奏 → 宿主 `ui-primitives/lib/settings-form/{fields,SettingsForm}.module.css`
- 开关行（布尔设置的整行）→ 宿主 `dsh-client-ui-settings-subagent` 的 `.toggleRow`/`.toggleLabel`
- 带边框的列表块 / 卡片块 → 官方 `dsh-experimental-client-ui-voice-input` 的 `.models`/`.preparation`/`.settingsCard`
- 宿主自己都没定义的 token（`--dsw-alias-label-error`、`--dsw-alias-bg-layer-4`）不许用

指针与检索方式见工作区 `HARNESS-REF.md` 的「配置页样式」（跨仓文件，本仓不链入）。
这几条由 [../../tests/redlines.spec.ts](../../tests/redlines.spec.ts) 的「插件页样式跟着宿主走」一组断言钉着。

## 交互约定

- 卡片折叠头 `expandOnRowClick`：整行可点。**浏览器测试展开用 `tests/browser/harness.ts` 的 `expandDisclosure`**，不要找第一个按钮
- 探测：一个按钮直接跑（无确认/取消）；成本说明只在「还没有结果」时出现
- 配置与实时状态是两半：表单有保存按钮，卡片没有 —— 不靠标题区分

变更影响路由：改本目录 → 同步根 [AGENTS.md](../../AGENTS.md) 的待办与活跃坑；设计变化写
[docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)；样式改动的判据同步
[../../tests/redlines.spec.ts](../../tests/redlines.spec.ts) 的「插件页样式跟着宿主走」。