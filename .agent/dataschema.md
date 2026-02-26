# NeuraChar Data Schema（当前实现）

更新时间：2026-02-26

## 1. 存储概览

系统使用双存储：

1. PostgreSQL：业务主数据（用户、角色、对话、设置、收藏）
2. Milvus：向量记忆（episodic/semantic）

特性：

- 无跨库分布式事务（最终一致）
- Postgres 主键以 UUID 为主
- Milvus 主键为 `INT64 auto_id`

## 2. PostgreSQL

模型定义：`src/db/models.py`

### 2.1 枚举类型

- `visibility_t`：`PUBLIC|PRIVATE|UNLISTED`
- `chat_visibility_t`：`PUBLIC|PRIVATE|UNLISTED`
- `chat_type_t`：`ONE_ON_ONE|ROOM`
- `chat_state_t`：`ACTIVE|ARCHIVED`
- `author_type_t`：`USER|CHARACTER|SYSTEM`
- `turn_state_t`：`OK|FILTERED|DELETED|ERROR`

### 2.2 核心表

#### `users`

- 主键：`id UUID`
- 唯一：`email`、`username`

#### `user_settings`

- 主键：`user_id UUID`（FK `users.id`）
- 字段：
  - `message_font_size SMALLINT`（14~24）
  - `display_mode VARCHAR(20)`（concise/detailed）
  - `knowledge_card_enabled BOOLEAN`
  - `mixed_input_auto_translate_enabled BOOLEAN`
  - `auto_read_aloud_enabled BOOLEAN`（Phase 2 新增）
  - `created_at/updated_at`

#### `characters`

- 主键：`id UUID`
- 关联：`creator_id -> users.id (SET NULL)`

#### `chats`

- 主键：`id UUID`
- 关联：`user_id -> users.id`，`character_id -> characters.id`
- 关键字段：`active_leaf_turn_id`、`last_turn_id`、`last_turn_no`

#### `turns`

- 主键：`id UUID`
- 关联：`chat_id -> chats.id`
- 唯一：`(chat_id, turn_no)`

#### `candidates`

- 主键：`id UUID`
- 关联：`turn_id -> turns.id`
- 唯一：`(turn_id, candidate_no)`
- 扩展：`extra JSONB`

#### `saved_items`

- 主键：`id UUID`
- 关联：`user_id -> users.id`
- 唯一：`(user_id, kind, source_message_id)`

### 2.3 迁移现状

`docs/migrations/` 当前包含：

- `2026-02-16_turn_tree.sql`
- `2026-02-18_row_level_security.sql`
- `2026-02-19_user_settings.sql`
- `2026-02-24_phase1_learning.sql`
- `2026-02-26_remove_sentence_card_sentence_ipa.sql`
- `2026-02-26_phase2_voice.sql`

`2026-02-26_phase2_voice.sql` 关键变更：

- `ALTER TABLE user_settings ADD COLUMN auto_read_aloud_enabled BOOLEAN NOT NULL DEFAULT true;`

对应 Alembic 版本：`alembic/versions/20260226_0006_phase2_voice.py`

### 2.4 启动期 schema 保护

文件：`src/db/schema_guard.py`

启动时检查关键列是否存在：

- `user_settings.auto_read_aloud_enabled`

若缺失会直接失败启动，避免运行期 SQL 报错。

### 2.5 RLS 与会话上下文

- 通过 `set_config('app.current_user_id', <uuid>, true)` 注入上下文
- 已应用 RLS 的核心表：`characters/chats/turns/candidates/user_settings/saved_items`

## 3. Milvus

集合默认：`memories`

字段：

- `id INT64 auto_id`
- `user_id VARCHAR`
- `character_id VARCHAR`
- `memory_type VARCHAR`（episodic/semantic）
- `ts INT64`
- `chat_id VARCHAR`
- `text VARCHAR`
- `vector FLOAT_VECTOR(2560)`
- `group_id INT64`

索引：

- 向量字段使用 `AUTOINDEX`
- 语义相似度以 `COSINE`/`IP`（按集合）

## 4. Voice 与数据层关系

当前语音能力（STT/TTS）不新增业务表：

- STT/TTS 走上游 WebSocket，运行时处理
- 持久化仍复用原聊天模型（`turns/candidates`）
- 自动朗读开关仅落库于 `user_settings.auto_read_aloud_enabled`

## 5. 一致性说明

1. Chat 文本与学习数据落 PostgreSQL
2. 记忆向量落 Milvus
3. 两者异步协调，最终一致，不保证原子提交
