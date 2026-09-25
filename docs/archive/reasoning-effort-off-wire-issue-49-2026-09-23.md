# reasoning_effort "off" wire 拼写问题：诊断与修复方案（issue #49 / PR #50）

日期：2026-09-23
触发：issue #49（zmnb188-png，`[Bug] reasoning.effort 被发出字面量 "off"，导致国际版 GPT 系恒报 11133 —— 即 #34 的真实根因`）+ PR #50（同作者，fix）
状态：**已实施（2026-09-23，随本 commit 入库，未发布）**；§3.3 验收已按"最终发送的请求"完成（见 §7）

---

## 0. 方案一页纸（TL;DR）

**采纳 PR #50 的修复思路，但把生效范围从"两版共用"收窄为"仅国际版"**：

1. **国内版（workbuddy）：保持原样**——不改请求参数、不改 Off 行为，`'off'` 照旧发送。既有证据只是"该参数被上游接受（HTTP 200）"，**接受不等于关闭思考实际生效，本文档不对此作断言**。
2. **国际版（workbuddy-ai）：应用 strip 修复**——`'off'` 在 wire 边界（`prepareInternationalChatBody`）被剥掉，恢复 GPT 系调用；**明确文档化：国际版选择器里的 Off 暂时只代表"不发送该参数"，实际行为由上游决定，不保证关闭思考**。
3. **Gemini 单独诊断**（§5）——不在 #49/#50 的解决范围内，另行处理。
4. **Follow-up 仅是方向草案**（§6）——"off 拼写探测"有两个前置问题未解决（接受≠生效的判定、pi-ai 的自动发送耦合），不可按现状执行，不构成终局方案。

---

## 1. 现象与根因

### 1.1 现象

国际版 GPT 系四款（`gpt-5.6-sol` / `gpt-5.6-terra` / `gpt-5.6-luna` / `gpt-6-astra`）经插件调用恒报：

```
400 / code 11133 / extError.code "invalid_value" / param "reasoning.effort"
```

且**只有"未指定档位"这条路径挂**：显式选档（如 max）一切正常。CN 侧模型全部正常。#49 确认了一个国际版 GPT 参数故障；**是否完全解释 #34 当时的故障仍需核对**（#34 还包含 Gemini 症状，见 §5）。该故障容易伪装成网络问题的原因：错误码 `displayMsg`（"请求参数有误，请检查请求后重试"）不含任何指向 `reasoning.effort` 的提示，且"手动选档就好、一留空就坏"。

### 1.2 根因链（三方叠加）

**① 插件**（`src/adapter.ts:241`）：

```ts
off: reasoning.canDisableThinking === true && declared !== undefined && declared.length > 0 ? 'off' : null,
```

对声明了 `canDisableThinking: true` 且有声明档位集的模型，`thinkingLevelMap.off` 被钉成字面量 `'off'`。这个映射自 v0.4.0 时代在 CN 账号实测建立。

**② pi-ai**（`@earendil-works/pi-ai` 0.85.x，`openai-completions.js:731`）：

```js
else if (!options?.reasoningEffort && model.reasoning && compat.supportsReasoningEffort) {
    const offValue = model.thinkingLevelMap?.off;
    if (typeof offValue === "string") {
        params.reasoning_effort = offValue;   // ← 未指定档位时自动发出
    }
}
```

**pi-ai 把 `thinkingLevelMap.off` 的条目同时用作两个用途**："选择器是否提供 Off 档"（字符串=提供，`null`=不提供）和"未指定档位时自动发送的 wire 值"。两者耦合在同一条目上，无法只改其一——这是本次所有方案取舍的根源约束。

**③ 上游**：国际端点对 GPT 系校验 `reasoning.effort` 词汇表，`'off'` 不在其中（`invalid_value`）；CN 端点历次实测未见拒绝（含 `bogus` 值也返回 200 的观察，见 probe-plan §4.2）。

三者相乘：凡 `canDisableThinking: true` + 走"未指定档位"路径的请求都自动携带 `'off'` → 国际版 GPT 系必 400。国际版 0.5.0 上线时复用了 CN 实测建立的映射，当时的测试只覆盖了显式选档路径，漏了这条默认路径——这就是潜伏到今天才爆的原因。

### 1.3 本质

与探测系统当年解决的"档位词汇表不透明"同构的又一堵墙：**上游的"声明"与"执行"没有一致性保证**。`canDisableThinking: true` 声明的是**能力**，不是 **wire 拼写**；同一个声明在三家供应商后面映射到三种现实——**在本次 off／none／省略三种对照形态中**：GLM 接受 `'off'`，GPT-5.6 三款只接受 `'none'` 或省略，`gpt-6-astra` 连 `'none'` 都拒（只接受省略）。此对照不涉及、也不排除其他合法档位的可用性。probe-plan §2 当年"`off` 不探测、不推断，只按声明展示"的决策，建立在只在 CN/GLM 一个供应商上实测过的数据上——#49 证明这个例外是错的。

