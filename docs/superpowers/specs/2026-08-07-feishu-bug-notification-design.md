# 飞书缺陷创建通知设计

## 背景

PongCode 当前创建缺陷后只返回缺陷数据，不会主动通知项目成员。需要接入飞书群自定义机器人，在缺陷创建成功后向项目对应群聊发送消息卡片，并 `@` 指派人。

本设计仅覆盖「创建缺陷」事件，不覆盖缺陷更新、状态变化、评论、工时或证据变更。

## 已确认决策

- 机器人配置仅维护在**项目级**，不继承团队配置。
- 缺陷先成功入库，再**同步、尽力推送**飞书。
- 推送失败不回滚缺陷，也不改变创建缺陷接口的成功响应。
- 使用飞书**消息卡片**（`interactive`），描述最多展示 300 字纯文本摘要。
- 指派人用 User 表中的 **email** 进行卡片 `@`；无指派则显示「未指派」且不 `@`。
- Webhook 和签名密钥在数据库中明文保存，但所有 API 和日志均不得返回原值。
- 管理界面放在**编辑项目弹窗**，脱敏展示配置状态，并支持发送测试消息。
- 配置使用**独立 feishu-bot API**，不并入通用 `update_project`。
- 首版不实现可靠消息队列、自动重试、通知历史、团队级配置。

## 架构

### 项目配置

在 `Project` 增加两个可空的 `db.Text` 字段：

- `feishu_webhook_url`
- `feishu_webhook_secret`

Webhook 为空表示未启用飞书通知，不另设启用开关。`secret` 可为空（机器人未开启签名校验时）。

`Project.to_dict()` 只增加 `feishu_bot_configured: boolean`（Webhook 已配置即为 `true`），不得包含 Webhook、密钥或可还原这些值的信息。

数据库中的未配置值统一为 `NULL`。PUT 请求中的配置字段若出现，值必须是字符串；`null`、数字、数组或对象均返回 400。字符串先去除首尾空白，处理后为空（包括 `""` 和纯空白字符串）也返回 400，而不是保留、替换或删除。

历史数据库通过 `apps/api/app.py` 中现有的 `ensure_*_schema()` 模式补列；新数据库继续由 `db.create_all()` 建表。

### 推送服务

新增独立的 `apps/api/services/feishu_bot.py`，负责：

1. 校验飞书 Webhook 白名单。
2. 使用时间戳和密钥生成签名（有密钥时）。
3. 构建缺陷通知卡片和测试卡片（含指派人 email `@`）。
4. 以 3 秒整体调用期限访问飞书 Webhook；HTTP 客户端不得把连接和读取分别配置成两个完整的 3 秒等待。
5. 校验 HTTP 状态及响应 JSON 中的 `code == 0`。
6. 将外部调用错误转换为不包含凭据的领域错误。

缺陷路由只负责在数据库提交成功后调用该服务，不在路由中维护签名、卡片或 HTTP 细节。

出站 HTTP 使用 `httpx`（需加入 `apps/api/requirements.txt`），便于设置整体超时与测试 mock。

## API 设计

以下配置接口均要求当前用户是项目所属组织的 Owner 或 Admin。

### 获取配置状态

`GET /api/projects/{project_id}/feishu-bot`

响应：

```json
{
  "enabled": true,
  "webhook_masked": "https://open.feishu.cn/open-apis/bot/v2/hook/****abcd",
  "secret_configured": true
}
```

未配置时，`enabled` 和 `secret_configured` 为 `false`，`webhook_masked` 为 `null`。接口绝不返回 Webhook 或密钥原值。

### 保存或替换配置

`PUT /api/projects/{project_id}/feishu-bot`

请求体可包含：

```json
{
  "webhook_url": "https://open.feishu.cn/open-apis/bot/v2/hook/...",
  "secret": "..."
}
```

字段语义：

- 字段缺省：保留数据库中的现有值。
- `webhook_url` 提供非空值：校验后替换。
- `secret` 提供非空值：替换。
- 首次配置必须提供有效 Webhook。
- 显式传入空字符串、纯空白字符串、`null` 或非字符串值：返回 400。
- 清空使用专门的 DELETE 接口。

响应与 GET 相同，只返回脱敏状态。

### 清空配置

`DELETE /api/projects/{project_id}/feishu-bot`

同时清空 Webhook 和密钥，返回：

```json
{
  "success": true
}
```

### 发送测试消息

`POST /api/projects/{project_id}/feishu-bot/test`

仅使用已保存的配置发送带有「测试消息」标识的卡片，不创建或修改业务数据。未配置时返回 400；飞书调用失败时返回 502，并提供不包含凭据的可读错误。

## 缺陷创建通知流程

`POST /api/projects/{project_id}/bugs` 保持当前校验和持久化行为：

1. 校验缺陷字段并分配缺陷编号。
2. 写入数据库并提交。
3. 若项目未配置 Webhook，直接返回现有 `201` 响应。
4. 若已配置，构建卡片并同步调用飞书，整体调用期限为 3 秒。
5. 推送成功、预期外部错误或通知代码自身的意外异常均返回现有缺陷 `201` 响应。
6. 失败时记录脱敏日志，供服务端排查。

只有实际创建成功的缺陷会触发通知。字段校验失败、权限失败或数据库提交失败均不会推送。

## 签名

配置密钥时，使用当前秒级 Unix 时间戳：

```python
string_to_sign = f"{timestamp}\n{secret}"
sign = base64.b64encode(
    hmac.new(string_to_sign.encode("utf-8"), digestmod=hashlib.sha256).digest()
).decode("utf-8")
```

