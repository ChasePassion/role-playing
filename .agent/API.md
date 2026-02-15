# NeuraChar API 文档（当前实现）

本文档基于当前后端代码实现（`src.main:app`）整理，覆盖项目全部对外 API。

## 1. 基础信息

- Base URL（本地开发）：`http://localhost:8000`
- OpenAPI JSON：`/v1/openapi.json`
- Swagger UI：`/docs`
- Content-Type：
  - 普通接口：`application/json`
  - 上传接口：`multipart/form-data`
  - 聊天接口：`text/event-stream`（SSE）

## 2. 鉴权机制

- 使用 `Authorization: Bearer <access_token>`。
- Token 由 `POST /v1/auth/login` 返回。
- 鉴权失败统一返回 `401`，常用错误码：
  - `auth_token_invalid`
  - `unauthorized`

## 3. 统一响应规范

### 3.1 成功响应（除 204 外）

```json
{
  "code": "ok",
  "message": "ok",
  "status": 200,
  "data": {}
}
```

### 3.2 错误响应

```json
{
  "code": "character_not_found",
  "message": "resource not found: character does not exist; character_id=...",
  "status": 404
}
```

### 3.3 204 响应

- `DELETE /v1/characters/{character_id}` 返回 `204 No Content`，无响应体。

### 3.4 SSE 错误事件（聊天接口）

```text
data: {"type":"error","code":"llm_service_error","message":"upstream error: llm request failed after retries; model=...; attempts=3"}
```

## 4. 全量 API 一览

| Method | Path | Auth | 说明 |
|---|---|---|---|
| `GET` | `/health` | No | 服务健康检查 |
| `POST` | `/v1/auth/send_code` | No | 发送邮箱验证码 |
| `POST` | `/v1/auth/login` | No | 验证码登录，返回 token |
| `GET` | `/v1/auth/me` | Yes | 获取当前用户基础信息 |
| `GET` | `/v1/users/me` | Yes | 获取当前用户完整资料 |
| `PUT` | `/v1/users/me` | Yes | 更新当前用户资料 |
| `GET` | `/v1/users/{creator_id}/characters` | Optional | 获取指定创作者角色列表 |
| `POST` | `/v1/characters` | Yes | 创建角色 |
| `GET` | `/v1/characters` | Yes | 获取当前用户角色列表 |
| `GET` | `/v1/characters/market` | No | 获取公开角色市场列表 |
| `GET` | `/v1/characters/{character_id}` | Optional | 获取角色详情（按可见性控制） |
| `PUT` | `/v1/characters/{character_id}` | Yes | 更新角色（仅创建者） |
| `DELETE` | `/v1/characters/{character_id}` | Yes | 删除角色（仅创建者） |
| `POST` | `/v1/upload` | Yes | 上传图片文件 |
| `POST` | `/v1/chat` | Yes | SSE 流式聊天 |
| `POST` | `/v1/memories/manage` | No | 记忆管理 |
| `POST` | `/v1/memories/search` | No | 记忆检索 |
| `DELETE` | `/v1/memories/{memory_id}` | No | 删除单条记忆（需 user_id + character_id） |
| `DELETE` | `/v1/memories/reset` | No | 重置用户-角色下全部记忆 |
| `POST` | `/v1/memories/consolidate` | No | 记忆归并 |

## 5. 认证模块（Auth）

### 5.1 `POST /v1/auth/send_code`

- 描述：向邮箱发送登录验证码。
- 请求体：

```json
{
  "email": "user@example.com"
}
```

- 成功响应 `200`：`data.message` 为发送结果说明。
- 典型错误：
  - `auth_send_code_failed` (`500`)
  - `validation_failed` (`422`)

### 5.2 `POST /v1/auth/login`

- 描述：邮箱 + 验证码登录，返回 JWT。
- 请求体：

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

- 成功响应 `200`：

```json
{
  "code": "ok",
  "message": "ok",
  "status": 200,
  "data": {
    "access_token": "xxx",
    "token_type": "bearer"
  }
}
```

- 典型错误：
  - `auth_code_invalid_or_expired` (`400`)
  - `validation_failed` (`422`)

### 5.3 `GET /v1/auth/me`

- 描述：获取当前登录用户基础信息。
- Header：`Authorization: Bearer <token>`
- 成功响应 `200`：`data` 为用户基础字段：
  - `id`
  - `email`
  - `username`
  - `avatar_url`
  - `created_at`
  - `last_login_at`
- 典型错误：
  - `auth_token_invalid` (`401`)

## 6. 用户模块（Users）

### 6.1 `GET /v1/users/me`

- 描述：获取当前用户完整资料。
- Header：`Authorization: Bearer <token>`
- 成功响应 `200`：`data` 为用户资料对象。
- 典型错误：
  - `auth_token_invalid` (`401`)

