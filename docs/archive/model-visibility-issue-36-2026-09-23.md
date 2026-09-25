# #36 模型显隐（per-account model visibility）实施记录

日期：2026-09-23
分支：`LYS86/main`，实现提交 `37a7098`
前置：#41 / PR #42 的双 DSH UI 兼容已完成；版本保持 `0.5.4`（不提前 bump 0.6.0）；未触碰 #39/#40 凭据加密；未改 dual UI 架构。

## 1. 最终数据模型

每个 variant 一个插件自有文件（`$DSH_HOME` 下）：

```
workbuddy     → .workbuddy-model-visibility.json
workbuddy-ai  → .workbuddy-ai-model-visibility.json

文件内容：
{
  "version": 1,
  "accounts": {
    "<uid>:<enterpriseId>": {
      "account": "<uid>:<enterpriseId>",
      "disabled": ["glm-5.3", "hy4-preview"],   // 黑名单，不做自动清理
      "updatedAtMs": 1790...
    }
  }
}
```

- **disabled 黑名单**，不是白名单（见 §2）。
- 账号桶在 disabled 清空时整体删除（空桶=全部可见，不堆积空条目）。
- 登出**不删除**条目：切回旧账号原样恢复（与 savedCatalogs 登出即删的策略相反，因为显隐是"用户手动设置的偏好"而非"上游数据的缓存"）。

## 2. 为什么用 disabled list

- 新账号默认全可见：空桶即语义，无需迁移。
- 上游新增模型默认可见：不在名单即显示。
- 从 catalog 暂时消失的 disabled id **保留**：模型回归后仍隐藏，直到该账号手动改回。持久化层永不按当前 catalog 过滤（没有 `disabled = disabled.filter(inCatalog)` 之类的清理）；UI 只渲染当前 catalog 里的模型，但 status 路由返回完整名单（含 stale id），测试 A 组钉死这一语义。

## 3. account identity 的选择

- 沿用插件现有的稳定身份键 `credentialIdentity(credential)` = `` `${uid}:${enterpriseId ?? ''}` `` —— savedCatalogs 与 probe records 已经按它分账号，语义一致。
- 不用 nickname（可变）、token/token hash（轮换）、模型列表（随上游变）。
- **空 uid 降级**（`src/index.ts` 的 `visibilityAccountOf`）：桌面 auth 文档缺 `account.uid` 时 uid 归一为 `''`，此时返回 `undefined` —— 不落到共享的 `":enterpriseId"` 匿名桶。后果：该凭证**没有 per-account 显隐**（全部可见），status 文档不带 `visibility` 段（卡片不渲染控件），控制路由拒绝写并返回原因（"needs a signed-in account with a stable user id"）。不静默、不共享、可解释。实测桌面文档均携带 uid，此分支仅为防御。

## 4. persistence 放在哪里（及为什么不是 settings）

**结论：插件自有的 per-variant 文件（`src/visibility-store.ts`），不放 settings section。**

理由：

1. settings section 是静态类型的 schemastery 对象（`Config` / `CN_SECTION` / `AI_SECTION`），塞一个 `Record<uid, string[]>` 动态 map 要么弱化类型要么破坏现有 schema——任务明确禁止。
2. `settings.yaml` 是**账号全局**的：per-uid 数据放进去会把 A 账号的偏好混进 B 账号编辑配置时的视野，生命周期也不同（偏好应随账号进出而切换，settings 不应该）。
3. 代码库已有两个同型先例：savedCatalogs（catalog-store.ts）与 probe records（probe-store.ts）都是"per-variant 文件 + 按 identity 分桶 + 原子写 0600 + 坏文件读作空"。visibility-store 完全照此风格实现，唯一差别是**写失败向上抛**（catalog-store 吞掉写失败是对的——那只是缓存；显隐是用户明确按下的动作，保存失败必须让调用方能报告，卡片测试 G 钉死"不谎报成功"）。

不写桌面 auth 文件、不写插件自有凭据副本、不与 token 生命周期混放：文件里只有模型 id 字符串。

## 5. catalog / selectable / resolvable 三者边界

这是本任务最重要的架构边界，seam 选在 **`WorkBuddyPiAiAdapter.listModels()` override**：

