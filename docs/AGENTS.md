# docs/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

docs/ 特有约束：

- 动笔前先给文件归层（活 / 记录），并登记进 [README.md](README.md) 的表 —— 层决定它能不能被改。
- **活文档随代码走**：改了对外行为，同一次改动内同步 [ARCHITECTURE.md](ARCHITECTURE.md) 与 [PUBLISHING.md](PUBLISHING.md)。
- **记录不追改**：[archive/](archive/) 写的是当时的事实，**包名、仓名、路径一律保持当时的样子**；批量改名或清扫不许扫进这一层。结论变了新写一条[决策记录](../.agents/notes/)，在那里说明替代了什么。
- **活文档不抄会漂的值**：宿主版本范围、dist-tag 实际版本、测试数量一律写指针或现查命令。
- 一份事实一个 home：别的文档要讲同一件事时写指针，不重抄内容。
- **平台契约只从实装宿主读**，判据命令见 [PUBLISHING.md](PUBLISHING.md) 的「平台契约的取真源方式」；注册一个槽之前先查它的 `kind` 有没有占用者。
- 链接一律相对路径；改完跑一次链接校验（命令见根 [AGENTS.md](../AGENTS.md) 的「常用命令」）。
- 不写本机路径、端口、profile 名与用户名 —— 用占位符。
