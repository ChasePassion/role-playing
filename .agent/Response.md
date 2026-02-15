## 1）固定成功响应体结构

```json
{
  "code": "ok",
  "message": "ok",
  "status": 200,
  "data": {}
}
```

要求：
- HTTP status = body.status（必须一致）
- status：必须是整数，且 等于 HTTP 状态码
- code：成功固定 "ok"（snake_case，小写，稳定）
- message：默认 "ok"（成功尽量别塞业务文案，保持稳定）
- data：业务数据（对象/数组/分页对象等）
- 204 No Content：不返回 body（或者返回也行，但不推荐；既然用 204 就干净点）

## 2) 固定错误响应体结构

```json
{ "code": "xxx", "message": "xxx", "status": 400 }
```

要求：
- HTTP status = body.status（必须一致）
- `code`：snake_case 字符串
- `status`：整数（标准 HTTP 状态码）
- `message`：字符串，格式：`主题:说明;关键信息1=…;关键信息2=…`

---

## 3) HTTP Status 语义表（NeuraChar）

| Status | 语义 | 典型场景 | code |
|--------|------|----------|------|
| 400 | 请求不合法（业务规则） | 验证码错误、更新资料未提供字段 | `invalid_param` |
| 401 | 未认证 | token 缺失、无效、过期 | `unauthorized` |
| 403 | 已认证但无权限 | 访问私有角色、`user_id` 与登录用户不一致 | `forbidden` |
| 404 | 资源不存在 | `character_id`/`memory_id` 不存在 | `{entity}_not_found` |
| 409 | 资源冲突 | 唯一键冲突、幂等冲突、状态冲突 | `{entity}_{field}_duplicate` / `{entity}_conflict` |
| 413 | 请求体过大 | 上传文件超过 5MB | `upload_file_too_large` |
| 415 | 媒体类型不支持 | 上传了非允许图片类型 | `upload_file_type_not_allowed` |
| 422 | 结构化参数校验失败 | Pydantic 字段校验失败、枚举值非法 | `validation_failed` |
| 429 | 频率或配额限制 | 登录验证码发送过频、聊天请求过频 | `too_many_requests` |
| 500 | 内部错误 | 未捕获异常 | `internal_error` |
| 502 | 上游依赖异常 | LLM 调用失败 | `llm_service_error` / `external_error` |
| 503 | 依赖不可用 | DB/Milvus 不可连接 | `db_connection_error` |
| 504 | 上游超时 | LLM / 向量库调用超时 | `external_timeout` |

约束：
- HTTP status 必须与 `body.status` 一致。
- `204 No Content` 不返回 body。
- `422` 用于模型层字段校验错误，`400` 用于业务规则校验错误。
- `/v1/chat` 为 SSE；流式过程中出错时返回 `type=error` 事件，建议携带 `code`。

---

## 4) 项目错误码表

### 4.1 通用错误码

| code | status | 含义 | 触发位置 |
|------|--------|------|----------|
| `invalid_param` | 400 | 业务参数不合法 | routers/services |
| `validation_failed` | 422 | 请求参数结构校验失败 | FastAPI/Pydantic |
| `unauthorized` | 401 | 未登录或凭证无效 | auth deps |
| `forbidden` | 403 | 无权限访问或操作 | routers/services |
| `too_many_requests` | 429 | 触发限流或配额 | gateway/service |
| `internal_error` | 500 | 未知内部异常 | global exception handler |

### 4.2 认证与用户（auth/users）

| code | status | 含义 | API |
|------|--------|------|-----|
| `auth_send_code_failed` | 500 | 验证码发送失败 | `POST /v1/auth/send_code` |
| `auth_code_invalid_or_expired` | 400 | 验证码无效或过期 | `POST /v1/auth/login` |
| `auth_token_invalid` | 401 | token 解析失败或用户不存在 | auth deps |
| `user_profile_update_empty` | 400 | 更新资料时未提供任何字段 | `PUT /v1/users/me` |
| `user_username_invalid` | 422 | 用户名不满足长度约束 | `PUT /v1/users/me` |

### 4.3 角色（characters）