```
catalog.current()            完整目录（卡片、probe 候选、/v1/models 都读它）
        │
        ▼
buildModels() → pi-ai snapshot（不过滤！）
        │
        ├─ resolveModel / resolveModelInfo / prepareCall / stream → 读同一 snapshot，全量解析
        │    （pi-ai 基类的 resolveModel 与 listModels 共享 snapshot.models.getModel；
        │      若在 buildModels 层过滤，隐藏模型会 resolve 出 UNKNOWN_MODEL，
        │      旧会话下一条消息就断 —— 所以过滤绝不能放那里）
        ▼
listModels() override（adapter.ts）：super 结果 - hidden(account) → 选择器/`/model` 只见可见模型
```

- `hidden` 是每次调用现取的 getter：`runtime.account()` → `visibilityStore.disabled(account)`，无缓存，账号切换/开关后下一次 listModels 即生效。
- 已有会话继续用 `glm-5.3`：发送时走 `resolveModel`/`prepareCall` → 完整 snapshot → 正常（测试 B 组：listModels 不含它、resolveModel 照常解析）。
- 开关成功后 `runtime.invalidate()`（重建 profile map + `ctx.emit('llm/adapters-updated')`）→ 0.1.6 的 model-selection 客户端按 host-generation 失效重载 —— 与 probe/目录刷新同一条已验证的刷新链路。

## 6. account switch lifecycle

现有 sweep（30s 凭据轮询）+ 手动刷新都会走 `adoptIdentity`。本轮给它加了第二个并行映射 `lastAccounts`（与 `lastIdentities` 同源同变，由调用方从**同一个 credential** 算出，避免从 identity 字符串反推 uid）：

- 账号 A → B：adopt 后 `runtime.account()` 立即回答 B 的 key；`invalidate()` 已在 adopt 路径中触发 → picker 重列（B 的名单）；卡片下次轮询（60s）或手动刷新拿到 B 的 `visibility` 段。
- B → A：A 的名单从文件原样恢复（§1 登出不删）。
- 登出：catalog 整组隐藏（原有行为），`visibility` 段消失，控制路由拒绝写（不会写出"匿名全局账号"的 disabledModels）。

## 7. CN / Global 隔离

- 两个 variant 各自的 `visibilityFilename`（variants.ts），各自 `WorkBuddyVisibilityStore` 实例 —— 同一个 uid 字符串在两边互不可见（测试 D 组：两个 store 实例断言互不影响）。
- 控制路由按 variant 挂载（status/probe 路径本来就 per-variant），浏览器无法跨 variant 写。

## 8. UI wiring

- 复用共享 `WorkBuddyPluginCard`：0.1.5（Settings → Plugins 两张卡）与 0.1.6+（Plugins → workbuddy-connect → 配置页）自动同享，零版本分支。
- **布局（2026-09-23 二次修订）**：visibility checkbox 已与 `ContextTable`（「上下文窗口」标签页）**合并为单一模型列表**——每个模型只渲染一行，checkbox 在左、模型名+费率居左、context window 靠右；不再有独立的「模型显示」长列表（首版实现曾上下两份列表，页面高度近翻倍，已按 review 修掉）。列表以**完整当前 catalog** 驱动（显隐针对全 catalog，与 context 元数据无关）：无 `contextWindow` 的模型照常渲染 checkbox，右侧显示 `—`；context 元数据只是行的附加信息。排序沿用原 ContextTable 规则——有窗口的模型按窗口从大到小，无窗口的稳定排在末尾（组内保持 catalog 顺序）。国际版「使用上游声明的最大上下文窗口」偏好保持在列表上方，与逐模型 checkbox 分属两个语义层级。Host 逻辑（store/adapter/路由/guard）在此轮 UI 重构中完全未改。
- 数据流：卡片 GET status（携带非敏感的 `visibility: { account, disabled }` + 全量 models）→ 渲染勾选态；切换 POST probe 路由新动作 `{action:'set-model-visibility', model, visible, account}`（X-Workbuddy-Probe-Key 鉴权，与其余控制动作同 guards）；成功（`state:'updated'`）后卡片重读 status。**无乐观翻转**：勾选态永远来自 host 真相，保存失败时原因显示在旁、勾选不变（测试 G 组）。
- **expected-account guard（review 修订，2026-09-23）**：动作里的 `account` 是卡片渲染勾选态时所在的账号键（来自 `visibility.account`），且为**必填**（缺失即 400，无兜底账号可假设）。宿主与当前 `runtime.account()` 不符 → 拒绝并返回 `state:'stale-account'`，不落盘。这堵住了账号切换窗口的竞态：卡片还显示 A 的列表、桌面已切到 B 时，A 的开关不会写进 B 的桶。卡片收到 `stale-account` 后立即重读（收敛到新账号的勾选态）并以本地化文案提示"登录账号已切换——本次修改未保存"。
- **toggling 独立于卡片 busy（review 修订，2026-09-23）**：可见性开关用独立的**逐行** in-flight 状态（按 model id 的集合，支持并发写入各自记行），不再借用卡片全局 `busy`——否则每次点 checkbox 都会把「刷新/刷新模型列表」按钮谎报成"正在刷新"，且写入期间整列 checkbox 齐灰齐亮。写入在途时**只有被点的那一行锁定**，其余行可继续操作，其余控件不受影响。
- 未登录：status 是 signed-out，卡片只显示登录提示，无控件可编辑。
- 浏览器端不接触 accessToken/refreshToken；account 是非鉴权性的 `uid:enterpriseId`。

