# tests/browser/ — 文件索引

职责：见 [../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) 的「浏览器半边」一节；本目录跑的是**真实 React 树**（react-test-renderer），不是纯函数替身。

- card.spec.ts —— 变体卡片的渲染契约：首读前后、失败**不**清空已上屏的文档、最新读胜过更早的慢读、三条标签页是真 tabpanel、模型列表刷新走本变体的控制路由
- config-controller.spec.ts —— 配置表单控制器的读写：staged 编辑、一次 revision 封装的保存、宿主停止服务该命名空间时的降级
- harness.ts —— 两类替身与三个助手：
  `useBrowserStubs`（全局 fetch / 定时器 / 环境变量）、`useTree`（React 树与卸载清理）、
  `signedIn` / `textOf` / `buttonLabels` / `clickText` / `expandDisclosure`

## 折叠头怎么点（写新用例前必读）

卡片的 `DisclosureRow` 设了 `expandOnRowClick`（整行都是开关，同 `dsh-ds-balance`）。
原语在 `rowExpands` 为真时**不再渲染**独立的 leading `<button>` —— 整行自己就是按钮
（`div[role=button][data-disclosure-row]`）。所以：

- 展开/收起用 `expandDisclosure(view)`（点 `data-disclosure-row`），**不要**用
  `clickText(view, '')` 找「第一个按钮」—— 它找不到那行，而且卡片里的第一个
  `<button>` 是随内容变的（刷新 / 检测 / 清除），空串匹配会拿错。
- `clickText` 仍然用于内容里的具名按钮（「刷新」「重新检测」…）。

变更影响路由：改本目录 → 同步 [../README.md](../README.md) 的目录清单；卡片结构与文案变化 →
`WorkBuddyCard.tsx` / `WorkBuddyConfigPage.tsx` 的同批双件。