### 6.2 `PUT /v1/users/me`

- 描述：更新当前用户资料。
- Header：`Authorization: Bearer <token>`
- 请求体（至少一个字段）：

```json
{
  "username": "new_name",
  "avatar_url": "/uploads/xxx.jpg"
}
```

- 参数约束：
  - `username`：2~50 字符（可选）
  - `avatar_url`：字符串（可选）
  - 两者不能同时缺失
- 成功响应 `200`：`data` 为更新后的用户资料。
- 典型错误：
  - `user_profile_update_empty` (`400`)
  - `validation_failed` (`422`)
  - `auth_token_invalid` (`401`)

### 6.3 `GET /v1/users/{creator_id}/characters`

- 描述：获取某个创作者的角色列表（创作者主页）。
- 鉴权：可不带 token；带无效 token 会返回 `401`。
- Query：
  - `skip`：默认 `0`，最小 `0`
  - `limit`：默认 `20`，范围 `1~100`
- 返回规则：
  - viewer == creator：返回该创作者全部角色（PUBLIC/PRIVATE/UNLISTED）
  - 否则：只返回 PUBLIC
- 成功响应 `200`：`data` 为角色数组。

## 7. 角色模块（Characters）

### 7.1 `POST /v1/characters`

- 描述：创建角色。
- Header：`Authorization: Bearer <token>`
- 请求体：

```json
{
  "name": "Luna",
  "description": "A warm assistant",
  "system_prompt": "You are Luna...",
  "greeting_message": "Hello!",
  "avatar_file_name": "avatar.jpg",
  "tags": ["warm", "helper"],
  "visibility": "PUBLIC"
}
```

- 参数约束（创建）：
  - `name`：1~10
  - `description`：1~35
  - `system_prompt`：最少 1
  - `tags`：最多 3 个，每个长度 1~4
  - `visibility`：`PUBLIC` / `PRIVATE` / `UNLISTED`，默认 `PRIVATE`
- 成功响应 `201`：`data` 为创建后的角色对象。
- 典型错误：
  - `validation_failed` (`422`)
  - `auth_token_invalid` (`401`)

### 7.2 `GET /v1/characters`

- 描述：获取当前用户创建的角色列表。
- Header：`Authorization: Bearer <token>`
- Query：`skip`、`limit`（同上）
- 成功响应 `200`：`data` 为角色数组。

### 7.3 `GET /v1/characters/market`

- 描述：获取公开角色市场列表。
- 鉴权：不需要
- Query：`skip`、`limit`（同上）
- 成功响应 `200`：`data` 为公开角色数组。

### 7.4 `GET /v1/characters/{character_id}`

- 描述：获取角色详情。
- 鉴权：可选；无 token 可访问 PUBLIC/UNLISTED。
- 访问规则：
  - PUBLIC/UNLISTED：任何人可访问
  - PRIVATE：仅创建者可访问
- 成功响应 `200`：`data` 为角色对象。
- 典型错误：
  - `character_not_found` (`404`)
  - `character_private_forbidden` (`403`)
  - `auth_token_invalid` (`401`)

### 7.5 `PUT /v1/characters/{character_id}`

- 描述：更新角色（仅创建者）。
- Header：`Authorization: Bearer <token>`
- 请求体：`CharacterUpdate`，字段均可选。
- 参数约束（更新）：
  - `name`：2~100（若提供）
  - `description`：5~35（若提供）
  - `system_prompt`：最少 10（若提供）
  - `visibility`：`PUBLIC` / `PRIVATE` / `UNLISTED`（若提供）
- 成功响应 `200`：`data` 为更新后角色对象。
- 典型错误：
  - `character_not_found` (`404`)
  - `character_modify_forbidden` (`403`)
  - `validation_failed` (`422`)

### 7.6 `DELETE /v1/characters/{character_id}`

- 描述：删除角色（仅创建者）。
- Header：`Authorization: Bearer <token>`
- 成功响应：`204 No Content`（无 body）。
- 典型错误：
  - `character_not_found` (`404`)
  - `character_delete_forbidden` (`403`)

## 8. 上传模块（Upload）

### 8.1 `POST /v1/upload`

- 描述：上传图片（通常用于头像）。
- Header：`Authorization: Bearer <token>`
- FormData：
  - `file`：二进制文件
- 约束：
  - MIME 允许：`image/jpeg`, `image/png`, `image/gif`, `image/webp`
  - 大小上限：5MB
- 成功响应 `200`：

```json
{
  "code": "ok",
  "message": "ok",
  "status": 200,
  "data": {
    "url": "/uploads/xxxx.jpg"
  }
}
```

- 典型错误：
  - `upload_file_too_large` (`413`)
  - `upload_file_type_not_allowed` (`415`)
  - `upload_failed` (`500`)

## 9. 聊天模块（Chat, SSE）

