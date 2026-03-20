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

- HTTP status 必须与 `body.status` 一致
- `code`：成功固定为 `ok`
- `message`：默认 `ok`
- `data`：业务数据
- `204 No Content`：不返回 body
- `202 Accepted`：仍使用成功包裹，但 `status=202`，当前允许 `message=accepted`

## 2）固定错误响应体结构

```json
{
  "code": "xxx",
  "message": "xxx",
  "status": 400
}
```

要求：

- HTTP status 必须与 `body.status` 一致
- `code`：`snake_case`
- `status`：标准 HTTP 状态码
- `message`：面向开发排障，格式尽量保持：

```text
summary: detail; key1=value1; key2=value2
```

## 3）HTTP Status 语义约定

| Status | 语义 | 当前典型场景 |
| --- | --- | --- |
| 400 | 业务规则不满足 | 验证码无效、空 patch、空更新 |
| 401 | 未认证或 token 无效 | `auth_token_invalid` |
| 403 | 已认证但无权限 | 私有角色、他人 chat / voice / candidate |
| 404 | 资源不存在 | `character_not_found`、`voice_profile_not_found` |
| 409 | 状态冲突 / 资源冲突 | turn 状态冲突、候选上限、音色被占用 |
| 413 | 负载过大 | 上传图片过大、音频过大 |
| 415 | 媒体类型不支持 | 上传图片类型非法 |
| 422 | 结构化校验失败 | Pydantic 校验、枚举值非法、sample_rate 非法 |
| 429 | 频率或配额限制 | 保留 |
| 500 | 内部错误 | 未知内部异常 |
| 502 | 上游依赖异常 | LLM / DashScope / 外部服务错误 |
| 503 | 依赖不可用 | DB / Voice provider 不可用 |
| 504 | 上游超时 | LLM / Voice provider timeout |

补充：

- `POST /v1/chats/{chat_id}/stream`
- `POST /v1/turns/{turn_id}/regen/stream`
- `POST /v1/turns/{turn_id}/edit/stream`

这些 SSE 接口在流式过程中出错时，通过：

```text
data: {"type":"error","code":"...","message":"..."}
```

返回错误，而不是重新包一层 `ErrorEnvelope`。

## 4）当前错误码清单（按领域归类）

### 4.1 通用 / 鉴权 / 用户

| code | status | 说明 |
| --- | --- | --- |
| `invalid_param` | 400 | 通用业务参数非法 |
| `validation_failed` | 422 | 请求结构或字段校验失败 |
| `auth_send_code_failed` | 500 | 发送验证码失败 |
| `auth_code_invalid_or_expired` | 400 | 验证码无效或过期 |
| `auth_token_invalid` | 401 | token 无效或用户不存在 |
| `user_profile_update_empty` | 400 | 用户资料更新为空 |
| `user_settings_update_empty` | 400 | 用户设置 patch 为空 |
| `user_settings_updated_at_missing` | 500 | 用户设置更新时间缺失 |

### 4.2 角色 / 音色绑定

| code | status | 说明 |
| --- | --- | --- |
| `character_not_found` | 404 | 角色不存在 |
| `character_private_forbidden` | 403 | 非创建者访问私有角色 |
| `character_modify_forbidden` | 403 | 非创建者修改角色 |
| `character_delete_forbidden` | 403 | 非创建者删除角色 |
| `voice_not_found` | 404 | 绑定到角色的音色不存在 |
| `voice_profile_not_selectable` | 409 | 音色不可用于当前角色 |
| `voice_source_type_unsupported` | 409 | 角色音色来源类型不支持 |

### 4.3 Chat / Turn / 学习卡片 / 收藏

| code | status | 说明 |
| --- | --- | --- |
| `chat_not_found` | 404 | 会话不存在 |
| `chat_forbidden` | 403 | 无权访问会话 |
| `chat_state_conflict` | 409 | 会话状态不允许当前操作 |
| `chat_stream_failed` | 500 | 主聊天流异常 |
| `turn_not_found` | 404 | turn 不存在 |
| `turn_author_conflict` | 409 | turn 作者类型不符合操作要求 |
| `turn_candidate_limit_reached` | 409 | 候选数达到上限 |
| `turn_state_conflict` | 409 | turn parent / candidate 状态不合法 |
| `candidate_not_found` | 404 | 指定候选不存在 |
| `greeting_turn_locked` | 409 | greeting turn 不支持该操作 |
| `regen_stream_failed` | 500 | regen 流异常 |
| `user_edit_stream_failed` | 500 | user edit 流异常 |
| `feedback_target_invalid` | 409 | feedback 目标不是用户 turn |
| `feedback_target_not_on_active_branch` | 409 | feedback 目标不在 active branch |
| `feedback_target_missing_candidate` | 409 | feedback 目标缺少主候选 |
| `feedback_target_missing_content` | 409 | feedback 目标没有内容 |
| `word_card_selection_invalid` | 400 | 划词输入不合法 |
| `saved_item_kind_invalid` | 400 | 收藏 kind 非法 |
| `saved_item_card_invalid` | 400 | 收藏 card 数据不合法 |
| `saved_item_filter_invalid` | 400 | 收藏筛选参数非法 |
| `saved_item_cursor_invalid` | 400 | 收藏分页 cursor 非法 |
| `saved_item_id_invalid` | 400 | 收藏 id 非法 |
| `saved_item_duplicate` | 409 | 收藏按 surface 去重后冲突 |
| `saved_item_not_found` | 404 | 收藏不存在 |
| `saved_item_created_at_missing` | 500 | 收藏创建时间缺失 |

