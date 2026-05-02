# ParlaSoul 前端响应与错误处理

更新时间：2026-05-02

## 1. 文档范围

- 本文档描述前端仓库 `E:\code\parlasoul-frontend` 当前真实响应处理。
- 重点文件：
  - `src/lib/http-client.ts`
  - `src/lib/better-auth-token.ts`
  - `src/lib/token-store.ts`
  - `src/lib/error-map.ts`
  - `src/lib/query/query-client.ts`
  - `src/lib/auth-context.tsx`

## 2. 成功响应处理

`src/lib/http-client.ts` 统一处理普通 JSON 请求。

优先按后端成功包裹解包：

```json
{
  "code": "ok",
  "message": "ok",
  "status": 200,
  "data": {}
}
```

当前规则：

- 如果响应体包含 `code/status/data`，返回 `data`。
- 如果响应体不是统一包裹，直接把原 JSON 视为业务数据。
- `204 No Content` 返回 `undefined`。

## 3. 鉴权与 JWT

当前认证主链路是 `better-auth`：

- `AuthProvider` 使用 `authClient.useSession()` 读取 cookie session。
- `AuthProvider` 通过 TanStack Query 拉取 `/v1/users/me` 和 `/v1/users/me/entitlements`。
- `fetchWithBetterAuth()` 会按需调用 `authClient.token()` 获取 better-auth JWT，并写入 `Authorization: Bearer <jwt>`。
- JWT 只在 `src/lib/better-auth-token.ts` 的内存缓存里保存，默认按 token `exp` 或保守 14 分钟缓存。
- 如果一次 `/v1/*` 请求返回 `401`，`fetchWithBetterAuth()` 会清 JWT，并在可获得新 JWT 时自动重试一次。

`src/lib/token-store.ts` 当前只定义错误类，不再是登录 token 的本地状态源。

## 4. 错误类

### 4.1 `UnauthorizedError`

- 默认 message：`authorization failed`
- 语义：
  - better-auth JWT 缺失或失效
  - 登录态需要刷新或重新登录

### 4.2 `ApiError`

结构：

```ts
new ApiError(status, code?, detail?)
```

字段：

- `status`
- `code?`
- `detail?`

## 5. `httpClient` 失败处理

`throwApiErrorResponse()` 会读取失败 JSON 中的：

- `code`
- `message`
- `detail`

当前规则：

- HTTP `401`
  - 清空 better-auth JWT 内存缓存
  - 抛出 `UnauthorizedError`
- 其他非 2xx
  - 抛出 `ApiError(status, code, message)`

TanStack Query 的默认重试策略在 `src/lib/query/query-client.ts`：

- `UnauthorizedError` 不重试。
- `ApiError` 的 `4xx` 不重试。
- 其他错误最多重试 2 次。
- mutation 默认不重试。

## 6. 手写 `fetch` 的失败处理

SSE、二进制、`FormData`、Realtime WebRTC 信令等接口不都走 `httpClient`，但错误口径仍复用：

- `throwApiErrorResponse(response)`
- `ApiError`
- `UnauthorizedError`

当前手写路径包括：

- 聊天 / regen / edit SSE
- 学习助手 SSE
- STT `FormData`
- 音色克隆 `FormData`
- TTS / 音色试听二进制音频
- Realtime `/v1/realtime/config`、`/v1/realtime/session`、`DELETE /v1/realtime/session/{session_id}`

STT 额外约定：

- HTTP `422` 会抛 `ApiError(422, errorData.code ?? "no_speech", errorMessage)`。

## 7. SSE 与二进制响应

### 7.1 SSE

下面 4 个接口按 `text/event-stream` 解析：

- `/v1/chats/{chat_id}/stream`
- `/v1/turns/{turn_id}/regen/stream`
- `/v1/turns/{turn_id}/edit/stream`
- `/v1/learning/assistant/stream`

当前解析规则：