### 9.1 `POST /v1/chat`

- 描述：基于记忆增强的 SSE 流式对话。
- Header：`Authorization: Bearer <token>`
- 请求体：

```json
{
  "user_id": "user-uuid",
  "character_id": "character-id",
  "chat_id": "chat-id",
  "message": "Hello",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello" }
  ]
}
```

- 规则：
  - `request.user_id` 必须与当前 token 对应用户一致，否则 `403`。
- SSE 事件：

```text
data: {"type":"chunk","content":"..."}

data: {"type":"done","full_content":"..."}

data: {"type":"error","code":"chat_stream_failed","message":"chat stream failed: unexpected streaming error"}
```

- 典型错误码：
  - HTTP 错误：`chat_user_mismatch_forbidden` (`403`)
  - 流内错误事件：`llm_service_error` / `chat_stream_failed`

## 10. 记忆模块（Memories）

说明：当前 `memories` 路由未接入 Bearer 鉴权，依赖请求参数中的 `user_id`、`character_id` 进行逻辑操作。

### 10.1 `POST /v1/memories/manage`

- 描述：根据对话内容进行记忆管理。
- 请求体：

```json
{
  "user_id": "u1",
  "character_id": "c1",
  "chat_id": "chat1",
  "user_text": "I like jazz",
  "assistant_text": "Got it"
}
```

- 成功响应 `200`：`data = { "added_ids": [1,2], "success": true }`
- 典型错误：`memory_manage_failed` (`500`)

### 10.2 `POST /v1/memories/search`

- 描述：检索 episodic / semantic 记忆。
- 请求体：

```json
{
  "user_id": "u1",
  "character_id": "c1",
  "query": "music preference"
}
```

- 成功响应 `200`：`data` 包含 `episodic`、`semantic` 两个数组。
- 典型错误：`memory_search_failed` (`500`)

### 10.3 `DELETE /v1/memories/{memory_id}`

- 描述：删除单条记忆。
- Query（必填）：
  - `user_id`
  - `character_id`
- 成功响应 `200`：`data = { "success": true, "deleted_count": 1 }`
- 典型错误：
  - `memory_not_found` (`404`)

### 10.4 `DELETE /v1/memories/reset`

- 描述：删除某用户在某角色下的全部记忆。
- 请求体：

```json
{
  "user_id": "u1",
  "character_id": "c1"
}
```

- 成功响应 `200`：`data = { "success": true, "deleted_count": 10 }`
- 典型错误：`memory_reset_failed` (`500`)

### 10.5 `POST /v1/memories/consolidate`

- 描述：对记忆做归并，提取语义记忆。
- 请求体：

```json
{
  "user_id": "u1",
  "character_id": "c1"
}
```

- `user_id` 可选；为空时按实现逻辑做全量/默认范围处理。
- 成功响应 `200`：`data = { "memories_processed": 10, "semantic_created": 2 }`
- 典型错误：`memory_consolidate_failed` (`500`)

## 11. 常见错误码汇总

| code | status | 说明 |
|---|---|---|
| `validation_failed` | 422 | 请求参数结构校验失败 |
| `invalid_param` | 400 | 通用业务参数错误 |
| `auth_token_invalid` | 401 | token 缺失/无效/解析失败 |
| `auth_send_code_failed` | 500 | 发送验证码失败 |
| `auth_code_invalid_or_expired` | 400 | 验证码错误或过期 |
| `user_profile_update_empty` | 400 | 用户更新请求为空 |
| `character_not_found` | 404 | 角色不存在 |
| `character_private_forbidden` | 403 | 私有角色访问被拒绝 |
| `character_modify_forbidden` | 403 | 非创建者修改角色 |
| `character_delete_forbidden` | 403 | 非创建者删除角色 |
| `upload_file_too_large` | 413 | 上传文件过大 |
| `upload_file_type_not_allowed` | 415 | 上传文件类型不支持 |
| `upload_failed` | 500 | 上传失败 |
| `chat_user_mismatch_forbidden` | 403 | 聊天 user_id 与当前用户不一致 |
| `llm_service_error` | 502 | LLM 上游错误 |
| `chat_stream_failed` | 500 | 聊天流内部异常 |
| `memory_not_found` | 404 | 记忆不存在 |
| `memory_manage_failed` | 500 | 记忆管理失败 |
| `memory_search_failed` | 500 | 记忆检索失败 |
| `memory_reset_failed` | 500 | 记忆重置失败 |
| `memory_consolidate_failed` | 500 | 记忆归并失败 |
| `db_connection_error` | 503 | DB/Milvus 连接不可用 |
| `external_error` | 502 | 通用上游依赖错误 |
| `external_timeout` | 504 | 上游依赖超时 |
| `internal_error` | 500 | 未知内部错误 |

文档更新时间：2026-02-15 15:48:28
