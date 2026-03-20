# NeuraChar Data Schema（当前实现）

更新时间：2026-03-20

## 1. 存储概览

系统当前使用三类存储：

1. PostgreSQL：业务主数据
2. Milvus：向量记忆
3. 本地文件系统：上传图片与静态资源

一致性原则：

- PostgreSQL 与 Milvus 之间没有分布式事务
- 记忆写入、语义归并、叙事分组属于异步或最终一致流程
- 学习卡片不单独建表，而是落在 `candidates.extra` 或 `saved_items.card`

## 2. PostgreSQL

模型定义：`src/db/models.py`

### 2.1 枚举类型

- `visibility_t`: `PUBLIC | PRIVATE | UNLISTED`
- `chat_visibility_t`: `PUBLIC | PRIVATE | UNLISTED`
- `chat_type_t`: `ONE_ON_ONE | ROOM`
- `chat_state_t`: `ACTIVE | ARCHIVED`
- `author_type_t`: `USER | CHARACTER | SYSTEM`
- `turn_state_t`: `OK | FILTERED | DELETED | ERROR`

### 2.2 核心表

#### `users`

- 主键：`id UUID`
- 唯一：`email`、`username`
- 关联：
  - `characters.creator_id`
  - `chats.user_id`
  - `voice_profiles.owner_user_id`
  - `saved_items.user_id`

#### `user_settings`

- 主键：`user_id UUID`
- 当前字段：
  - `message_font_size SMALLINT`
  - `display_mode VARCHAR(20)`
  - `knowledge_card_enabled BOOLEAN`
  - `mixed_input_auto_translate_enabled BOOLEAN`
  - `auto_read_aloud_enabled BOOLEAN`
  - `preferred_expression_bias_enabled BOOLEAN`
  - `created_at`
  - `updated_at`

当前运行时强依赖：

- `auto_read_aloud_enabled`
- `preferred_expression_bias_enabled`

#### `email_login_codes`

- 主键：`id`
- 字段：
  - `email`
  - `code_hash`
  - `created_at`
  - `expires_at`
  - `used_at`

#### `voice_profiles`

- 主键：`id UUID`
- 唯一：`(provider, provider_voice_id)`
- 重要字段：
  - `owner_user_id`
  - `provider`
  - `provider_voice_id`
  - `provider_model`
  - `source_type`
  - `status`
  - `provider_status`
  - `display_name`
  - `description`
  - `preview_text`
  - `preview_audio_url`
  - `language_tags`
  - `metadata JSONB`
  - `created_at`
  - `updated_at`

当前索引：

- `voice_profiles_owner_user_created_at_idx`
- `voice_profiles_provider_status_idx`

#### `characters`

- 主键：`id UUID`
- 关联：`creator_id -> users.id (SET NULL)`
- 当前语音绑定字段：
  - `voice_provider`
  - `voice_model`
  - `voice_provider_voice_id`
  - `voice_source_type`
- 其他关键字段：
  - `identifier`
  - `name`
  - `description`
  - `system_prompt`
  - `greeting_message`
  - `avatar_file_name`
  - `tags`
  - `visibility`
  - `interaction_count`

#### `chats`

- 主键：`id UUID`
- 外键：
  - `user_id -> users.id`
  - `character_id -> characters.id`
- 关键字段：
  - `type`
  - `state`
  - `visibility`
  - `last_turn_at`
  - `last_turn_id`
  - `last_turn_no`
  - `active_leaf_turn_id`
  - `last_read_turn_no`
  - `meta`

#### `turns`

- 主键：`id UUID`
- 外键：`chat_id -> chats.id`
- 唯一：`(chat_id, turn_no)`
- 关键字段：
  - `parent_turn_id`
  - `parent_candidate_id`
  - `author_type`
  - `author_user_id`
  - `author_character_id`
  - `state`
  - `is_proactive`
  - `primary_candidate_id`
  - `meta`

#### `candidates`

