# tests/browser/ — 文件索引

职责：见 [../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) 的「浏览器半边」一节；本目录跑的是**真实 React 树**（react-test-renderer），不是纯函数替身。

- card.spec.ts —— 变体卡片的渲染契约：首读前后、失败**不**清空已上屏的文档、最新读胜过更早的慢读、三条标签页是真 tabpanel、模型列表刷新走本变体的控制路由
- config-controller.spec.ts —— 配置表单控制器的读写：staged 编辑、一次 revision 封装的保存、宿主停止服务该命名空间时的降级
- credit.spec.ts —— 两张积分面（逐条消耗、选择器旁的余额）：观测不到就不渲染、绝不显示 0、别的 provider 会话不出声
- probe-control.spec.ts —— composer 推理档位控件：**灯泡亮 = 该模型能切档位**（不是「探测过」），
  已声明档位的模型亮灯但禁用检测，`non-validating` 空灯且面板不谎称「尚未检测」，
  以及宿主 store 初值 `current: null` 时首帧不抛
- harness.ts —— 两类替身与三个助手：
  `useBrowserStubs`（全局 fetch / 定时器 / 环境变量）、`useTree`（React 树与卸载清理）、
  `signedIn` / `textOf` / `buttonLabels` / `clickText` / `expandDisclosure`

## 面板与浮层怎么测

控件的浮层 `createPortal` 到 `document.body`（composer 行会裁掉 `position: fixed`），
而本 lane 没有 DOM。做法是按文件 `vi.mock('react-dom')` 把 `createPortal` 换成直通，
并 `vi.stubGlobal('document', …)` 供原语的 `useDismissOnOutsidePointer` 挂监听 ——
`probe-control.spec.ts` 里的 `stubDocument()` 就是这两件事。断言读的是**渲染内容**
（用 `toJSON()` 取整棵树），不是 DOM 位置，所以直通不影响判据。

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