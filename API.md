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
