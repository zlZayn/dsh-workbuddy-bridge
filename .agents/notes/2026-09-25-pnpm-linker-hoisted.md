# 坑：pnpm 11 的 symlink 链接器在本机卡死（2026-09-25）

已实施（绕过）。

## 现象

`pnpm install` 把 343 个包装进 `node_modules/.pnpm` 后停在 `added 36~40` 不动，多次重启都停在同一区间；加 `--ignore-scripts` 无效（排除 postinstall 卡死）；日志一直是 `reused 343 / downloaded 0`（排除网络因素）。此时仓库近乎不可用：`node_modules` 顶层只有 1 个条目、`.bin` 为空。

## 决策

装依赖一律用 `pnpm install --config.node-linker=hoisted`。不改依赖版本、不改 lockfile、不换包管理器。

## 替代方案

- 换包管理器（npm/bun）：规范禁止为尝新切换已有稳定锁文件的项目
- 逐个删除可疑包重装：未定位到具体包，成本高且不可复现
- 加 `--force`：不改变链接器，无效

## 影响

- `node_modules` 是扁平树（不是 pnpm 的符号链接布局）
- `node_modules/.bin` 可能为空；此时按直接路径调用工具，例如
  `node node_modules/typescript/bin/tsc --noEmit`、`node node_modules/vitest/vitest.mjs run`、`node node_modules/tsdown/dist/run.mjs`

## 关联

根 [AGENTS.md](../../AGENTS.md) 的「常用命令」与「活跃坑」