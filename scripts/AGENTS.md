# scripts/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

scripts/ 特有约束：

- 改动前后跑与本目录相关的 spec，路由见 [README.md](README.md)
- **真机脚本的输出只到控制台，不落盘**（2026-10-03 起）。
  控制台输出是「跑过什么」的记录；落盘会把它变成一份没人管、也不知道该不该删的副本。
  需要临时文件时用 `mkdtemp(tmpdir())`，并在 `finally` 里 `rm` —— 见
  [verify-shim-hardening.mjs](verify-shim-hardening.mjs) 与 [issue-48-forced-fallback-e2e.mjs](issue-48-forced-fallback-e2e.mjs)。
- **尤其不许把凭据写进 `~/.dsh/`**：`WorkBuddyCredentialStore` 会把解析出的凭据持久化到它的
  `ownPath`，所以给真机脚本传 `ownPath` 时必须传一个跑完就删的临时路径。
  旧写法把真 token 写进 `~/.dsh/.workbuddy-e2e-check.json` 且从不删除 —— 那个名字看起来还像插件自己的文件。
- **平台前提要自己说**：跑不了的那条打 `SKIP …` 并 `exit 0`，别让它崩成模块错误或断言失败 ——
  「这个平台没有这条链」和「脚本坏了」是两件事，读的人必须能一眼分开。
- **没跑过就不许在 Release notes 里声称验过**（判据见 [docs/PUBLISHING.md](../docs/PUBLISHING.md) 第 5 条）。