## 9. 测试矩阵（29 个新测试起，UI 合并后全量 387/387）

| 组 | 文件 | 覆盖 |
|---|---|---|
| A disabled 语义 | model-visibility.spec.ts | 空=全可见；hide/re-show 往返；新模型默认可见；stale id 保留；空桶删除；坏文件容错；0600 权限 |
| B resolve 兼容 | 同上 | listModels 隐藏 vs resolveModel 全量解析；账号切换/无账号时 hidden getter 的三态 |
| C 账号隔离 | 同上 | uid-a/uid-b 各自名单互不影响 |
| D variant 隔离 | 同上 | 同 uid 两个 store 实例互不影响；descriptor 文件名唯一 |
| E 持久化 | 同上 | 重开实例仍在；登出不清；写失败传播且内存不脏 |
| F 降级 | 同上 | 空 uid → undefined key；signed-out 无段；uid-less 无段；正常段含 stale id |
| 路由契约 | 同上 | 动作持久化+updated（含 expected-account 透传）；mismatch → stale-account；failed 带原因；缺 account/畸形 400；未支持 404 |
| G 卡片 UI | model-visibility-card.spec.ts | 勾选态=名单；POST body（含 account）/key 正确；成功翻转；失败不翻转且报因；**stale-account 拒写+本地化提示+收敛新账号**；无段无控件；刷新换账号整表切换；AI 卡同控件（=双 DSH 表面） |
| H dual seam | 既有 slot-registration / client-fallback | 未改动，继续通过 —— 功能在共享卡片里，表面分发已覆盖 |

`pnpm run check`：typecheck ✓ / vitest **387/387** ✓（含 expected-account guard 与 UI 合并用例：模型不重复、checkbox 与 context 同行、无 contextWindow 模型可勾选、AI 偏好共存）/ build ✓；client bundle 仍仅 require react/jsx-runtime。

**浏览器冒烟（2026-09-23，均通过；两轮——首版独立列表 + 合并布局）**：

- **0.1.6-alpha.2**（9001，真实配置副本，合并布局复验）：Plugins → workbuddy-connect → CN 卡片「上下文窗口」标签为**单一合并列表**——「模型显示」独立标题已不存在，每个模型一行（checkbox + 名称 + 费率 + 窗口数值同行，Kimi-K3 全页只出现一次）；取消勾选 MiniMax-M3 → 磁盘记录（0600）→ 刷新按钮保持空闲文案 → 模型选择器 WorkBuddy 组 16→15、MiniMax-M3 消失（AI 组 22 不变）；恢复勾选 → picker 回 16。逐行锁定复验：写入在途期间采样禁用数恒为 1（只有被点行）。
- **0.1.5-rc.1**（9002，core15 + 同一副本）：设置 → 插件 → 两张卡原位 → CN 卡同一合并列表自动生效（checkbox+context 同行）；取消勾选 Kimi-K2.6 → picker 相应变化 → 恢复。
- README 已补两张实拍截图：`assets/6.png`（0.1.6 配置页合并列表）、`assets/7.png`（0.1.5 设置卡片同视图）。

## 10. 已知限制

- **真实多账号切换未人工验证**（只有一个登录账号可用）；A→B→A 的行为由测试 C 组 + adoptIdentity 生命周期覆盖，自动测试已覆盖，真实多账号切换尚未人工验证。
- 空 uid 凭证（防御分支）无显隐控件——按设计，不是遗漏。
- 显隐是 per-host-install 的本地偏好：不同设备/不同 `$DSH_HOME` 不同步（与 probe 记录一致，无云同步）。
- 0.1.8+ prerelease 的 peer 覆盖与 #39/#40、#34/#35 不在本任务范围。
