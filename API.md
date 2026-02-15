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

#### `GET /v1/users/{creator_id}/characters`

获取指定创作者的角色列表（**创作者主页**）。

**Headers** (可选)
```
Authorization: Bearer <access_token>
```

**Query Parameters**
- `skip`: (int) 分页偏移, 默认为 0
- `limit`: (int) 每页数量, 默认为 20 (最大 100)


**权限说明**:
- 如果 viewer == creator：返回全部角色（含私有、非列表）
- 否则：只返回公开角色 (`visibility: PUBLIC`)
- 携带无效 Token → `401 Unauthorized`

**Response** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Luna",
    "description": "...",
    "visibility": "PUBLIC",
    "creator_id": "creator-uuid",
    "identifier": null,
    "interaction_count": 0
  }
]
```

---

### 角色管理 (Characters)

#### Visibility 可见性枚举

角色支持三种可见性状态：

| 值 | 说明 |
|----|------|
| `PUBLIC` | 公开：在市场列表中可见，任何人可访问 |
| `PRIVATE` | 私有：不在列表中显示，仅创建者可访问 |
| `UNLISTED` | 非列表：不在市场列表中，但可通过链接直接访问 |

---

#### `POST /v1/characters`

创建新角色。

**Request Body**
```json
{
  "name": "Luna",
  "description": "温柔体贴的AI助手，擅长倾听和陪伴",
  "system_prompt": "You are Luna, a helpful AI assistant...",
  "greeting_message": "你好！我是Luna，很高兴认识你！",
  "avatar_file_name": "luna.jpg",
  "tags": ["温柔", "助手"],
  "visibility": "PUBLIC"
}
```

**字段说明**：
| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | ✅ | 角色名称 (1-10字符) |
| `description` | ✅ | 简短描述，显示在角色卡片上 (1-35字符) |
| `system_prompt` | ✅ | 角色系统提示词 |
| `greeting_message` | ❌ | 开场问候语，聊天时角色主动发送 |
| `avatar_file_name` | ❌ | 头像文件名 (通过 /v1/upload 上传后获得) |
| `tags` | ❌ | 角色标签 (最多3个，每个1-4字符) |
| `visibility` | ❌ | 可见性: `PUBLIC`/`PRIVATE`/`UNLISTED` (默认 PRIVATE) |

**Response** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Luna",
  "description": "温柔体贴的AI助手，擅长倾听和陪伴",
  "system_prompt": "You are Luna, a helpful AI assistant...",
  "greeting_message": "你好！我是Luna，很高兴认识你！",
  "avatar_file_name": "luna.jpg",
  "tags": ["温柔", "助手"],
  "creator_id": "user-uuid-123",
  "visibility": "PUBLIC",
  "identifier": null,
  "interaction_count": 0
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
    "description": "温柔体贴的AI助手，擅长倾听和陪伴",
    "system_prompt": "You are Luna, a helpful AI assistant...",
    "greeting_message": "你好！我是Luna，很高兴认识你！",
    "avatar_file_name": "luna.jpg",
    "tags": ["assistant"],
    "creator_id": "user-uuid-123",
    "visibility": "PUBLIC",
    "identifier": null,
    "interaction_count": 42
  }
]
```


---

#### `GET /v1/characters/market`

获取**公开市场**的角色列表 (所有人可见，返回 `visibility=PUBLIC` 的角色)。

**Query Parameters**
- `skip`: (int) 分页偏移, 默认为 0
- `limit`: (int) 每页数量, 默认为 20 (最大 100)


---

#### `GET /v1/characters/{id}`

获取单个角色详情。

**Headers** (可选)
```
Authorization: Bearer <access_token>
```

**权限说明**:
- 公开角色 (`visibility: PUBLIC`)：任何人可访问
- 非列表角色 (`visibility: UNLISTED`)：有链接即可访问
- 私有角色 (`visibility: PRIVATE`)：仅创建者可访问（用于编辑回填）
- 携带无效 Token → `401 Unauthorized`
- 私有角色 + 非创建者 → `403 Forbidden`

**Response** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Luna",
  "description": "温柔体贴的AI助手",
  "system_prompt": "...",
  "greeting_message": "...",
  "avatar_file_name": "luna.jpg",
  "tags": ["温柔"],
  "creator_id": "creator-uuid",
  "visibility": "PUBLIC",
  "identifier": null,
  "interaction_count": 100
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
  "description": "温柔体贴的AI助手",
  "system_prompt": "You are Luna, a helpful AI assistant...",
  "greeting_message": "Hi there!",
  "avatar_file_name": "luna.jpg",
  "tags": ["assistant", "v2"],
  "visibility": "UNLISTED"
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

#### `GET /v1/health`

检查服务状态（API 前缀版本）。

**Response** `200 OK`
```json
{
  "status": "ok",
  "version": "1.0.0"
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
  "user_id": "string",       // Required: user identifier
  "character_id": "string",  // Required: character identifier
  "chat_id": "string",       // Required: conversation identifier
  "message": "string",       // Required: user message
  "history": [                // Optional: message history
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
  "user_id": "string",        // Required: user identifier
  "character_id": "string",   // Required: character identifier
  "chat_id": "string",        // Required: conversation identifier
  "user_text": "string",      // Required: user input
  "assistant_text": "string"  // Required: assistant response
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

#### `POST /v1/memories/search`

搜索记忆（情景+语义）。

**Request Body**
```json
{
  "user_id": "string",        // Required: user identifier
  "character_id": "string",   // Required: character identifier
  "query": "string"           // Required: search query
}
```

**Response** `200 OK`
```json
{
  "episodic": [
    {
      "id": 1,
      "user_id": "string",
      "character_id": "string",
      "memory_type": "episodic",
      "ts": 1710000000,
      "chat_id": "string",
      "text": "...",
      "group_id": -1
    }
  ],
  "semantic": []
}
```

---

#### `DELETE /v1/memories/{memory_id}`

删除单条记忆。

**Query Parameters**
- `user_id`: string (Required)
- `character_id`: string (Required)

**Response** `200 OK`
```json
{
  "success": true,
  "deleted_count": 1
}
```

---

#### `DELETE /v1/memories/reset`

删除指定用户与角色的全部记忆。

**Request Body**
```json
{
  "user_id": "string",        // Required: user identifier
  "character_id": "string"    // Required: character identifier
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "deleted_count": 10
}
```

---

#### `POST /v1/memories/consolidate`

合并情景记忆生成语义记忆。

**Request Body**
```json
{
  "user_id": "string",        // Optional: user identifier
  "character_id": "string"    // Required: character identifier
}
```

**Response** `200 OK`
```json
{
  "memories_processed": 10,
  "semantic_created": 2
}
```


---

## 错误码

| HTTP Status | Error Code | 描述 |
|-------------|------------|------|
| 400 | `BAD_REQUEST` | 参数错误或验证码无效 |
| 401 | `UNAUTHORIZED` | Token 无效或过期 |
| 403 | `FORBIDDEN` | 无权访问（如私有角色或非创建者操作） |
| 404 | `NOT_FOUND` | 资源不存在 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |
