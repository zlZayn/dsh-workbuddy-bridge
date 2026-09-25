# docs/ — 文档层索引

- 职责：面向开发者的辅助文档；用户视角见根 [README.md](../README.md)，规则与仪表盘见根 [AGENTS.md](../AGENTS.md)。
- 在这里工作要遵守什么 → [AGENTS.md](AGENTS.md)。

## 文件的层

层决定它能不能被改（判据见 [AGENTS.md](AGENTS.md)）：**活** 随代码走，**记录** 不追改。

| 文件 | 层 | 内容 |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 活 | 结构、数据流、契约与兼容性契约、防错清单（“为什么”） |
| [PUBLISHING.md](PUBLISHING.md) | 活 | 发版流程、版本号语义、平台契约的取真源方式 |
| [archive/](archive/) | 记录 | 已完成的一次性记录（交接文档、按日期命名的排查与实现计划）—— **只读** |

## archive/ 的读法

- 里面写的是**当时的事实**：包名、仓名、路径、版本号都停留在那一轮，**不回填、不追改**。
- 本仓由 `dsh-workbuddy-connect` 重做而来，所以 `archive/` 里出现旧包名是**对的**；改成新名等于篡改证据 —— 2026-09-25 的一次批量改名清扫扫进了这一层（7 份文件、28 行），逐字回滚的过程记在 `git log` 里。
- 结论如果变了，新写一条[决策记录](../.agents/notes/)，在那里说明替代了什么，**不动这里**。

## 别处

- 决策记录（为什么这样设计、替代方案）→ [.agents/notes/](../.agents/notes/)
- 源码手册 → [src/README.md](../src/README.md)；测试手册 → [tests/README.md](../tests/README.md)
