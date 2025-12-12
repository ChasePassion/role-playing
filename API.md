# NeuraChar API Documentation

虚拟角色聊天系统 (NeuraChar) REST API 接口文档。

## 快速开始

```bash
# 启动服务
cd e:\code\NeuraChar
# 确保已安装依赖并配置好 .env
uvicorn src.main:app --reload --port 8000

# 访问文档
# Swagger UI: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
```

---

## API 端点

### 认证模块 (Authentication)

#### `POST /v1/auth/send_code`

发送登录验证码到指定邮箱。

**Request Body**
```json
{
  "email": "user@example.com"
}
```

**Response** `200 OK`
```json
{
  "message": "Verification code sent."
}
```

---

#### `POST /v1/auth/login`

邮箱验证码登录，换取 JWT Token。

**Request Body**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response** `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1Ni...",
  "token_type": "bearer"
}
```

---

#### `GET /v1/auth/me`

获取当前登录用户信息 (需要 Bearer Token)。

**Headers**
```
Authorization: Bearer <access_token>
```

**Response** `200 OK`
```json
{
  "id": "uuid-string",
  "email": "user@example.com",
  "username": "MyUsername",
  "avatar_url": "/uploads/xxx.jpg",
  "created_at": "2023-12-12T10:00:00Z",
  "last_login_at": "2023-12-12T10:05:00Z"
}
```

---

### 用户资料 (User Profile)

#### `GET /v1/users/me`

获取当前用户的完整资料。

**Headers**
```
Authorization: Bearer <access_token>
```

**Response** `200 OK`
```json
{
  "id": "uuid-string",
  "email": "user@example.com",
  "username": "MyUsername",
  "avatar_url": "/uploads/avatar.jpg",
  "created_at": "2023-12-12T10:00:00Z",
  "last_login_at": "2023-12-12T10:05:00Z"
}
```

---

#### `PUT /v1/users/me`

更新当前用户信息 (用户名、头像)。

**Headers**
```
Authorization: Bearer <access_token>
```

**Request Body**
```json
{
  "username": "NewName",        // 可选 (2-50字符)
  "avatar_url": "/uploads/..."  // 可选 (文件路径)
}
```

**Response** `200 OK`
```json
{
  "id": "...",
  "username": "NewName",
  "avatar_url": "/uploads/...",
  ...
}
```

---

### 角色管理 (Characters)

#### `POST /v1/characters`

创建新角色。

**Request Body**
```json
{
  "name": "Luna",
  "system_prompt": "You are Luna, a helpful AI assistant...",
  "greeting_message": "Hello! How can I help you today?",
  "avatar_url": "/uploads/luna.jpg",
  "tags": ["assistant", "friendly"],
  "is_public": true
}
```

**Response** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Luna",
  "system_prompt": "You are Luna, a helpful AI assistant...",
  "greeting_message": "Hello! How can I help you today?",
  "avatar_url": "/uploads/luna.jpg",
  "tags": ["assistant", "friendly"],
  "creator_id": "user-uuid-123",
  "is_public": true
}
```

---

#### `GET /v1/characters`

获取**当前用户创建**的角色列表 (私有库)。

**Query Parameters**
- `skip`: (int) 分页偏移, 默认为 0
- `limit`: (int) 每页数量, 默认为 20 (最大 100)

**Response** `200 OK`
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Luna",
    "is_public": true,
    "creator_id": "user-uuid-123",
    "tags": ["assistant"]
    // ... 其他完整字段
  }
]
```

---

#### `GET /v1/characters/market`

获取**公开市场**的角色列表 (所有人可见，返回 `is_public=true` 的角色)。

**Query Parameters**
- `skip`: (int) 分页偏移, 默认为 0
- `limit`: (int) 每页数量, 默认为 20

---

#### `GET /v1/characters/{id}`

获取单个角色详情。

**权限说明**:
- 如果你是该角色的创建者 (`creator_id` 匹配)，允许访问。
- 如果该角色是公开的 (`is_public=true`)，允许访问。
- 否则返回 `403 Forbidden`。

**Response** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Luna",
  "system_prompt": "...",
  "greeting_message": "...",
  "avatar_url": "/uploads/...",
  "tags": ["assistant"],
  "creator_id": "creator-uuid",
  "is_public": true
}
```

---

#### `PUT /v1/characters/{id}`

更新角色信息。

**权限说明**:
- 仅**创建者**可以修改角色信息。
- 非创建者尝试修改返回 `403 Forbidden`.

**Request Body** (所有字段均为可选)
```json
{
  "name": "Luna V2",
  "greeting_message": "Hi there!",
  "tags": ["assistant", "v2"],
  "is_public": false
}
```

**Response** `200 OK` (返回更新后的完整对象)

---

#### `DELETE /v1/characters/{id}`

删除角色。

**权限说明**:
- 仅**创建者**可以删除角色。

**Response** `204 No Content`

### 文件上传 (Upload)

#### `POST /v1/upload`

上传文件（如头像）。支持 JPEG, PNG, GIF, WEBP，最大 5MB。

**Headers**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Form Data**
- `file`: (Binary File)

**Response** `200 OK`
```json
{
  "url": "/uploads/unique-filename.jpg"
}
```

---

### 健康检查

#### `GET /health`

检查服务状态。

**Response** `200 OK`
```json
{
  "status": "ok"
}
```

---

### 对话 (Planned / Legacy)

> 此部分接口正在从 NeuraMem 迁移中，尚未完全实装到 NeuraChar。

#### `POST /v1/chat`

基于记忆增强的流式对话接口，返回 Server-Sent Events。

**Request Body**
```json
{
  "user_id": "string",      // 必填：用户标识
  "chat_id": "string",      // 必填：对话标识
  "message": "string",      // 必填：用户消息
  "history": [              // 可选：历史消息
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

**Response** `200 OK` (text/event-stream)

```
data: {"type": "chunk", "content": "你"}

data: {"type": "chunk", "content": "好"}

data: {"type": "done", "full_content": "你好，有什么可以帮您的吗？"}
```

---

### 记忆管理 (Planned / Legacy)

#### `POST /v1/memories/manage`

根据对话内容智能管理记忆（添加/更新/删除）。

**Request Body**
```json
{
  "user_id": "string",        // 必填：用户标识
  "chat_id": "string",        // 必填：对话标识
  "user_text": "string",      // 必填：用户输入
  "assistant_text": "string"  // 必填：助手回复
}
```

**Response** `200 OK`
```json
{
  "added_ids": [123, 124],
  "success": true
}
```

---

## 错误码

| HTTP Status | Error Code | 描述 |
|-------------|------------|------|
| 400 | `BAD_REQUEST` | 参数错误或验证码无效 |
| 401 | `UNAUTHORIZED` | Token 无效或过期 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |
