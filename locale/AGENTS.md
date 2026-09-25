# locale/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

这里放的**不是插件界面的文案**（那是 [src/client/locales.ts](../src/client/locales.ts)，运行时经 `ctx.locale` 注册），
而是**包的展示元数据**：插件页上那个标题、那句话说明，以及 `package.json` 里声明的图标。

## 为什么在这里而不是在代码里

- 这两份 JSON 由**宿主直接读**（从 `<包名>/locale/en.json` 起头，再枚举同目录下的 `*.json`），
  **我们的代码一个字节都不读它**，它也不进 `lib/`。想改插件页上显示什么，只有这一处可改。
- 读不到或读坏了的信号是**静默**的：宿主按「缺字段」回落，界面照常渲染，只是显示成了包名或
  `package.json` 的 `description`。唯一的保护是断言 —— 发布面在
  [../scripts/check-release.mjs](../scripts/check-release.mjs)（键集、`files` 覆盖与 icon 那几条都在它里面）。

## 回落链（逐字段独立）

- **标题**：本目录的 `meta.title` → `package.json` 的 `name` → 完整 Cordis 名。
- **描述**：本目录的 `meta.description` → `package.json` 的 `description` → 不显示。
- **图标**：`package.json` 的 `icon`（相对清单目录、必须在包内、自包含、≤256 KiB）。
  本包声明的是包根的 [icon.svg](../icon.svg) —— 与输入区那个检测控件**同一个图形**
  （`src/client/probe-control.tsx` 的 `ProbeIcon`）：外环 + 内环 + 一条指向右上的斜线 + 圆心一点。
  几何与选色依据写在文件头的注释里。

## 硬约束

- **`en.json` 是发现入口**：宿主先解析它；它不在，其余语言文件根本不会被读。
- **文件名就是语言 id**（`en` / `zh` / `zh-CN` 这种形状）。
- **只放 `*.json`**：宿主会枚举这个目录下每一个 `.json` 并逐个解析。
- **字段只有 `meta.title` 与 `meta.description`**，值必须是**非空字符串**。
- **中英两份的键集必须逐字相同**：少一个字段只会在那种语言下露出另一种语言。
- 标题两版**故意相同**（`DSH WorkBuddy Bridge`）：它与插件卡片自己的标题逐字一致，
  改这里就要同批改 [src/client/locales.ts](../src/client/locales.ts) 的 `title`，否则同一页上会出现两个名字。

## 改这里的文案要顺带查

- 门面 [README.md](../README.md) / [README_en.md](../README_en.md) 里点名插件的地方 —— 红线钉着逐字一致。
- [assets/AGENTS.md](../assets/AGENTS.md) 的「什么时候必须重截」：插件页上的标题与描述**画在图上**，
  所以改了这两份 JSON，卡片相关的图都要重拍。
