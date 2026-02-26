# NeuraChar 项目说明（当前实现）

更新时间：2026-02-26

## 1. 项目边界

NeuraChar 由两个仓库组成：

1. 后端：`E:\code\NeuraChar`（FastAPI + PostgreSQL + Milvus）
2. 前端：`E:\code\role-playing`（Next.js App Router）

核心产品形态：文本聊天 + 可选语音能力（STT/TTS），不做实时双向语音通话。

## 2. 运行链路

`Browser -> Next.js -> /v1,/uploads rewrite -> FastAPI -> PostgreSQL/Milvus/LLM/DashScope/SMTP`

## 3. 后端架构

### 3.1 启动与装配

入口：`src/main.py`，装配：`src/bootstrap/app_factory.py`。

启动阶段关键动作：

1. 数据库连通性检查
2. Schema 兼容检查（`src/db/schema_guard.py`，默认开启）
3. Langfuse 初始化（可选，不阻塞）
4. Memory 预热（失败仅告警）
5. 语义归并 scheduler 启动（可配置开关）

已注册路由：

- `/v1/auth`
- `/v1/users`
- `/v1/upload`
- `/v1/memories`
- `/v1/characters`
- `/v1/chats`
- `/v1/turns`
- `/v1/saved-items`
- `/v1/voice`

### 3.2 服务分层

- Router：HTTP 入参校验、鉴权依赖注入
- Service：业务编排（chat/turn/learning/voice）
- Repository：数据库和上游依赖访问
- Core：配置、依赖管理、异常规范、UoW

### 3.3 Voice 子系统

新增组件：

- `src/api/routers/voice.py`
- `src/services/voice_service.py`
- `src/repositories/voice_gateway_repository.py`

能力：

1. STT：`POST /v1/voice/stt/transcriptions`
2. TTS 单条播放：`GET /v1/voice/tts/messages/{assistant_candidate_id}/audio`
3. Chat 流中实时 TTS 事件：`tts_audio_delta` / `tts_audio_done` / `tts_error`

当前模型默认值：

- STT：`qwen3-asr-flash-realtime`
- TTS：`qwen3-tts-instruct-flash-realtime`

兼容策略：

- STT 网关按模型分流协议：
  - `fun-asr-*` 走 `/api-ws/v1/inference` 任务协议
  - `qwen3-asr-flash-realtime*` 走 `/api-ws/v1/realtime` 协议

## 4. 前端对接边界

前端通过 `next.config.ts` 重写 `/v1/*` 与 `/uploads/*` 到后端。

关键页面：

- `/login`
- `/setup`
- `/`（market）
- `/chat/[id]`
- `/profile`

语音输入链路：

1. 麦克风录音
2. 录音转 `wav(16k, mono)`
3. 调用 `/v1/voice/stt/transcriptions`
4. 转写结果追加到输入框，不自动发送

## 5. 当前阶段能力（已落地）

### 5.1 聊天与学习

- 主聊天 SSE
- 混输转写（中文混输转英文）
- 回复建议
- 知识卡与收藏
- turn 分支（select / regen / edit）

### 5.2 语音（Phase 2）

- 自动朗读开关（`auto_read_aloud_enabled`）
- 实时 TTS 事件随聊天流返回
- 单条气泡手动 TTS
- STT 转写接口用于输入框追加

## 6. 数据与安全

- PostgreSQL + Milvus 双存储，最终一致
- 通过 `app.current_user_id` + RLS 做数据隔离
- `saved_items`、`user_settings` 已启用 RLS
- 启动时 schema guard 防止“代码字段存在但 DB 缺列”导致运行期崩溃

## 7. 重要配置（`src/core/config.py`）

- 用户设置默认值与范围
- Memory/LLM/Milvus 配置
- DashScope 语音配置：
  - `DASHSCOPE_API_KEY`
  - `DASHSCOPE_BASE_WEBSOCKET_API_URL`
  - `DASHSCOPE_STT_REALTIME_WEBSOCKET_API_URL`
  - `DASHSCOPE_TTS_WEBSOCKET_API_URL`
  - `DASHSCOPE_STT_MODEL`
  - `DASHSCOPE_TTS_MODEL`

## 8. 已知边界

1. PostgreSQL 与 Milvus 无分布式事务
2. TTS 为“可点可关”能力，不强制
3. 语音链路默认面向聊天输入/播放，不包含实时通话
