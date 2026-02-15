# NeuraChar Data Schema（PostgreSQL + Milvus）

本文档基于当前代码实现整理，覆盖项目中的两套持久化存储：
- PostgreSQL（业务结构化数据）
- Milvus（向量记忆数据）

当前代码来源（schema 真相）：
- `src/db/models.py`
- `src/db/session.py`
- `src/memory_system/config.py`
- `src/memory_system/clients/milvus_store.py`
- `src/memory_system/memory.py`

## 1. 总览

项目采用双存储架构：
- PostgreSQL：用户、验证码、角色、会话、轮次、候选回复等结构化实体。
- Milvus：episodic/semantic 记忆向量及叙事分组向量。

关键设计点：
- PostgreSQL 主键以 UUID 为主（`email_login_codes.id` 为自增整数）。
- Milvus 主记忆主键为自增 `INT64`，用于向量检索场景。
- `users.id` / `characters.id` 在 Milvus 中以 `string`（UUID 文本）存储，不是 UUID 原生类型。
- PostgreSQL 与 Milvus 之间没有分布式事务，属于最终一致。

## 2. PostgreSQL Schema

## 2.1 连接与会话

- 连接串：`settings.DATABASE_URL`
- 引擎：`create_async_engine(..., pool_pre_ping=True, echo=False)`
- 会话工厂：`async_sessionmaker(expire_on_commit=False, autoflush=False)`

## 2.2 PostgreSQL Enum Types（已存在）

代码中使用 `PG_ENUM(..., create_type=False)`，表示这些 enum 类型应已在数据库中存在：

| Enum Type Name | Values | 用途 |
|---|---|---|
| `visibility_t` | `PUBLIC`, `PRIVATE`, `UNLISTED` | characters/chats 可见性 |
| `chat_type_t` | `ONE_ON_ONE`, `ROOM` | chats 类型 |
| `chat_state_t` | `ACTIVE`, `ARCHIVED` | chats 状态 |
| `author_type_t` | `USER`, `CHARACTER`, `SYSTEM` | turns 作者类型 |
| `turn_state_t` | `OK`, `FILTERED`, `DELETED`, `ERROR` | turns 状态 |

## 2.3 Tables

### 2.3.1 `users`

| Column | Type | Null | Default | Constraint / Note |
|---|---|---|---|---|
| `id` | `UUID` | No | `uuid4()` | PK |
| `email` | `VARCHAR(255)` | No | - | Unique |
| `username` | `VARCHAR(50)` | Yes | - | Unique |
| `avatar_url` | `TEXT` | Yes | - | - |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | - |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` + `onupdate` | - |
| `last_login_at` | `TIMESTAMPTZ` | Yes | - | - |

关系：
- `users 1 -> n characters`（`characters.creator_id`）
- `users 1 -> n chats`（`chats.user_id`）

### 2.3.2 `email_login_codes`

| Column | Type | Null | Default | Constraint / Note |
|---|---|---|---|---|
| `id` | `INTEGER` | No | autoincrement | PK |
| `email` | `VARCHAR(255)` | No | - | 非唯一 |
| `code_hash` | `TEXT` | No | - | SHA256 hash |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | - |
| `expires_at` | `TIMESTAMPTZ` | No | - | 业务逻辑 5 分钟 |
| `used_at` | `TIMESTAMPTZ` | Yes | - | 未使用为 `NULL` |

说明：
- 同一邮箱可存在多条验证码记录（按 `created_at desc` 取最近可用记录）。
- 业务侧通过 `used_at IS NULL AND expires_at > now()` 判定有效。

### 2.3.3 `characters`

| Column | Type | Null | Default | Constraint / Note |
|---|---|---|---|---|
| `id` | `UUID` | No | `uuid4()` | PK |
| `identifier` | `TEXT` | Yes | - | 展示/调试用 |
| `name` | `VARCHAR(100)` | No | - | - |
| `description` | `TEXT` | No | - | - |
| `system_prompt` | `TEXT` | No | - | - |
| `greeting_message` | `TEXT` | Yes | - | - |
| `avatar_file_name` | `VARCHAR(255)` | Yes | - | - |
| `visibility` | `visibility_t` | No | `PRIVATE` | enum |
| `tags` | `TEXT[]` | Yes | - | 可为空数组或 NULL |
| `interaction_count` | `BIGINT` | No | `0` | 热度计数 |
| `creator_id` | `UUID` | Yes | - | FK -> `users.id` (`ON DELETE SET NULL`) |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | - |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` + `onupdate` | - |

关系：
- `characters n -> 1 users`（creator）
- `characters 1 -> n chats`

### 2.3.4 `chats`

