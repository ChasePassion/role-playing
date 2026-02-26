# NeuraChar API 文档（当前实现）

更新时间：2026-02-26

## 1. 基础信息

- Base URL（本地）：`http://localhost:8000`
- OpenAPI：`/v1/openapi.json`
- Swagger：`/docs`
- 认证：`Authorization: Bearer <token>`
- 响应包裹：统一 `SuccessEnvelope/ErrorEnvelope`

成功响应示例：

```json
{
  "code": "ok",
  "message": "ok",
  "status": 200,
  "data": {}
}
```

## 2. 路由总览

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/health` | No | 健康检查 |
| POST | `/v1/auth/send_code` | No | 发送验证码 |
| POST | `/v1/auth/login` | No | 验证码登录 |
| GET | `/v1/auth/me` | Yes | 当前用户 |
| GET | `/v1/users/me` | Yes | 用户资料 |
| PUT | `/v1/users/me` | Yes | 更新用户资料 |
| GET | `/v1/users/me/settings` | Yes | 用户设置 |
| PATCH | `/v1/users/me/settings` | Yes | 更新用户设置 |
| GET | `/v1/users/{creator_id}/characters` | Optional | 创作者角色列表 |
| POST | `/v1/characters` | Yes | 创建角色 |
| GET | `/v1/characters` | Yes | 我的角色 |
| GET | `/v1/characters/market` | No | 角色市场 |
| GET | `/v1/characters/{character_id}` | Optional | 角色详情 |
| PUT | `/v1/characters/{character_id}` | Yes | 更新角色 |
| DELETE | `/v1/characters/{character_id}` | Yes | 删除角色（204） |
| POST | `/v1/upload` | Yes | 图片上传 |
| GET | `/v1/chats/recent` | Yes | 最近会话 |
| POST | `/v1/chats` | Yes | 创建会话 |
| GET | `/v1/chats/{chat_id}/turns` | Yes | 分页会话快照 |
| POST | `/v1/chats/{chat_id}/stream` | Yes | 主聊天 SSE |
| POST | `/v1/turns/{turn_id}/select` | Yes | 候选切换 |
| POST | `/v1/turns/{turn_id}/select/snapshot` | Yes | 候选切换+快照 |
| POST | `/v1/turns/{turn_id}/regen/stream` | Yes | 重生 SSE |
| POST | `/v1/turns/{turn_id}/edit/stream` | Yes | 编辑续写 SSE |
| POST | `/v1/saved-items` | Yes | 创建收藏 |
| GET | `/v1/saved-items` | Yes | 收藏分页 |
| DELETE | `/v1/saved-items/{saved_item_id}` | Yes | 删除收藏（204） |
| POST | `/v1/memories/manage` | Yes | 写入记忆 |
| POST | `/v1/memories/search` | Yes | 检索记忆 |
| DELETE | `/v1/memories/{memory_id}` | Yes | 删除记忆 |
| DELETE | `/v1/memories/reset` | Yes | 重置记忆 |
| POST | `/v1/memories/consolidate` | Yes | 语义归并 |
| POST | `/v1/voice/stt/transcriptions` | Yes | 语音转文字 |
| GET | `/v1/voice/tts/messages/{assistant_candidate_id}/audio` | Yes | 单条语音播放 |

## 3. 关键接口说明

### 3.1 用户设置

`GET/PATCH /v1/users/me/settings`

当前字段：

- `display_mode`: `concise | detailed`
- `knowledge_card_enabled`: `boolean`
- `mixed_input_auto_translate_enabled`: `boolean`
- `auto_read_aloud_enabled`: `boolean`（Phase 2 新增）
- `message_font_size`: `14~24`
- `updated_at`

### 3.2 Chat 主流接口

`POST /v1/chats/{chat_id}/stream`（`text/event-stream`）

常规事件：

- `meta`
- `transform_chunk`
- `transform_done`
- `chunk`
- `done`
- `reply_suggestions`
- `sentence_card`
- `memory_queued`
- `error`

Phase 2 语音事件（可选）：

- `tts_audio_delta`
- `tts_audio_done`
- `tts_error`

### 3.3 STT 接口

`POST /v1/voice/stt/transcriptions`

- Content-Type：`multipart/form-data`
- 参数：
  - `audio`（binary）必填
  - `audio_format`：`pcm|wav|opus|speex|aac|amr`（默认 `wav`）
  - `sample_rate`：`8000|16000`（默认 `16000`）

返回：

```json
{
  "code": "ok",
  "message": "ok",
  "status": 200,
  "data": {
    "text": "hello",
    "model": "qwen3-asr-flash-realtime",
    "request_id": null
  }
}
```

### 3.4 TTS 单条播放接口

`GET /v1/voice/tts/messages/{assistant_candidate_id}/audio?audio_format=opus|mp3`

- 返回二进制音频流
- 会校验 candidate 所属用户与作者类型

## 4. SSE 事件示例

```text
data: {"type":"chunk","content":"Hello"}

data: {"type":"tts_audio_delta","assistant_candidate_id":"...","seq":1,"audio_b64":"...","mime_type":"audio/pcm;rate=24000"}

data: {"type":"tts_audio_done","assistant_candidate_id":"..."}
```

## 5. 常见错误码（语音相关）

- `stt_audio_empty`（422）
- `stt_audio_too_large`（413）
- `stt_no_speech_detected`（422）
- `stt_invalid_audio`（422）
- `stt_upstream_error`（502）
- `tts_text_empty`（422）
- `tts_upstream_error`（502）
- `tts_candidate_forbidden`（403）
- `tts_candidate_invalid_author`（409）

## 6. 语音模型与协议

- STT 默认模型：`qwen3-asr-flash-realtime`
- TTS 默认模型：`qwen3-tts-instruct-flash-realtime`

STT 协议分流：

1. `fun-asr-*`：`/api-ws/v1/inference` 任务协议
2. `qwen3-asr-flash-realtime*`：`/api-ws/v1/realtime` 协议