- 只处理以 `data:` 开头的行。
- 每一行尝试 `JSON.parse`。
- 解析失败的行直接忽略。

SSE 错误事件口径：

```json
{
  "type": "error",
  "code": "...",
  "message": "..."
}
```

### 7.2 二进制

下面接口返回 `ArrayBuffer` 或流式音频：

- `/v1/voice/tts/messages/{assistant_candidate_id}/audio`
- `/v1/voices/{voice_id}/preview/audio`

### 7.3 `FormData`

下面接口当前走 `FormData`：

- `/v1/voice/stt/transcriptions`
- `/v1/voices/clones`

## 8. 错误映射入口

错误文案映射集中在：

- `src/lib/error-map.ts`

输出结构：

```ts
{
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  rawMessage?: string;
}
```

公开辅助函数：

- `mapApiError`
- `getErrorMessage`
- `isSevereError`

## 9. 当前映射策略

映射顺序：

1. 如果是 `ApiError`
   - 优先使用 `code`
   - 再回退到 HTTP `status`
2. 特判服务端 detail：
   - 已有有效权益时重复购买
   - `character is unpublished`
3. 如果 detail 中包含阿里云上游字段：
   - 解析 `upstream_code`
   - 映射到阿里云语音专用文案
4. 如果是普通 `Error`
   - 先检查 `character is unpublished`
   - 再检查阿里云上游字段
   - 再检查已知运行时错误
   - 再判断网络错误
5. 最终回退到默认文案

当前用户可见文案必须优先使用中文映射；`rawMessage` 只保留给调试。

## 10. 当前已映射的错误类别

- 通用 HTTP 状态码：`400/401/403/404/409/422/429/500/502/503`
- 认证与订阅：`unauthorized`、`subscription_required`、`subscription_expired`、`feature_not_enabled`
- 支付：Dodo checkout / portal / subscriptions / payments 相关错误
- 角色生命周期：`character_unpublished`
- 麦克风：`MIC_PERMISSION_DENIED`、`MIC_DEVICE_NOT_FOUND`、`MIC_DEVICE_BUSY`、`MIC_INSECURE_CONTEXT`、`MIC_API_UNAVAILABLE`、`MIC_START_FAILED`
- STT：`NO_SPEECH`、`STT.NoSpeech`、`STT.TranscriptionFailed`
- TTS / 音色：`voice_profile_not_selectable`、`voice_profile_not_ready`、`voice_preview_text_missing`、`voice_preview_not_supported`、`voice_not_found`、`TTS.VoiceNotReady`、`TTS.VoiceNotFound`
- 阿里云音频预处理：`Audio.DurationLimitError`、`Audio.FormatError`、`Audio.QualityError`、`Audio.FileTooLargeError`、`Audio.PreprocessError`、`Audio.SilentAudioError`、`Audio.SpeechNotDetectedError`
- 音色克隆：`VoiceClone.CreateFailed`、`VoiceClone.ProcessingFailed`

任何新增后端错误码如果需要 UI 可读，必须同步更新 `src/lib/error-map.ts`。

## 11. 恢复与回滚行为

- `401`
  - 清 better-auth JWT 缓存
  - `AuthProvider` 重新解析 session/profile
  - 受保护壳层回退到登录或 setup 流程
- 设置同步失败
  - 保留本地状态
  - 允许重试同步
- 收藏失败
  - optimistic update 回滚到旧状态
- 聊天流失败
  - 错误文本落进临时 assistant 消息
  - 按条件重新拉 snapshot 校正
- 麦克风取消或失败
  - 录音状态回到可再次启动状态
- Realtime 连接失败
  - 清连接态、复位麦克风捕获状态、展示可映射错误
- 播放器失败
  - 清空 active 播放状态

## 12. 当前前端约束

- 页面和弹窗优先展示 `getErrorMessage(err)`。
- 不直接向用户展示服务端英文 detail。
- `rawMessage` 只用于排障。
- 不新增第二套错误类或第二套响应解包逻辑。
