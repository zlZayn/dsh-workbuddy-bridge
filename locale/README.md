# locale/ — 包展示元数据

- 职责：宿主直读的**包展示元数据**（插件页上的标题与一句话说明）。
  不是插件界面文案 —— 那在 [../src/client/locales.ts](../src/client/locales.ts)，运行时经 `ctx.locale` 注册。
- `en.json`：`meta.title` + `meta.description` 的英文。宿主先解析这一份，它不在就不会读其他语言文件。
- `zh.json`：同一键集的中文。
- 生效条件：随包发布（`package.json` 的 `files` 收了 `locale/*.json`），宿主从 `<包名>/locale/<语言>.json` 读；
  不进 `lib/`，本仓代码一个字节都不读它。
- 被谁依赖：宿主插件页；发布面断言在 [../scripts/check-release.mjs](../scripts/check-release.mjs)。
- 回落链、字段形状、改动波及面（规则层）→ 见 [AGENTS.md](AGENTS.md)