| code | status | 含义 | API |
|------|--------|------|-----|
| `character_not_found` | 404 | 角色不存在 | `GET/PUT/DELETE /v1/characters/{character_id}` |
| `character_private_forbidden` | 403 | 非创建者访问私有角色 | `GET /v1/characters/{character_id}` |
| `character_modify_forbidden` | 403 | 非创建者修改角色 | `PUT /v1/characters/{character_id}` |
| `character_delete_forbidden` | 403 | 非创建者删除角色 | `DELETE /v1/characters/{character_id}` |
| `character_tags_invalid` | 422 | tags 数量或长度不合法 | `POST/PUT /v1/characters` |
| `character_visibility_invalid` | 422 | visibility 枚举非法 | `POST/PUT /v1/characters` |
| `character_identifier_duplicate` | 409 | 角色唯一标识冲突（预留） | characters domain |

### 4.4 文件上传（upload）

| code | status | 含义 | API |
|------|--------|------|-----|
| `upload_file_too_large` | 413 | 文件超过 5MB 限制 | `POST /v1/upload` |
| `upload_file_type_not_allowed` | 415 | 文件 MIME 类型不允许 | `POST /v1/upload` |
| `upload_failed` | 500 | 存储层上传失败 | `POST /v1/upload` |

### 4.5 聊天与记忆（chat/memories）

| code | status | 含义 | API |
|------|--------|------|-----|
| `chat_user_mismatch_forbidden` | 403 | 请求 `user_id` 与登录用户不一致 | `POST /v1/chat` |
| `chat_stream_failed` | 500 | 流式对话内部异常 | `POST /v1/chat` |
| `memory_not_found` | 404 | 指定记忆不存在 | `DELETE /v1/memories/{memory_id}` |
| `memory_manage_failed` | 500 | 记忆管理流程失败 | `POST /v1/memories/manage` |
| `memory_search_failed` | 500 | 记忆检索失败 | `POST /v1/memories/search` |
| `memory_reset_failed` | 500 | 记忆重置失败 | `DELETE /v1/memories/reset` |
| `memory_consolidate_failed` | 500 | 记忆归并失败 | `POST /v1/memories/consolidate` |

### 4.6 基础设施与外部依赖（infra/external）

| code | status | 含义 | 触发位置 |
|------|--------|------|----------|
| `db_connection_error` | 503 | 数据库或 Milvus 连接失败 | db/milvus init |
| `llm_service_error` | 502 | LLM 服务调用失败 | llm client |
| `external_error` | 502 | 外部依赖调用异常 | integrations |
| `external_timeout` | 504 | 外部依赖调用超时 | integrations |

---

## 5) 命名空间和命名规则（NeuraChar）

命名空间建议：
- `common`
- `auth`
- `user`
- `character`
- `upload`
- `chat`
- `memory`
- `infra`

`code` 命名规则：
- 全小写，`snake_case`，发布后尽量稳定不改。
- 优先使用业务语义，不直接绑定具体实现细节。
- 建议模式：
  - 资源不存在：`{entity}_not_found`
  - 权限不足：`{entity}_{action}_forbidden` 或 `forbidden`
  - 参数非法：`{entity}_{field}_invalid` 或 `invalid_param`
  - 冲突类错误：`{entity}_{field}_duplicate` / `{entity}_conflict`
  - 外部依赖：`llm_service_error` / `db_connection_error` / `external_timeout`

禁止：
- 在 `code` 中带动态值（ID、邮箱、文件名、异常文本）。
- 同一个业务错误在不同接口使用多个 `code`。
- 直接暴露底层库异常类名。

---

## 6) Message 格式（面向开发者）

建议格式：
- `<summary>:<detail>; key1=<value>; key2=<value>; request_id=<id>`
- 分隔符统一为英文 `;`，键值统一为 `key=value`。

HTTP 错误响应示例：

```json
{
  "code": "character_not_found",
  "message": "resource not found: character does not exist; character_id=5f8f9c2f",
  "status": 404
}
```

```json
{
  "code": "auth_code_invalid_or_expired",
  "message": "authorization failed: verification code invalid or expired; email=u***@example.com",
  "status": 400
}
```

SSE 错误事件示例（`POST /v1/chat`）：

```text
data: {"type":"error","code":"llm_service_error","message":"upstream error: llm request failed; provider=deepseek"}

```

安全要求：
- `message` 面向开发排查，不直接作为最终用户展示文案。
- 不暴露敏感信息：token、验证码、完整邮箱、密钥、完整文件路径、堆栈。
- 前端应基于 `code` 做文案映射，`message` 仅用于日志和调试。