- 主键：`id UUID`
- 外键：`turn_id -> turns.id`
- 唯一：`(turn_id, candidate_no)`
- 关键字段：
  - `candidate_no`
  - `content`
  - `model_type`
  - `is_final`
  - `rank`
  - `extra JSONB`

当前 `extra` 已使用的业务字段：

- `input_transform`
- `sentence_card`
- 占位/来源标记（如 stream placeholder、regen placeholder）

#### `saved_items`

- 主键：`id UUID`
- 外键：`user_id -> users.id`
- 当前唯一约束：

```text
(user_id, kind, display_surface)
```

- 重要字段：
  - `kind`
  - `display_surface`
  - `display_zh`
  - `card JSONB`
  - `source_role_id`
  - `source_chat_id`
  - `source_message_id`
  - `source_turn_id`
  - `source_candidate_id`
  - `source_meta`
  - `created_at`

当前 `kind`：

- `sentence_card`
- `word_card`
- `feedback_card`

说明：

- `word_card` 和 `feedback_card` 没有独立业务表
- 收藏落库时统一进入 `saved_items.card`
- 服务端按 `display_surface` 做去重，不再按 `source_message_id` 去重

## 3. Alembic 迁移现状

当前迁移目录：`alembic/versions/`

已存在版本：

1. `20260216_0001_turn_tree.py`
2. `20260218_0002_row_level_security.py`
3. `20260219_0003_user_settings.py`
4. `20260224_0004_phase1_learning.py`
5. `20260226_0005_remove_sentence_card_sentence_ipa.py`
6. `20260226_0006_phase2_voice.py`
7. `20260227_0007_phase2_1_voice_profiles.py`
8. `20260227_0008_phase2_2_character_voice_binding_direct.py`
9. `20260320_0009_voice_profile_preview_text.py`
10. `20260320_0010_phase3_learning_bias.py`
11. `20260320_0011_phase3_expression_bias_toggle.py`

当前头版本：`20260320_0011`

其中最近两次与 Phase 3 直接相关：

- `20260320_0010_phase3_learning_bias.py`
  - `saved_items` 唯一约束改为 `(user_id, kind, display_surface)`
- `20260320_0011_phase3_expression_bias_toggle.py`
  - `user_settings` 新增 `preferred_expression_bias_enabled`

## 4. 启动期 Schema Guard

文件：`src/db/schema_guard.py`

启动时会检查以下表/列是否存在：

- `user_settings.auto_read_aloud_enabled`
- `user_settings.preferred_expression_bias_enabled`
- `characters.voice_provider`
- `characters.voice_model`
- `characters.voice_provider_voice_id`
- `characters.voice_source_type`
- `voice_profiles` 的核心字段集合

如果缺列，会在 API 启动阶段直接失败，并提示执行：

```text
alembic upgrade head
```

## 5. Row-Level Security 与会话上下文

项目继续使用 PostgreSQL RLS 做用户隔离，依赖：

```sql
set_config('app.current_user_id', '<uuid>', true)
```

当前关键受保护表包括：

- `characters`
- `chats`
- `turns`
- `candidates`
- `user_settings`
- `saved_items`
- `voice_profiles`

## 6. Milvus

默认集合：`memories`

当前字段：

- `id INT64 auto_id`
- `user_id VARCHAR`
- `character_id VARCHAR`
- `memory_type VARCHAR`
- `ts INT64`
- `chat_id VARCHAR`
- `text VARCHAR`
- `vector FLOAT_VECTOR(2560)`
- `group_id INT64`

当前使用方式：

- episodic / semantic 统一落一个集合
- embedding 维度由 `MEMORY_EMBEDDING_DIM=2560` 控制
- 相似度检索与叙事分组由 memory 子系统封装

## 7. 当前数据层边界

1. 文本聊天、学习收藏、用户设置、音色资料都落 PostgreSQL
2. 记忆向量与相似检索落 Milvus
3. `sentence_card` 在聊天完成后写入 `candidates.extra`
4. `word_card` / `feedback_card` 只在生成响应和收藏时出现，不做独立持久化表
