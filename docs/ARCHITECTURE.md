# dsh-workbuddy-bridge 架构说明

本文是插件结构与契约的唯一权威文档：为什么这样分层、哪些行为是兼容性契约、浏览器半边依赖官方的哪些接口。使用方式见 [README](../README.md)；`docs/` 另有一份活层的发版手册，以及 `archive/` 里按日期归档的一次性调查记录，都不承担结构说明职责。

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

**启动分三相，顺序是契约**：先读凭据并采纳身份 → 再注册 provider → 最后抓目录。第二相必须晚于第一相：注册时 `catalog.current()` 已经有内容，所以 **provider 一旦出现在 `listProviders()` 里就已经带着模型**。反过来（先注册再揭示，且揭示是 fire-and-forget）会留一个空窗——provider 可见但 `resolveModelInfo` 对它的每个模型都答 `UNKNOWN_MODEL`；picker 里看不出来，但一个已选中该模型的会话（恢复的历史会话、或 `agent-default-model`）首条消息就失败。任一相失败都回退到「以隐藏态注册」，随后由轮询揭示，即与今天相同的降级。判据见 [决策记录](../.agents/notes/2026-10-02-startup-window-fix-direction.md)，守卫在 `tests/catalog-lifecycle.spec.ts`。

**轮询**：30 秒一次凭据存在性检查（`DSH_WORKBUDDY_POLL_MS` 可覆盖，仅测试/诊断用，不是产品设置）。同身份的令牌轮换不触发目录重抓；失败的抓取按退避重试，成功落地后停止。

## 浏览器半（src/client）

官方契约按宿主声明走，没有宿主版本探测、没有防御性包装：

| 契约 | 用法 |
|---|---|
| `plugins.bundle.config` | 本插件在插件页的配置入口，key = 包名 |
| `conversation.input.right` | 输入区紧凑控件行的推理等级控件 + 剩余积分标签。**必须选 `kind: 'list'` 的槽**——`conversation.input.model` 是 `single`，已被宿主自带的 `ModelSelect` 占用，同 priority 再注册会抛错并顶掉宿主的模型选择器（判据见 [PUBLISHING.md](PUBLISHING.md) 的「平台契约的取真源方式」，经过见 [.agents/notes/2026-09-25-composer-seat-single-occupancy.md](../.agents/notes/2026-09-25-composer-seat-single-occupancy.md)） |
| `conversation.chat.assistant-actions` | 已定稿助手回复的操作行（宿主 Like/Dislike 也在这一行）里的「共消耗 X」标签。`kind: 'list'`、`scope: 'session'`，owner currency 是 `{ messageId }`，由 `dsh-client-ui-chat` 声明 |
| `ctx.configForms.whileServed` | 宿主真正在服务本条目时才注册页面——不可写的部署上不会出现一个存不了的表单 |
| `SettingsForm` / `SettingsFormModel` | 与官方设置页同一套表单栈，一次 revision 封装的 mutation 保存全部字段 |
| `ctx.locale` | `settings.workbuddy` 命名空间，zh/en 双语 |
| 官方 primitives | 卡片壳 `DisclosureRow` + `StateDot`，面板用 `SegmentedTabs` / `Tag` / `Checkbox` / `Button` / `Tooltip`，插件不自带任何手搓控件 |
| CSS Modules | `*.module.css` 经 lightningcss 编译为 `[hash]_[local]` 类名并注入 `<style>`（`tsdown.config.ts` 里的构建插件复刻了官方链路） |

`ctx.slots.inject` 跟随槽位的**声明方**生命周期：宿主没有插件页或没有 composer 时，回调根本不会运行，所以不需要任何版本判断。

## 每条消息的积分归属

卡片显示账号**还剩多少积分**（账单接口，账号级）；消息行显示一条回复**花了多少积分**（逐消息）。后者是本插件自己观测出来的，因为上游只在它自己的 SSE 里给出这个数字：

- WorkBuddy 的 OpenAI 兼容流在最后一个 `usage` 帧上带一个 `credit` 字段（标准 OpenAI schema 之外的扩展），就是这次请求的花费。
- 这个数字**是服务端算的，不能本地推导**：桌面客户端只是把 `cost.amount` 的阶段增量累加，从不拿目录里的 `x0.79` 倍率去乘 token（倍率只是展示文案）。所以插件不做任何"按 token 估算"——估出来的数和真值对不上，比不显示更糟。
- 它无法穿过 pi-ai 到达宿主：`parseChunkUsage` 只取标准 token 字段，`TokenUsage` 也没有对应字段。

因此归属靠**两个半边各出一半 key，再 join**：

```text
  shim：SSE 里的 id(cmb-…) + usage.credit   ──►  creditLog.record(id, credit)
                                                        │
  session/event 的 assistant/message ───────────────────┴──► index.set(sessionId, messageId, credit)
    （messageId + source.replayState.response.responseId）              │
                                                              浏览器按 messageId 读
```

`shim` 看到流，`session/event` 看到消息 id，两边都在同一进程里，而上游响应 id 同时出现在两者身上（实测确认），所以是精确关联而不是猜测。两条写入的先后顺序都可能，`creditLog` 因此带一次性 waiter：先到的一方等另一方。

**只在会话正在用 WorkBuddy 的模型时显示**——余额和逐条消耗都是。别的厂商的模型旁边不该出现一个它没碰过的账本；隐藏时连路由都不请求。

**观测不到就不显示，绝不显示 0**：早于本功能的消息、失败的流、上游没给 cost 的回复，这一行是空的。真免费的回复确实显示 `0`——真值和"未知"必须能区分，区分的办法就是未知时什么都不显示。

## 配置与实时状态的分界

这条分界是本插件最重要的设计决定：

