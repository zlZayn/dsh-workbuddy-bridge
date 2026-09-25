# 决策：推理等级控件注回 conversation.input.right（2026-09-25）

已实施。

## 问题

启用本插件后，聊天输入框的**模型选择控件整块消失**（不是变灰）。

同一个接缝此前已经翻过一次车：提交 `219a7ff` 把控件从 `conversation.input.right` 改注到 `conversation.input.model`，
理由写着「`.right` 不存在，注册它会抛 React #130」。

## 决策

本插件的客户端半只注册两处：

- `plugins.bundle.config`：插件详情页的配置表单与两张卡片。
- `conversation.input.right`：输入区紧凑控件行，宿主把它渲染在**自己模型选择器的左边**。

判据是宿主自带的**机器可读槽目录**（`dsh-cordis-client-runner/lib/client.js`）：

| 槽 | kind | 已有占用者 | replaceRisk |
|---|---|---|---|
| `conversation.input.model` | `single` | `client-ui-model-selection ModelSelect` | `shadows-shipped-ui` |
| `conversation.input.right` | `list` | 无 | `none` |

`single` 槽的注册规则（`dsh-client-ui-slots/lib/index.js` 的 `register`）：
同一 priority 再注册**抛错**，抛出方是后注册的那个；最低 priority 渲染。

所以占 `.model` 的结果必然是二选一：本控件注册失败，或**宿主模型选择器注册失败**。
后者正是观察到的现象 —— 输入区那一格空了。

换到 `list` 槽后：带自己的 `id` 就是独立一格，与宿主选择器并列，互不遮蔽。

## 替代方案

- 留在 `.model`，用更低的 priority 抢位：**会永久顶掉宿主的模型选择器**，等于把缺陷做成设计。否决。
- 留在 `.model`，用更高的 priority：合法但永远被遮蔽，控件不再出现。等于删功能。否决。
- 换 `conversation.input.left`：同样是 `list`、同样空，但渲染在工具行另一侧；`.right` 紧邻模型选择器，语义与视觉都更贴。否决（位置次优）。
- 撤出输入区，只留详情页：功能可用但少一个就地入口；与「检测结果就出现在模型下拉里」这条就近原则不符。否决（本轮不做）。

## 影响

- 输入区多一个与模型选择器并列的紧凑控件；宿主选择器不再被顶掉。
- 平台契约的取真源方式补了「kind / 占用者」两步，见 [docs/PUBLISHING.md](../../docs/PUBLISHING.md) 的「平台契约的取真源方式」。
- 回归风险由「注进 `single` 槽就会静默顶掉宿主 UI」这一条钉住：改槽名前必须先查 kind。

## 关联

[src/client/index.tsx](../../src/client/index.tsx) · [docs/PUBLISHING.md](../../docs/PUBLISHING.md) · [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