说明：与飞书官方 Python 示例一致——`hmac.new` 的第一个参数为 key（`timestamp\nsecret`），消息体为空。

请求体携带字符串形式的 `timestamp` 和 `sign`。未配置密钥时不携带这两个字段。

## 消息卡片

请求使用 `msg_type: "interactive"`。标题等无需富文本能力的动态业务字段优先放入 `plain_text` 节点；需要 Markdown 布局的正文必须转义用户输入，不能让缺陷内容注入卡片结构或链接。

卡片标题：

`新缺陷：{item_code 或 BUG-{id}} {title}`

卡片内容：

- 项目
- 严重程度
- 优先级
- 缺陷类型
- 平台
- 创建人
- 指派人：有 `assignee.email` 时使用卡片 Markdown `<at email="{email}"></at>`（可附展示名）；无指派时显示「未指派」且不 `@`
- 创建时间
- 缺陷描述的纯文本摘要，最多 300 个字符

卡片底部提供「查看项目缺陷」按钮，跳转到：

`{APP_BASE_URL}/organizations/{organization_id}/projects/{project_id}/bugs`

当前前端没有根据缺陷 ID 自动打开详情弹窗的路由能力，因此首版只跳转到项目缺陷列表，不声称提供单缺陷深链。

构建消息时需要限制和转义动态文本，保证整个请求体明显低于飞书 20 KB 限制。

测试卡片：标识为「测试消息」，含项目名与当前操作者信息，不创建业务数据。

## 前端交互

在现有「编辑项目」弹窗（`project-dialog.vue`）中增加「飞书缺陷通知」区域：

- 展示「未配置」或「已配置」状态。
- 已配置时只展示脱敏 Webhook 和「签名密钥已配置」状态。
- Webhook 和密钥输入框默认为空，留空表示保留现值。
- 提供「保存配置」「发送测试消息」「清空配置」操作。
- 清空前需要二次确认。
- 测试按钮仅在配置已保存后可用。
- 保存或测试期间禁用重复提交，并使用现有 Element Plus 消息反馈模式。
- 通过独立 API 模块（如 `apps/web/src/api/feishu-bot.ts`）调用，不并入 `updateProject`。

普通项目成员不显示配置编辑入口。通用项目数据中的 `feishu_bot_configured` 仅用于展示状态，不代表配置管理权限。

## 安全

Webhook 只接受以下形式：

- Scheme 必须是 `https`。
- Host 必须精确为 `open.feishu.cn`。
- 不允许自定义端口、用户信息、query 或 fragment。
- Path 必须匹配 `/open-apis/bot/v2/hook/{非空 token}`。

该白名单用于阻止 SSRF 和误配。若未来需要支持飞书国际版域名，应通过明确的允许列表扩展，不接受任意域名。

日志可记录项目 ID、缺陷 ID、HTTP 状态、飞书错误码和截断后的错误摘要，但不得记录：

- 完整或脱敏前 Webhook
- 密钥
- 签名
- 完整请求体

数据库明文存储是本期已接受风险：数据库、备份或高权限只读账号泄露时，凭据会一并泄露。后续可在不改变 API 的前提下迁移为独立环境密钥加密存储。

## 错误处理

- 缺陷创建推送：所有网络错误、超时、非 2xx、无效 JSON、飞书非零业务码只记录日志，不影响缺陷创建结果。
- 测试推送：上述错误返回 502，便于管理员发现签名、IP 白名单、自定义关键词、限流或网络问题。
- 配置校验：非法 Webhook 返回 400。
- 未授权配置操作：返回 403。
- 未配置时测试：返回 400。

错误响应和日志都必须经过脱敏，外部响应内容需要截断后再记录或返回。

## 契约与测试

同步更新 `packages/api-contract/openapi.yaml`，并刷新生成的 TypeScript 类型。

后端测试至少覆盖：

- 固定时间戳下的签名结果。
- 有密钥和无密钥的请求体。
- Webhook 允许列表及恶意 URL 拒绝。
- 卡片字段、动态文本转义、300 字摘要截断，以及指派人 email `@` / 未指派文案。
- 推送成功、超时、HTTP 错误、无效 JSON、飞书业务错误。
- 配置接口的 Owner/Admin 权限和普通成员拒绝。
- 获取配置时脱敏，保存时保留/替换语义，清空配置。
- 测试消息成功和失败响应。
- 未配置项目不调用飞书。
- 飞书失败时缺陷仍持久化且接口返回 201。
- 通知服务抛出非预期异常时缺陷仍持久化且接口返回 201。
- 历史 `project` 表补列后配置字段存在且默认未配置。

前端测试至少覆盖：

- 未配置和已配置状态。
- 不回显原始 Webhook 和密钥。
- 留空保留、替换、清空和二次确认。
- 保存和测试期间按钮状态。
- 成功与失败消息反馈。

## 非目标与后续演进

首版不实现：

- 团队级配置或项目继承。
- 缺陷更新等其他事件通知。
- 自动重试、Outbox、消息队列和通知历史。
- 飞书 Open ID 映射或自建应用换号。
- 单缺陷详情深链。
- 数据库字段加密。
- 首次证据/截图进入创建通知（创建与上传证据是两次请求）。

如果后续出现「创建接口延迟明显」「消息不能丢失」或「需要审计重试」的要求，应引入 Outbox 事件表和独立 worker，而不是使用 Gunicorn 进程内后台线程。

若线上验证发现自定义机器人对 `<at email>` 不生效，再评估改为维护 Open ID 或接入自建应用反查，不在首版扩大范围。
