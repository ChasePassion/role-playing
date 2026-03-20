# NeuraChar API 文档（当前实现）

更新时间：2026-03-20

## 1. 基础信息

- 后端默认地址：`http://localhost:8000`
- 前端开发地址：`http://localhost:3001`
- OpenAPI JSON：`/v1/openapi.json`
- Swagger UI：`/docs`
- 鉴权方式：`Authorization: Bearer <token>`
- 成功响应默认使用 `SuccessEnvelope`
- 错误响应默认使用 `ErrorEnvelope`
- 以下两类接口不走统一包裹：
  - `204 No Content`
  - `text/event-stream` / 二进制音频流

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
| --- | --- | --- | --- |
| GET | `/health` | No | 健康检查 |
| POST | `/v1/auth/send_code` | No | 发送邮箱验证码 |
| POST | `/v1/auth/login` | No | 验证码登录 |
| GET | `/v1/auth/me` | Yes | 当前用户信息 |
| GET | `/v1/users/me` | Yes | 当前用户资料 |
| PUT | `/v1/users/me` | Yes | 更新用户资料 |
| GET | `/v1/users/me/settings` | Yes | 读取用户设置 |
| PATCH | `/v1/users/me/settings` | Yes | 更新用户设置 |
| GET | `/v1/users/{creator_id}/characters` | Optional | 创作者角色列表 |
| POST | `/v1/characters` | Yes | 创建角色 |
| GET | `/v1/characters` | Yes | 我的角色列表 |
| GET | `/v1/characters/market` | No | 角色市场 |
| GET | `/v1/characters/{character_id}` | Optional | 角色详情 |
| PUT | `/v1/characters/{character_id}` | Yes | 更新角色 |
| DELETE | `/v1/characters/{character_id}` | Yes | 删除角色 |
| POST | `/v1/upload` | Yes | 上传图片 |
| GET | `/v1/chats/recent` | Yes | 获取某角色最近会话 |
| POST | `/v1/chats` | Yes | 创建会话 |
| GET | `/v1/chats/{chat_id}/turns` | Yes | 获取当前 active branch 的 turn 快照 |
| POST | `/v1/chats/{chat_id}/stream` | Yes | 主聊天 SSE |
| POST | `/v1/turns/{turn_id}/select` | Yes | 切换候选 |
| POST | `/v1/turns/{turn_id}/select/snapshot` | Yes | 切换候选并返回快照 |
| POST | `/v1/turns/{turn_id}/regen/stream` | Yes | assistant regen SSE |
| POST | `/v1/turns/{turn_id}/edit/stream` | Yes | user edit + assistant续写 SSE |
| POST | `/v1/turns/{turn_id}/feedback-card` | Yes | 生成 Better Expression 卡片 |
| POST | `/v1/learning/word-card` | Yes | 生成 Word Card |
| POST | `/v1/saved-items` | Yes | 创建收藏 |
| GET | `/v1/saved-items` | Yes | 收藏分页列表 |
| DELETE | `/v1/saved-items/{saved_item_id}` | Yes | 删除收藏 |
| POST | `/v1/memories/manage` | Yes | 写入记忆 |
| POST | `/v1/memories/search` | Yes | 检索记忆 |
| DELETE | `/v1/memories/reset` | Yes | 重置记忆 |
| POST | `/v1/memories/consolidate` | Yes | 触发语义归并 |
| DELETE | `/v1/memories/{memory_id}` | Yes | 删除单条记忆 |
| POST | `/v1/voice/stt/transcriptions` | Yes | 语音转文字 |
| GET | `/v1/voice/tts/messages/{assistant_candidate_id}/audio` | Yes | 单条 assistant 候选音频 |
| GET | `/v1/voices` | Yes | 我的音色分页 |
| GET | `/v1/voices/catalog` | Yes | 可选音色目录 |
| POST | `/v1/voices/clones` | Yes | 创建克隆音色（202 Accepted） |
| GET | `/v1/voices/{voice_id}/preview/audio` | Yes | 音色试听音频 |
| GET | `/v1/voices/{voice_id}` | Yes | 音色详情 |
| PATCH | `/v1/voices/{voice_id}` | Yes | 更新音色元信息 |
| DELETE | `/v1/voices/{voice_id}` | Yes | 删除音色 |

## 3. 当前关键契约

### 3.1 用户设置

`GET/PATCH /v1/users/me/settings`

当前字段：

- `display_mode`: `concise | detailed`
- `knowledge_card_enabled`: `boolean`
- `mixed_input_auto_translate_enabled`: `boolean`
- `auto_read_aloud_enabled`: `boolean`
- `preferred_expression_bias_enabled`: `boolean`
- `message_font_size`: `14~24`
- `updated_at`: ISO datetime

