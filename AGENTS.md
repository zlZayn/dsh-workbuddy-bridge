# dsh-workbuddy-bridge — 维护索引

## 全局规则

- 架构与设计决策 → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 子树手册 → [src/README.md](src/README.md)、[tests/README.md](tests/README.md)、[scripts/README.md](scripts/README.md)
- 决策记录 → [.agents/notes/](.agents/notes/)
- 来源与双版权 → [NOTICE](NOTICE)；许可证 → [LICENSE](LICENSE)
- 发布手册（发版流程、版本号语义、平台契约取真源方式）→ [docs/PUBLISHING.md](docs/PUBLISHING.md)

## 常用命令（本机实测）

- 装依赖：`pnpm install --config.node-linker=hoisted`
- 全量检查（**顺序固定，build 必须在 test 之前**）：`tsc --noEmit` → `tsdown`（重建 `lib/`）→ `vitest run`
  - `tests/version.spec.ts` 断言 `lib/` 产物里的版本与包一致，先跑测试会红（刻意设计）
- `node_modules/.bin` 为空时按直接路径跑：`node node_modules/typescript/bin/tsc --noEmit`、`node node_modules/tsdown/dist/run.mjs`、`node node_modules/vitest/vitest.mjs run`
- `lib/` 是**被跟踪的产物**：改源码后重建并连同源码一起提交

## 验证快照（2026-09-25 本机实跑）

- `tsc --noEmit` rc=0
- `vitest` 28 files passed / 374 passed | 8 skipped (382)
- 链接校验 41 files / 118 links / 0 errors / 0 warnings
- 8 条 skipped 是 Windows 与 POSIX 的语义差（权限位、EACCES 注入、XDG/WSL 路径、跨进程启动时间），非逻辑缺陷

## 待办

- [ ] 根 README 门面按维护者规范重写（双语同改）；`docs/`、`assets/` 补双件
- [ ] 补发布态不变量：`engines.dsh`、`scripts/check-release.mjs` + `check:release` 脚本
- [ ] 移植红线用例（含「活文档不抄实测值」守卫）
- [ ] 补仓内基建：`.github/workflows/ci.yml`、`.gitattributes`、`icon.svg` + `locale/*.json`
- [ ] 客户端 i18n 对齐 `dsh-ds-balance` 的扁平键 + 插值形态
- [ ] 首次发布 `0.1.0` 并回填发布态

## 活跃坑

- **槽的 `kind` 决定能不能注册**：`kind: 'single'` 的槽一格只能有一个占用者 —— 同 priority 再注册会抛错，而**抛出方是后注册的那一个**（宿主自带 UI 会因此消失）；要并排只能选 `kind: 'list'` 的槽。判据与先例见 [docs/PUBLISHING.md](docs/PUBLISHING.md) 的「平台契约的取真源方式」
- **pnpm 11 的 symlink 链接器在本机会卡死**（343 个包已就位却搭不出 `node_modules`）→ 一律加 `--config.node-linker=hoisted`
- `node_modules/.bin` 可能为空 → 按上面的直接路径调用工具
- `Rename-Item` 对正在被 install/build 占用的目录会失败 → 改名前先确认无相关进程