| Column | Type | Null | Default | Constraint / Note |
|---|---|---|---|---|
| `id` | `UUID` | No | `uuid4()` | PK |
| `user_id` | `UUID` | No | - | FK -> `users.id` (`ON DELETE CASCADE`) |
| `character_id` | `UUID` | No | - | FK -> `characters.id` (`ON DELETE CASCADE`) |
| `type` | `chat_type_t` | No | `ONE_ON_ONE` | enum |
| `state` | `chat_state_t` | No | `ACTIVE` | enum |
| `visibility` | `visibility_t` | No | `PRIVATE` | enum |
| `last_turn_at` | `TIMESTAMPTZ` | Yes | - | - |
| `last_turn_id` | `UUID` | Yes | - | 当前代码未声明 FK |
| `last_read_turn_no` | `BIGINT` | Yes | - | - |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | - |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` + `onupdate` | - |
| `archived_at` | `TIMESTAMPTZ` | Yes | - | - |
| `meta` | `JSONB` | Yes | - | 扩展字段 |

关系：
- `chats n -> 1 users`
- `chats n -> 1 characters`
- `chats 1 -> n turns`（cascade delete-orphan）

### 2.3.5 `turns`

| Column | Type | Null | Default | Constraint / Note |
|---|---|---|---|---|
| `id` | `UUID` | No | `uuid4()` | PK |
| `chat_id` | `UUID` | No | - | FK -> `chats.id` (`ON DELETE CASCADE`) |
| `turn_no` | `BIGINT` | No | - | 当前代码未声明唯一约束 |
| `author_type` | `author_type_t` | No | - | enum |
| `author_user_id` | `UUID` | Yes | - | FK -> `users.id` (`ON DELETE SET NULL`) |
| `author_character_id` | `UUID` | Yes | - | FK -> `characters.id` (`ON DELETE SET NULL`) |
| `state` | `turn_state_t` | No | `OK` | enum |
| `is_proactive` | `BOOLEAN` | No | `false` | - |
| `primary_candidate_id` | `UUID` | Yes | - | 当前代码未声明 FK |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | - |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` + `onupdate` | - |
| `meta` | `JSONB` | Yes | - | 扩展字段 |

关系：
- `turns n -> 1 chats`
- `turns 1 -> n candidates`（cascade delete-orphan）

### 2.3.6 `candidates`

| Column | Type | Null | Default | Constraint / Note |
|---|---|---|---|---|
| `id` | `UUID` | No | `uuid4()` | PK |
| `turn_id` | `UUID` | No | - | FK -> `turns.id` (`ON DELETE CASCADE`) |
| `candidate_no` | `BIGINT` | No | - | 当前代码未声明唯一约束 |
| `content` | `TEXT` | No | - | - |
| `model_type` | `VARCHAR(80)` | Yes | - | 生成模型标识 |
| `is_final` | `BOOLEAN` | No | `true` | - |
| `rank` | `BIGINT` | Yes | - | 排序/评分 |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | - |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` + `onupdate` | - |
| `extra` | `JSONB` | Yes | - | 扩展字段 |

关系：
- `candidates n -> 1 turns`

## 2.4 关系图（逻辑）

```text
users
  ├─< characters (creator_id, on delete set null)
  └─< chats (user_id, on delete cascade)

characters
  └─< chats (character_id, on delete cascade)

chats
  └─< turns (chat_id, on delete cascade)

turns
  └─< candidates (turn_id, on delete cascade)
