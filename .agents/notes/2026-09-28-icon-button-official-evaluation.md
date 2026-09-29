# 决策：probe-control 图标触发器不换官方 Button（评估结论：不值得改）

状态：生效
日期：2026-09-28

## 评估对象

- `src/client/probe-control.tsx:350-362`（弹层触发器按钮）
- `src/client/probe-control.module.css:20-64`（触发器几何与皮肤）

## 结论

**不值得改。** 换成官方 `Button variant="ghost" size="sm"` 是可见回退，不是趋同。
本仓维持 0.2.0，不发版。

## 理由

1. 官方 `@deepseek-ai/dsh-client-ui-primitives`（本仓实装 0.1.7-rc.2）**没有 IconButton 导出**。
2. 唯一能贴的官方 Button 实测：高 28px、`padding: 0 10px`、`border-radius: var(--dsw-radius-sm)` ——
   是个 ~40×28 的圆角矩形，图标一级墨，disabled 是 `opacity: 0.4`。
3. 当前实现是 28×28 **正圆**、二级墨图标、disabled 按 `--dsw-alias-label-dimmed` 令牌降暗
   （不用 opacity）、focus 环走宿主 `--dsw-focus-ring-*` 令牌、aria 齐全
   （`aria-label/aria-busy/aria-expanded`），外包官方 `Tooltip`。它本身就是
   「官方没导出时按官方几何 refork」的正确做法（值对值抄宿主 sidebar `.iconButton`）。
4. 该用官方 Button 的地方已经用了：popover 里的「Detect」主按钮本就是
   `<Button size="sm" variant="primary">`。
5. 改动风险 > 收益：控件嵌在宿主 composer chrome 里，挂 Tooltip / popover 锚点 / rootRef。

## 条件性待办

等 `@deepseek-ai/dsh-client-ui-primitives` 导出 IconButton 或 icon-only 按钮时，
重新评估此处是否可直通转发。

## 其他待办

- settings-card 截图待补（本仓无截图变更，仅登记）。
- 版本维持 0.2.0，不改代码，不发版。
- 跨仓对照：zhihu 已发 2.0.1、ds-balance 已发 2.1.2，两仓的设置卡片控件已换官方 primitives；
  本仓评估后维持现状。