- **静态部署状态** → `Config` schema（`authFile`、`authFileAI`、`probeConsent`、`useMaximumContextWindow`）。`Config` schema **就是**设置文档，宿主按包名服务它，写入走 revision 封装的 `mutate`。没有第二份「设置区」。
- **实时账号状态**（账号、积分、目录来源、上下文与显隐、探测结果）→ 只读。卡片是宿主事实的报告者，不是编辑者；唯一的写路径是探测控制路由，且每次写完回读，让宿主的真相留在屏上。

由此不存在「卡片说保存了、宿主却拒绝了」那一类错误：写路径只有一条，且写入后必回读。

## 卡片的视觉语法

卡片上每一块都是**同一种对象**：一条事实——左侧名称与取值，右侧至多一个控件。
几何取自宿主自己的字段行（`ui-primitives/lib/settings-form/fields.module.css`），落点是 [src/client/field.tsx](../src/client/field.tsx) 的 `Field` / `Figure`。四条不变式：

- **右侧只放控件，不放文字**。文字与按钮挤在同一侧会挨在一起（`…更新于 00:59 刷新模型列表`），既不是句子也不是表格。
- **动态值是自己独立的元素**。时间与计数由 `Figure` 渲染、走 `.fieldFigure` 的 `tabular-nums`：刷新时不带动整行抖动，也把「应用量到的」与「应用说出的」在排版上分开。
- **相邻字段用 0.5px 规则线分隔，不用留白**。宿主如此；纯留白堆叠会让同一条事实的几行读成互不相干的散行。
- **块之间 12px**（`.section > * + *`），字段与字段之间除外——那一档由规则线负责。相邻的块贴在一起会读成一个物件，而「列表」与「解释列表的话」最不该被读成一个。

**三个标签页是同一个盒子**：固定高度的面板壳，里面一层固定头（字段行）+ 一个滚动区（取剩余高度）。

| 标签页 | 固定头 | 滚动区 |
|---|---|---|
| 积分 | 合计 + 重置时间 | 套餐条 |
| 模型 | 目录来源 + 刷新 | 显隐说明 + 模型行 |
| 检测 | 档位检测 + 计数 + 费用 + 清除 | 说明 + 档位行 |

高度定死而不是给列表设上限：只设上限时矮的那页仍是内容高度，切标签会改变卡片高度。
滚动区还必须**直接**是面板壳的子级（中间夹一层宿主元素，`flex: 1` 就会加错对象、填高失效）。

**动作挂在它作用的对象上**：面板级的动作（列表刷新、清除结果）都在该面板字段行的右列。固定头在滚动区**之上**，不在其下——滚动区下面的动作会被读成「属于当前滚到的那一行」。

**同一个数字在两处出现就用同一个图标**：积分余额同时出现在 composer 读数与卡片积分页，两处共用 [src/client/coin-glyph.tsx](../src/client/coin-glyph.tsx) 的 `CoinGlyph`。

归属按「这条事实属于谁」定，不按「哪里有空位」：

| 事实 | 归属 |
|---|---|
| 登录状态与有效期 | 账号块——有效期只是会话的属性，同一行 |
| 目录来源与模型列表刷新 | 模型页——它说的是模型列表的状态 |
| 积分合计与重置时间 | 积分页——重置只是合计的属性，同一行 |

前两条由 [../tests/browser/field.spec.ts](../tests/browser/field.spec.ts) 按结构钉住（列的顺序、右列无文字、无控件时不占位），
第三条由 [../tests/redlines.spec.ts](../tests/redlines.spec.ts) 的「机器产出的数字一律等宽」钉住，
「动作挂在对象上」与「三页等高」由 [../tests/browser/card.spec.ts](../tests/browser/card.spec.ts) 钉住
（清除结果必须在字段行内且在列表之前；三个面板共用同一个壳，且滚动区是它自己的子级）。
取舍经过见[决策记录](../.agents/notes/2026-10-02-card-field-grammar.md)。

## 推理档位：一个判据，两处渲染

「这个模型能不能切思考档位」只有一个答案，由 `src/probe/efforts.ts` 的 `resolveEfforts()` 给出，规则严格有序：

1. **上游声明优先**：`supportedEfforts` 非空即用它，观测永不加宽或收窄。这类行**不值得探测**（声明已经是答案），UI 上照常显示灯泡但禁用检测。
2. **`validating` 观测补位**：未声明的行靠一次成功探测得到档位。
3. **其余无档位**：包括 `non-validating`——上游对任何值都回 200（`glm-5.2` 实测），逐档接受全是假阳性。这类行**保持可检测**，因为该结论描述当天上游，不是模型的固有能力。

两处消费同一个答案，这是不变式而不是巧合：

| 消费方 | 用途 |
|---|---|
| `src/llm/adapter.ts` 的 `reasoningFields()` | 模型选择器的 `thinkingLevelMap` |
| `src/index.ts` 的 `probeSection()` | 状态文档 → composer 的灯泡 |

**灯泡的语义是「能否切档位」，不是「探测过没有」**：`efforts.length > 0` ⇔ 灯泡点亮 ⇔ 选择器提供档位。此前的判据是「能不能探测 / 探测过没有」，于是**上游已声明档位的模型反而没有灯泡**——档位直接可用的那些看起来最像坏的（判据与经过见[决策记录](../.agents/notes/2026-10-02-effort-bulb-means-switchable.md)）。

状态文档的 `probe` 因此是**一个列表**（`models`），而不是「候选」加「结果」两列：两列各自回答一半，谁也不回答用户唯一要问的那个问题。

探测本身仍是观察、不是能力声明：结果一律称 "verified accepted"，从不称 "verified effective"——接受只证明上游没拒绝该拼写，不证明它改变了模型行为。

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