```

## 2.5 PostgreSQL 当前约束与索引现状

当前 ORM 明确声明的约束主要包括：
- 主键（各表）
- 唯一约束：`users.email`，`users.username`
- 外键及删除策略（`CASCADE` / `SET NULL`）
- enum 列类型

当前 ORM 未显式声明：
- 复合唯一键（如 `turns(chat_id, turn_no)`、`candidates(turn_id, candidate_no)`）
- 业务索引（如 `characters(creator_id, visibility)`、`email_login_codes(email, created_at)`）

如果线上库已有额外索引/约束（通过 SQL migration 创建），以实际数据库为准。

## 3. Milvus Vector Schema

## 3.1 配置

来自 `MemoryConfig`：
- `milvus_uri`: `MILVUS_URL`
- `collection_name`: 默认 `"memories"`
- `embedding_dim`: `2560`

系统初始化时会执行：
- `Memory.__init__` -> `self._store.create_collection(dim=self._config.embedding_dim)`

## 3.2 主集合：`memories`（默认名，可配置）

字段定义（`MilvusStore.SCHEMA_FIELDS`）：

| Field | DataType | Constraint / Meaning |
|---|---|---|
| `id` | `INT64` | PK, auto_id |
| `user_id` | `VARCHAR(128)` | 用户标识（通常存 UUID 字符串） |
| `character_id` | `VARCHAR(128)` | 角色标识（通常存 UUID 字符串） |
| `memory_type` | `VARCHAR(32)` | 业务值通常为 `episodic` / `semantic` |
| `ts` | `INT64` | Unix 时间戳（秒） |
| `chat_id` | `VARCHAR(128)` | 对话线程标识 |
| `text` | `VARCHAR(65535)` | 记忆文本 |
| `vector` | `FLOAT_VECTOR(2560)` | 语义向量 |
| `group_id` | `INT64` | 叙事组 ID，默认 `-1` 表示未分组 |

集合属性：
- `enable_dynamic_field=True`

向量索引：
- field: `vector`
- index_type: `AUTOINDEX`
- metric_type: `COSINE`

## 3.3 分组集合：`groups`（固定名）

字段定义（`MilvusStore.GROUP_SCHEMA_FIELDS`）：

| Field | DataType | Constraint / Meaning |
|---|---|---|
| `group_id` | `INT64` | PK, auto_id |
| `user_id` | `VARCHAR(128)` | 用户标识 |
| `character_id` | `VARCHAR(128)` | 角色标识 |
| `centroid_vector` | `FLOAT_VECTOR(2560)` | 组中心向量 |
| `size` | `INT64` | 组内成员数量 |

集合属性：
- `enable_dynamic_field=True`

向量索引：
- field: `centroid_vector`
- index_type: `AUTOINDEX`
- metric_type: `IP`（内积，配合归一化向量）

## 3.4 Milvus 查询过滤模式

当前实现通过 filter expression 组合进行查询：
- 基础过滤：`user_id == "..." and character_id == "..."`
- 额外过滤示例：
  - `memory_type == "episodic"`
  - `memory_type == "semantic"`
  - `group_id == <int>`
  - `id in [1,2,3]`

过滤构造函数：
- `build_filter(user_id, character_id, extra)`（`character_id` 必填，`user_id` 可选）

## 3.5 Milvus 记忆记录逻辑模型

运行时 `MemoryRecord`：

| Field | Type |
|---|---|
| `id` | `int` |
| `user_id` | `str` |
| `character_id` | `str` |
| `memory_type` | `str` |
| `ts` | `int` |
| `chat_id` | `str` |
| `text` | `str` |
| `group_id` | `int` (default `-1`) |

## 3.6 根目录运维脚本补充信息

后端根目录有两个与向量库相关的脚本：

1. `check_collection_status.py`
- 连接 `MilvusClient` 后检查两个集合：`memories`、`groups`。
- 读取信息包括：
  - `get_load_state(collection_name=...)`
  - `has_collection(...)`
  - `get_collection_stats(...)`（包含 `row_count`）
  - `describe_collection(...)`（完整 schema 元信息）

2. `delete_collection.py`
- 仅删除 `memories` 集合，不删除 `groups`。
- 行为：
  - 若存在 `memories` -> `drop_collection("memories")`
  - 若不存在 -> 输出不存在提示

运维注意点：
- 两个脚本都只读取 `MILVUS_URL`。
- 未设置 `MILVUS_URL` 时脚本会直接退出，不会使用任何默认地址。

## 4. 跨库映射与一致性

## 4.1 ID 映射

- PostgreSQL:
  - `users.id` / `characters.id` / `chats.id` 等为 UUID。
- Milvus:
  - `user_id` / `character_id` / `chat_id` 为字符串。
  - `id`（memory 主键）为 Milvus 自增 INT64。

因此跨库关联是“值映射”而不是 FK。

## 4.2 一致性边界

- 无跨 PostgreSQL 与 Milvus 的原子事务。
- `memory.manage/search/reset/consolidate` 操作仅作用于 Milvus。
- 用户和角色的主数据在 PostgreSQL；记忆向量在 Milvus。

## 5. 当前实现中的结构注意事项

1. PostgreSQL enum 类型由数据库预置
- 代码中 `create_type=False`，如果目标库缺少 `visibility_t` 等 enum，会在建表/查询时失败。

2. 部分聊天表约束未在 ORM 显式声明
- 如 `turn_no`、`candidate_no` 的复合唯一性未在 ORM 定义。
- 如果业务依赖这些约束，建议通过 migration 显式加上。

3. `characters.name` 的 DB 限制与 API 校验上限不同
- DB 列：`VARCHAR(100)`
- API 创建：`max_length=10`
- API 更新：`max_length=100`

4. 记忆集合字段 `memory_type` 是字符串而非枚举
- 当前业务写入值为 `episodic` / `semantic`，但 Milvus schema 不强制枚举值。

5. 无迁移目录（Alembic/SQL）
- 当前仓库没有可见 migration 文件，部署时需确认线上实际 schema 与本文是否一致。

## 6. 建议的变更控制策略

- 将 PostgreSQL schema（含 enum、索引、约束）纳入可回放 migration（Alembic）。
- 将 Milvus collection schema 版本化（例如 `memories_v2` + 迁移脚本）。
- 在 CI 增加 schema drift 检查：
  - ORM 与真实 PG schema 对比
  - Milvus collection fields/index 配置校验

文档更新时间：2026-02-15 15:48:28