### 4.4 上传 / 记忆

| code | status | 说明 |
| --- | --- | --- |
| `upload_file_too_large` | 413 | 图片超过限制 |
| `upload_file_type_not_allowed` | 415 | 图片类型不允许 |
| `upload_failed` | 500 | 上传失败 |
| `memory_not_found` | 404 | 记忆不存在 |
| `memory_manage_failed` | 500 | 记忆写入失败 |
| `memory_search_failed` | 500 | 记忆检索失败 |
| `memory_reset_failed` | 500 | 记忆重置失败 |
| `memory_consolidate_failed` | 500 | 语义归并失败 |
| `memory_delete_failed` | 500 | 删除记忆失败 |

### 4.5 语音运行时 / 上游网关

| code | status | 说明 |
| --- | --- | --- |
| `stt_audio_empty` | 422 | STT 音频为空 |
| `stt_audio_too_large` | 413 | STT 音频过大 |
| `stt_invalid_audio` | 422 | STT 音频格式不合法 |
| `stt_no_speech_detected` | 422 | 未检测到有效语音 |
| `stt_upstream_error` | 502 | STT 上游失败 |
| `tts_text_empty` | 422 | TTS 输入文本为空 |
| `tts_candidate_forbidden` | 403 | 无权访问该 assistant candidate |
| `tts_candidate_invalid_author` | 409 | candidate 不是 assistant 作者 |
| `tts_upstream_error` | 502 | TTS 上游失败 |
| `voice_api_key_missing` | 503 | Voice API key 缺失 |
| `voice_dependency_missing` | 503 | 语音依赖不可用 |
| `voice_provider_unavailable` | 503 | 语音 provider 不可用 |
| `voice_provider_unsupported` | 400/409 | provider 不支持当前请求 |
| `voice_provider_invalid_response` | 502 | provider 返回格式非法 |
| `voice_provider_upstream_error` | 502 | provider 上游错误 |
| `voice_model_unsupported` | 400 | 语音模型不支持 |
| `external_timeout` | 504 | 外部调用超时 |

### 4.6 音色资料（voice_profiles）

| code | status | 说明 |
| --- | --- | --- |
| `voice_clone_audio_empty` | 400/422 | 克隆音频为空 |
| `voice_clone_audio_too_large` | 413 | 克隆音频过大 |
| `voice_profile_not_found` | 404 | 音色不存在 |
| `voice_profile_not_ready` | 409 | 音色尚未 ready |
| `voice_profile_patch_empty` | 400 | 音色 patch 为空 |
| `voice_preview_not_supported` | 409 | 当前音色不支持试听 |
| `voice_preview_text_missing` | 409 | 缺少试听文案 |
| `voice_profile_in_use` | 409 | 有角色仍绑定该音色，不能删除 |

## 5）命名约束

- 全小写 `snake_case`
- 尽量稳定，避免同一业务错误出现多个别名
- 优先使用业务含义，不暴露底层异常类名

推荐模式：

- 资源不存在：`{entity}_not_found`
- 权限不足：`{entity}_{action}_forbidden` 或 `{entity}_forbidden`
- 参数非法：`{entity}_{field}_invalid` / `validation_failed`
- 状态冲突：`{entity}_conflict` / `{entity}_state_conflict`
- 外部依赖：`*_upstream_error` / `external_timeout`

## 6）Message 编写约定

建议格式：

```text
summary: detail; key1=value1; key2=value2
```

示例：

```json
{
  "code": "character_not_found",
  "message": "resource not found: character does not exist; character_id=5f8f9c2f",
  "status": 404
}
```

```json
{
  "code": "feedback_target_not_on_active_branch",
  "message": "resource conflict: feedback target must be on the active branch; turn_id=...; chat_id=...",
  "status": 409
}
```

SSE 错误事件示例：

```text
data: {"type":"error","code":"llm_service_error","message":"upstream error: llm request failed after retries; model=deepseek/deepseek-chat; attempts=3"}
```

安全要求：

- `message` 只用于开发与日志排查
- 不要暴露 token、验证码、完整邮箱、密钥、堆栈、完整本地路径
- 前端展示文案应基于 `code` 自己做映射
