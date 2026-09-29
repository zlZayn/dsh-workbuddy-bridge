# 决策：四份未入库的规划文档不补回，引用改指现有落点（2026-09-29）

状态：生效

## 问题

代码注释按 §4 / §5 / §6.4 引四份文档：`docs/reasoning-effort-probe-plan.md`（引用最集中）、
`docs/upstream-identity-alignment-plan.md`、`docs/client-identity-live-verification-2026-09-14.md`、
`docs/workbuddy-ai-international-research-2026-09-11.md`。
四份在 git 全史里都是 0 提交 —— 只存在于维护者本机，顺引用去查的人与 agent 一律落空。

## 决策

不补回文档。引用改指**会随代码自更新**的落点（`ffffd4e`）：
断言该行为的 spec（`tests/probe.spec.ts`、`tests/probe-service.spec.ts`、`tests/probe-store.spec.ts`、
`tests/reasoning-merge.spec.ts`、`tests/probe-route.spec.ts`、`tests/loopback.spec.ts`），
或 [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) 的「兼容性契约」。
规则正文本来就完整写在注释里，缺的只是一个出处；被引用的那段规划已经没有独立价值。
`docs/archive/` 里那条同样的引用按「记录层不追改」原样留着。

## 替代方案（强制）

- **补回四份**：它们是一次性规划与研究记录，写完即定。入库就要跟着代码改，否则变成第二份会漂的真相；
  不跟着改则迟早与实现矛盾 —— 本仓已经有「活文档随代码走 / 记录不追改」两套治理，规划稿两头都不像。
- **引用改指 git 历史或某个提交**：全史 0 提交，指向不存在的历史等于没改。
- **只删引用不给出落点**：断言关系失去可跳转的目标，下一个改探测顺序的人不会知道「顺序是被 spec 钉住的、不是实现细节」。

## 影响

注释里出现「由 `tests/xxx.spec.ts` 钉住」这类指向，测试文件改名时要同批改注释。
收益是引用现在都指到会跑的东西：spec 红比文档过期更早、也更难被忽略。
副作用要知道：反引号里的路径**不在链接校验的扫描范围**（`check-markdown-links.py` 只解析 `.md` 的 `[..](..)`），
这类漂移机器照不到 —— 判据已记进根 [../../AGENTS.md](../../AGENTS.md) 的活跃坑。
