# 带图请求报 `Image request maxPixels must be a positive integer.` 的原因与修复

日期：2026-09-23
影响：**link 方式安装**（`dsh plugin add <本地仓库路径>`）的 dsh-workbuddy-connect，跑在 **DSH 0.1.5-rc 系内核**的宿主上（社区桌面 2.0.9、core15 web）——任何带图片的消息在发送前的图片预处理阶段即失败，切换模型无效。纯文本请求不受影响。
发现渠道：用户在社区桌面旧会话中复现（新会话发图同样必现）；随后在 core15 web（9002）用 1×1 PNG 独立复现，排除桌面特有因素。

## 1. 症状

- 旧会话：历史里有一张 9/17 粘贴的 webp，9/17–9/22 数十轮带图回放全部成功；**今天起每轮必报** `Image request maxPixels must be a positive integer. (UNKNOWN)`，请求未发往 WorkBuddy。
- 新会话：只发文字正常；**一发图立刻同样报错**。
- 会话内切换 workbuddy 的任何模型（glm-5.3 ↔ deepseek-v4.1-flash）无效——失败点在模型选择之前。

## 2. 证据链（怎么定位的）

1. **会话日志**（`~/.dsh/sessions/.../session.v3.jsonl.zstd`）：带图轮 9/17 16:09 → 9/22 20:20 全 OK；当天 02:38 起全 ERR，且桌面进程 `ps lstart` 显示 **02:39:06 重启**——变量是"重启后加载了新换的插件"。
2. **关键时间点**：同日 00:45 我把桌面 profile 的插件从 npm `0.5.2` 换成了指向本仓库的符号链接。npm 安装的包没有自带 node_modules；链接安装的包有（见 §3）。
3. **抛点**：`dsh-attachment-local` 的 `validatePolicy()`——`checkedInteger(policy.maxPixels, 'Image request maxPixels')`，仅当请求含图片时才走到。
4. **边界探针**（决定性）：用仓库构建 + core15 平台包在 Node 里直跑 adapter.stream，在 attachment 边界打印实际收到的 policy：`{"width":1,"height":1,"maxBytes":1048576}`——**没有 maxPixels**。
5. **契约差异**（比对三代源码）：
   - `dsh-attachment-local ≤ 0.1.5`：`readImageRequest(ref, policy)`，policy = `{maxPixels, maxBytes}`，`validatePolicy` 强制 maxPixels。
   - `dsh-llm-pi-ai ≤ 0.1.5`：policy 由 `profile.requestImagePixelBudget` 组装（旧形状）。
   - `0.1.6-alpha.2`：pi-ai 改传**逐图 target** `requestImageTarget(ref, budget)` = `{width, height, maxBytes}`（`prepareRequestImages`），attachment-local 改为 `validateTarget`（不再要求 maxPixels）。

## 3. 根因

**link 安装的插件，其平台包 import 按符号链接的真实路径解析，优先命中仓库自己的 node_modules（0.1.6-alpha.2 阵容），而 attachment 服务来自宿主（0.1.5）。**

即：本仓库构建的 adapter 运行时用的是 0.1.6-alpha.2 的 `PiAiAdapter` 类（它构造新契约 target），调用的是 0.1.5 宿主的 attachment 服务（它要求旧契约 policy）→ maxPixels 缺失 → 抛错。

为什么以前没事：桌面 profile 此前用 npm 0.5.2（发布形态，无自带依赖，全部解析到宿主包，0.1.5↔0.1.5 自洽）。为什么我们的三核冒烟没发现：冒烟只验证了注册/目录/状态路由/选择器，**从未发送过带图消息**。0.1.6 宿主（9001）上不发病：宿主 attachment 服务也是 0.1.6 新契约，两边一致。

顺带：npm 发布形态不受影响（无 node_modules，peer 由宿主提供）——这是 **link 开发安装形态 + 0.1.5 宿主** 的组合问题。

## 4. 修复

在 adapter 的 attachment 边界加**契约翻译**（`src/adapter.ts` 的 `withLegacyImageBudget`）：`resolveAttachments()` 返回的 store 经 Proxy 包装，`readImageRequest(ref, policy)` 发现 `policy.maxPixels` 不是安全正整数时，补上本路由自己的像素预算（`REQUEST_IMAGE_BUDGETS.requestImagePixelBudget` = 4,194,304，与 profile 内为 pi-ai 预算字段声明的值相同）再转发：

- 0.1.5 老 store：拿到必需的 maxPixels，按 `requestImageDimensions(ref.w, ref.h, maxPixels)` 算出的尺寸与 0.1.6 路径按同一预算算出的逐图 target 一致——**语义等价，不是猜测兜底**。
- 0.1.6 新 store：`validateTarget` 只读 width/height/maxBytes，多出的 maxPixels 键被忽略。
- 已带 maxPixels 的 policy 原样透传（未来若再有第三种契约，不二次加工）。

## 5. 测试与验证

- 回归测试（tests/adapter.spec.ts）：假 store 按 0.1.5 语义在校验失败时抛同文案错误、成功时断言收到的 maxPixels——驱动真实 `adapter.stream` 带图消息，断言走到 store 之后而非抛 maxPixels 错；另测带 maxPixels 时原样透传。
- core15 web（9002，修复前）：粘贴 1×1 PNG + 发送 → 100% 复现同错（修复的对照证据）。
- **社区桌面实测（修复后，2026-09-23 用户确认）**：重启 DSH Desktop（重新加载链接指向的新 lib）后，原报错会话恢复、带图请求正常发送——端到端通过。

## 6. 相关但不相同的问题

同会话 02:38 还出现过一条 `provider "workbuddy" model "deepseek-v4.1-flash" does not support reasoning effort "max"`——这是**预期行为**：旧会话持久化了 `reasoningEffort: max`（来自 settings 的 agent-default-model），切到未声明档位的模型后适配器如实拒绝。换回有声明的模型、或在会话里重选推理档位即可，与本次图片问题无关。

## 7. 教训（记给后续 review/开发）

- link 安装 = 用仓库 devDeps 的平台包跑在任意宿主上，**类型能过 ≠ 运行时契约一致**；跨代契约（本例：request-image policy → target）是 link 形态的固有风险点。
- 冒烟必须覆盖带图请求（这是 0.3.x 之后的既定功能面），本次补入验证清单。