其中 `preferred_expression_bias_enabled` 会控制是否把收藏表达注入 chat / regen / user-edit / reply-suggestions 的系统提示。

### 3.2 Chat 与 Turn 流式接口

主聊天接口：`POST /v1/chats/{chat_id}/stream`

当前 SSE 事件类型：

- `meta`
- `transform_chunk`
- `transform_done`
- `chunk`
- `done`
- `reply_suggestions`
- `sentence_card`
- `memory_queued`
- `error`
- `tts_audio_delta`
- `tts_audio_done`
- `tts_error`

补充说明：

- `meta` 会先返回 server 生成的 `user_turn` / `assistant_turn` / `candidate_id`
- `done` 表示 assistant 文本主流结束
- `sentence_card` 可能在 `done` 之后异步返回
- `tts_audio_delta` / `tts_audio_done` 仅在开启自动朗读时返回

`POST /v1/turns/{turn_id}/regen/stream` 与 `POST /v1/turns/{turn_id}/edit/stream` 也使用 SSE，但事件集合较小，核心仍然是 `chunk` / `done` / `reply_suggestions` / `sentence_card` / `error`。

### 3.3 Phase 3 学习接口

#### `POST /v1/learning/word-card`

请求体：

```json
{
  "selected_text": "take it easy",
  "context_text": "You can take it easy today."
}
```

返回体 `data.word_card` 结构包含：

- `surface`
- `ipa_us`
- `pos_groups`
- `example`
- `favorite`

#### `POST /v1/turns/{turn_id}/feedback-card`

- 仅支持当前 active branch 上的 `USER` turn
- 返回体 `data.feedback_card` 包含：
  - `surface`
  - `zh`
  - `key_phrases`
  - `favorite`

#### `POST /v1/saved-items`

当前 `kind`：

- `sentence_card`
- `word_card`
- `feedback_card`

后端当前去重语义：

- 不是按 `source_message_id`
- 而是按 `(user_id, kind, display.surface)` 去重

### 3.4 Voice / Voice Profile 接口

#### `POST /v1/voice/stt/transcriptions`

- `multipart/form-data`
- 字段：
  - `audio`
  - `audio_format`: `pcm|wav|opus|speex|aac|amr`
  - `sample_rate`: `8000|16000`

#### `GET /v1/voice/tts/messages/{assistant_candidate_id}/audio`

- 查询参数：`audio_format=opus|mp3`
- 返回二进制音频流

#### `GET /v1/voices`

- 查询参数：
  - `status`
  - `source_type`
  - `cursor`
  - `limit`

#### `GET /v1/voices/catalog`

- 查询参数：
  - `provider`
  - `model`
  - `include_system`
  - `include_user_custom`

#### `POST /v1/voices/clones`

- `multipart/form-data`
- 主要字段：
  - `provider`
  - `display_name`
  - `preview_text`
  - `source_audio`
  - `source_audio_format`
  - `description`
  - `language_hint`
  - `idempotency_key`

返回：

```json
{
  "code": "ok",
  "message": "accepted",
  "status": 202,
  "data": {
    "voice": {},
    "provider_request_id": null,
    "estimated_ready_seconds": null
  }
}
```

## 4. SSE 事件示例

```text
data: {"type":"meta","user_turn":{"id":"...","turn_no":3,"candidate_id":"..."},"assistant_turn":{"id":"...","turn_no":4,"candidate_id":"..."}}

data: {"type":"chunk","content":"Hello"}

data: {"type":"done","full_content":"Hello there","assistant_turn_id":"...","assistant_candidate_id":"..."}

data: {"type":"sentence_card","message_id":"...","sentence_card":{"surface":"Hello there","zh":"你好呀","key_phrases":[],"favorite":{"enabled":true,"is_favorited":false,"saved_item_id":null}}}

data: {"type":"tts_audio_delta","assistant_candidate_id":"...","seq":1,"audio_b64":"...","mime_type":"audio/pcm;rate=24000"}
```

## 5. 当前前后端对齐重点

- 前端通过 `next.config.ts` 把 `/v1/*` 和 `/uploads/*` rewrite 到后端
- Chat 页面依赖以下接口组合：
  - `/v1/chats/{chat_id}/turns`
  - `/v1/chats/{chat_id}/stream`
  - `/v1/turns/{turn_id}/select/snapshot`
  - `/v1/turns/{turn_id}/regen/stream`
  - `/v1/turns/{turn_id}/edit/stream`
  - `/v1/turns/{turn_id}/feedback-card`
  - `/v1/learning/word-card`
  - `/v1/saved-items`
- Favorites 页面当前消费 `sentence_card / word_card / feedback_card`
- Profile 页面当前消费 `/v1/voices*` 相关接口