## 2. 实测证据

### 2.1 #49 报告者的矩阵（8 模型 × 3 形态，直连国际端点）

| 模型 | `'off'` | `'none'` | 省略 |
|---|---|---|---|
| `gpt-6-astra` | ❌ 400 | **❌ 400** | ✅ 200 |
| `gpt-5.6-sol` | ❌ 400 | ✅ 200 | ✅ 200 |
| `gpt-5.6-terra` | ❌ 400 | ✅ 200 | ✅ 200 |
| `gpt-5.6-luna` | ❌ 400 | ✅ 200 | ✅ 200 |
| `glm-5.3-flash` | ✅ 200 | ✅ 200 | ✅ 200 |
| `glm-5.3` | ✅ 200 | ✅ 200 | ✅ 200 |
| `glm-5.2` | ✅ 200 | ✅ 200 | ✅ 200 |
| `kimi-k2.8-preview` | ✅ 200 | ✅ 200 | ✅ 200 |

关键读法：**省略是唯一 8/8 全通的形态**；`'none'` 不是安全替代（astra 连它都拒）。表中的 ✅ 均指"参数被接受（HTTP 200）"，不构成对思考是否关闭的判断。

### 2.2 我们的独立复核（2026-09-23，本机 AI 账号，经 `chatStream` 真实路径）

- `gpt-5.6-luna` + `'off'` → ❌ 400 invalid_value；省略 → ✅ 200
- `gpt-6-astra` + `'none'` → ❌ 400 unsupported_value；省略 → ✅ 200
- PR #50 改动（**共用 strip 形态**）套在本地 HEAD（含 #48 四 commit）→ typecheck + 492/492 全绿。注意：这验证的是 PR 原形态，**不构成区域拆分后的验收**——区域拆分实施后的验收要求见 §3.3 末尾。

### 2.3 根因代码核实

`adapter.ts:241` 的 `'off'` 映射与 pi-ai 731 行的自动发送分支，均在我们锁定的依赖树里逐字确认。

## 3. 方案取舍（为什么是"仅国际版 strip"）

### 3.1 候选与淘汰理由

| 方案 | 评价 |
|---|---|
| `off → 'none'` | ❌ `gpt-6-astra` 连 `'none'` 都拒，会把"部分可用"变"恒定 400"（报告者自己也撤回了此建议） |
| `off: null`（全局拿掉 Off 档） | ❌ pi-ai 耦合决定"砍自动发送"必同时"砍选择器档位"；还要改我们 pin 的 reasoning-merge 测试 |
| 按模型写死映射（GLM 发 `'off'`、GPT 不发） | ❌ 静态快照反模式：roster 日级翻转的教训刚教过；供应商分化本身就证明快照必过期 |
| 两版共用 strip（PR #50 原样） | ⚠️ 救活 GPT，但 CN 侧携带 `'off'` 的请求也被剥掉——与"国内版保持原样"的要求冲突 |
| **仅国际版 strip（本方案）** | ✅ 改动范围最小且只覆盖已确认的故障面 |

### 3.2 区域拆分的理由与边界

理由只有一条：**按用户要求保留国内版行为，仅修复已确认的国际版故障**。区域拆分是**改动范围控制**，不是对两个端点长期行为的断言——现有观察仅限"CN 侧历次实测中 `'off'` 均返回 200"，这既不构成"CN 端点永远接受"的证明，也不约束未来；上游策略若变化，以届时实测为准。

### 3.3 实现落点

PR #50 把 `dropUnsupportedEffort()` 放在 `prepareChatBody()`（两版共用的 shim 入口）。本方案把它**挪进 `prepareInternationalChatBody()`**（`chatStream` 内 `region === 'global'` 分支的既有变换层）——CN 路径一行不碰，国际版天然全覆盖（shim / DSH-llm / 直连都汇到 `chatStream`）。

```ts
// prepareInternationalChatBody 内，与 normalizeDeveloperRole 等同层
function dropUnsupportedEffort(obj: Record<string, unknown>): void {
  if (obj['reasoning_effort'] === 'off') delete obj['reasoning_effort']
}
```

测试对称补充：CN body 携带 `'off'` 原样透传（钉住"国内不动"）；国际剥掉；声明档位 `low…max` 与 `'none'` 两版都原样透传。

**实施后的验收（以最终发送的请求为准）**：CN 变体发出的请求保留 `reasoning_effort: "off"`；Global 变体发出的请求不含 `reasoning_effort: "off"`；两变体其余档位值不变。§2.2 的 492 全绿属 PR 原共用形态的验证，不能替代本验收。

## 4. 已知限制（要写进 release notes 与 #49 回复的）

