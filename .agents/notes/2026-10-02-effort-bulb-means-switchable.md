# 决策：灯泡的语义是「能否切档位」，不是「探测过没有」

状态：生效
日期：2026-10-02

## 问题

composer 里推理档位控件的灯泡按 `probe.candidates.includes(model) || hasRecord` 决定是否出现，而 `candidates` 只含**上游未声明档位**的模型。于是：

- **上游已声明档位的模型反而没有灯泡** —— 而它们恰恰是档位直接可用、最不需要操心的那些。维护者实测反馈「有些根本不出现灯泡，空心的也不出现，比如 GLM-5.3-Flash · x0.06，但在选择的地方确实能选档位」；
- 用户看到的规律是「随机的」，因为 UI 里没有任何一处解释「有灯泡」与「没灯泡」的分界；
- 两套判据各自独立实现（`src/index.ts` 的候选集 vs `src/llm/adapter.ts` 的 `reasoningFields`），本可以漂移而无人察觉。

同时 `non-validating`（上游不校验该参数）被显示成「尚未检测」——把用户花积分换来的结论说成「还没查过」，与同一面板里「该模型不校验档位参数」直接矛盾。

## 决策

**灯泡只回答一个问题：这个模型现在能不能切思考档位。**

- **判据单一**：`efforts.length > 0` ⇔ 灯泡点亮 ⇔ 模型选择器提供档位。三者同源，不可能互相矛盾。
- **可见性按「有没有话说」**：宿主报了这个模型（即 `reasoning.supports === true`）就画灯泡；不推理的模型两者都没有。
- **「已声明」显示灯泡但禁用检测**，按钮文案写明「上游已声明档位，无需检测」——声明永远优先，探测只会花积分学一个已知答案。
- **`non-validating` 保持可检测**：那个结论描述的是当天上游，不是模型的固有能力。
- **单一真源**：`src/probe/efforts.ts` 的 `resolveEfforts()` 同时供 adapter（`thinkingLevelMap`）与状态文档（灯泡）使用，`tests/efforts.spec.ts` 断言两者逐例一致。

## 替代方案

- **保留原判据，只补文案说明**：治标。用户仍要自己推断「为什么这个没有灯泡」，而规则本身反直觉（越完善的模型越没有控件）。
- **灯泡覆盖全部模型、但已声明的也开放检测**：能花钱把已声明的集合再「验证」一遍，但声明优先意味着验证结果永远不会改变 UI——花积分换一个不会生效的结论。
- **只按「是否探测过」亮灯（原行为）**：`non-validating` 会亮灯，把「检测过」误读成「能用」。维护者明确否掉：「反正以是否支持切换思考档位为区分，而不是检测过的就亮灯」。
- **把检测整体移回设置卡、composer 不留控件**：窗口内切换模型是使用档位最自然的时刻，移走会让这个动作多两次点击。

## 影响

- 契约变更：状态文档的 `probe` 从 `{candidates, results}` 改为单一 `models` 列表，每行带 `efforts` / `source` / `detectable` / 可选 `validation`+`probedAt`。两半体同版本发布才成立（插件自产自销，无第三消费方）。
- 设置卡的档位页现在列出**全部推理模型**（不再只列待检测的），已声明的行按钮禁用并注明原因。
- `tests/browser/probe-control.spec.ts` 与 `tests/efforts.spec.ts` 是新增的守卫：前者此前**完全不存在**，`selection === null` 的首帧崩溃与灯泡可见性缺陷因此长期无人拦截。
- 文案：`probePanelNone`（「尚未检测」）拆成 `probePanelNoLevels`、`probeResultDeclaredNone`、`probePanelDeclaredNone`、`probeTooltipDeclared`，各自只陈述一件事实。
