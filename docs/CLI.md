# CLI — 不开界面也能查

`dsh-workbuddy-bridge` 自带一个命令行入口（`lib/bin.js`，经 `dsh plugin exec` 调用），
用于在没有浏览器的情况下确认插件状态。它读的是与卡片同一份状态文档，**不做任何写操作**。

## 用法

```sh
dsh plugin --profile web exec dsh-workbuddy-bridge status          # 登录状态与剩余积分
dsh plugin --profile web exec dsh-workbuddy-bridge status --json   # 机器可读
dsh plugin --profile web exec dsh-workbuddy-bridge doctor          # 诊断 App 发现与凭据
dsh plugin --profile web exec dsh-workbuddy-bridge logout          # 清理插件自留的凭据副本
```

- 默认操作国内版；加 `--provider workbuddy-ai` 操作国际版。
- `logout` 只删插件自留的那份副本，**不动桌面 App 自己的登录**。
- `--profile` 按实际装法替换（`web` / `desktop` / `dsh-tui`）。

## 什么时候用

- 浏览器打不开、或想在不进 GUI 的情况下确认凭据是否被识别 —— 用 `status`。
- 插件页空着、模型分组没出现 —— 用 `doctor`，它逐条报告 App 发现路径与凭据读取结果。
- 换机 / 卸载前 —— 用 `logout` 清理本机副本。

## 关联

- 状态文档的字段含义 → [ARCHITECTURE.md](ARCHITECTURE.md)
- 平台支持与凭据路径 → [COMPATIBILITY.md](COMPATIBILITY.md)