1. **国际版 Off 暂时不向 wire 发送该参数**：选择器仍显示 Off，实际请求省略 `reasoning_effort`，**实际行为由上游决定——不保证关闭思考，也不保证等于目录声明的 `defaultEffort`**。受影响的不仅是 GPT——国际版目录里的 GLM/kimi 同样如此（它们的上游接受 `'off'` 参数；同样只是"接受"，生效与否未验证）。
2. **CN 侧保留既有行为**："未选档位时自动发送 `'off'`"在 CN 继续存在（glm-5.3-flash / kimi-k2.8-preview 未选档时请求携带 `'off'`；参数被接受，实际效果未验证）。这是 pi-ai 自动填充分支的既有语义，本次按"国内保持原样"原则不动。
3. `'none'` 是部分模型接受的显式拼写，两版都透传不删（不由适配层替用户决定）。

## 5. Gemini 单独诊断（初诊，2026-09-23）

本机实测记录（国际版凭据，经 `chatStream` 真实路径）：

| 时间 | 模型 | 请求形态 | 结果 |
|---|---|---|---|
| 2026-09-23 | `gemini-3.5-flash` | 无 `reasoning_effort`（插件真实路径；它 `canDisableThinking: false`，pi-ai 不代发） | ✅ HTTP 200，流式 1301 B，含 `[DONE]` |
| 2026-09-23 | `gemini-3.5-flash` | `reasoning_effort: "off"`（手工构造） | ❌ HTTP 400 / code 11150 "effort value not supported" |
| 2026-09-23 | `gemini-3.5-flash` | 连发三发（无 effort / medium / off） | 前两发 ❌ HTTP 429 / code 14003（限流），退避 65 秒后首形态复测通过 |

**可以说的**：本机当前版本、插件真实路径上 Gemini 可用，无需也不在本次 strip 修复范围内；它拒绝 `'off'`（11150）与声明自洽，且插件不会对它发送。

**不能说的**：429 只是本轮一次瞬时观察，**不构成对 #34 Gemini 故障的归因**——#34 的 Gemini 部分需报告者带错误码复测后定案。本轮记录为会话内实测，用户仅复核记录、未独立复测。

## 6. Follow-up 方向（草案——不可按现状直接执行）

修订 probe-plan §2/§4.1 "不探测 off" 的方向仍然成立，但有**两个未解决的前置问题**，解决前不能称为终局方案：

**前置问题 A：接受 ≠ 生效。** 探测得到 200 只证明拼写被接受，不证明"思考确实被关闭"——这正是原探测文档确立的原则（probe-plan §4.2：glm-5.2 连 `bogus` 都 200）。若要让 Off 档重新携带"关闭思考"的语义承诺，需要能判别生效的验证手段，目前没有设计。可能的方向如对比有无该参数时响应中推理内容的差异——但那只能是**辅助观察**：没有返回推理内容不代表内部没有推理，不能作为充分判据。

**前置问题 B：pi-ai 耦合。** 把探到的拼写重新填进 `thinkingLevelMap.off`，会同时恢复"未指定档位时自动发送"的分支（§1.2②）——即恢复显式 Off 的同时重新引入本次事故的放大器。需要先设计解耦手段（适配层拦截显式选择、pi-ai 上游变更、或其他映射策略），目前没有设计。

可保留的观察（供未来设计参考）：

- 拼写拒绝有两种错误码形态：`11150`（09-11 CN 实测）与 `11133` + `extError.param=reasoning.effort`（#49 国际实测），任何接受性探针的判定都需两者都认；
- 哨兵先行（`bogus` 200 = 上游不校验该字段 = 接受性探测无意义）；
- 可邀请 zmnb188-png 参与（其实测功力已被 #49 证明）。

## 7. 决策与修订记录

- 2026-09-23：按用户优先级提出区域拆分方案（国内原样 / 仅国际 strip / Gemini 另案），经两轮审阅后确认。修正记录：去掉"真实关闭思考"断言（接受≠生效）、去掉"上游默认档"承诺（实际行为由上游决定）、区域拆分仅作范围控制不作端点断言、follow-up 降级为带前置问题的方向草案、Gemini 不因单次限流归因、"#34 实为误判"改为"是否解释 #34 仍需核对"、none/off 对照加范围限定、推理内容差异仅作辅助观察、492 全绿标注为 PR 原形态验证。修正仅涉文案，未扩大代码改动范围。
- 2026-09-23（实施）：`dropUnsupportedEffort` 落位于 `prepareInternationalChatBody`（含全部早退路径），`prepareChatBody` 恢复原状（CN 零改动）。**§3.3 验收结果**（chatStream 层、以最终 fetch body 断言）：CN 变体 `'off'` 原样保留 ✓；Global 变体 `'off'` 不出现 ✓；`low/medium/high/xhigh/max/none` 两变体逐值不变 ✓（`tests/upstream.spec.ts` 新 describe + `tests/prepare.spec.ts` 区域对称用例，496/496 全绿）。
