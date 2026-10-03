# scripts/ — 文件索引

职责：见 [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)

四个脚本都是**真机 / 一次性**工具，不在离线套件里。三条进 [docs/PUBLISHING.md](../docs/PUBLISHING.md) 的「发版前确认」，
它们验的是托管 runner 上验不了的那一段。

| 脚本 | 做什么 | 何时跑 | 平台 | 前提 |
|---|---|---|---|---|
| `live-e2e.mjs` | 适配器 → pi-ai → shim → 真实上游的端到端，并读一次余额 | 发版前；改协议 / 适配器 / shim 后 | 任意 | 先 `build`；本机已登录；会花掉少量积分 |
| `client-identity-live-matrix.mjs` | 客户端身份矩阵（chat / tool / probe / baseline，各打各的判定） | 发版前；改 UA / 请求头 / 身份解析后 | 任意 | 先 `build`；凭据经 `WorkBuddyCredentialStore` 取（含 at-rest 解密） |
| `issue-48-forced-fallback-e2e.mjs` | 强制 fallback 的真发现链（真 `mdfind` / `plutil` / helper spawn） | 发版前 | **仅 macOS** | 先 `build`；本机 App 在标准位置 |
| `verify-shim-hardening.mjs` | loopback shim 的加固面（离线可跑） | 改 shim 后 | 任意 | —— |

三条真机脚本的**平台前提会自己说**：跑不了的那条打 `SKIP …` 并 `exit 0`，不伪装成通过。
`client-identity-live-matrix.mjs` 里**未登录的产品**同样按 `SKIP` 记 —— 两个产品是各自独立的安装，
本机只登录一个是正常状态，结尾会列出跳过了哪些。

一条判据：**没跑过就不许在 Release notes 里声称验过**（尤其 macOS 自动发现，见 PUBLISHING 第 5 条）。

变更影响路由：改本目录 → 同步根 [AGENTS.md](../AGENTS.md) 的待办与活跃坑；设计变化写 [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)