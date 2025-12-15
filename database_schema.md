# PostgreSQL 数据表结构说明（修订版 · 对齐当前 Schema）

本文档描述虚拟角色扮演 / AI 聊天系统当前使用的 PostgreSQL 数据结构，
用于支持 **角色驱动对话、多轮会话、多候选回复（Regenerate / Swipe）** 等核心能力。

---

## 1. users 表（用户表）

存储系统中的人类用户信息，是所有行为的主体。

| 字段名           | 类型          | 说明              |
| ------------- | ----------- | --------------- |
| id            | uuid        | 用户唯一标识（主键）      |
| email         | citext      | 用户邮箱（唯一，不区分大小写） |
| username      | varchar(50) | 用户名（唯一，可选）      |
| avatar_url    | text        | 用户头像            |
| created_at    | timestamptz | 账号创建时间          |
| updated_at    | timestamptz | 最近更新时间（自动维护）    |
| last_login_at | timestamptz | 最近一次登录时间        |

**设计说明**：

* 使用 `uuid` 作为主键，避免暴露自增 ID
* `citext` 保证邮箱唯一性且不区分大小写
* `updated_at` 由数据库 trigger 自动维护，避免应用层遗漏

---

## 2. email_login_codes 表（邮箱验证码表）

用于邮箱验证码登录流程，支持一次性验证码与安全校验。

| 字段名        | 类型          | 说明            |
| ---------- | ----------- | ------------- |
| id         | bigint      | 自增主键          |
| email      | citext      | 接收验证码的邮箱      |
| code_hash  | text        | 验证码哈希值（不存明文）  |
| created_at | timestamptz | 验证码生成时间       |
| expires_at | timestamptz | 过期时间          |
| used_at    | timestamptz | 使用时间（为空表示未使用） |

**设计说明**：

* 不存储明文验证码，降低泄露风险
* `expires_at + used_at` 防止验证码重放
* 与 `users` 解耦，允许“未注册用户先登录”

---

## 3. characters 表（角色表）

用于存储 AI 虚拟角色的**静态定义信息**。
角色是“蓝图（Blueprint）”，不是具体的聊天实例。

| 字段名               | 类型           | 说明                          |
| ----------------- | ------------ | --------------------------- |
| id                | uuid         | 角色唯一标识（主键）                  |
| identifier        | text         | 展示/调试用标识（不参与逻辑）             |
| name              | varchar(100) | 角色名称                        |
| description       | text         | 角色描述                        |
| system_prompt     | text         | 系统提示词                      |
| greeting_message  | text         | 默认开场白                       |
| avatar_file_name  | varchar(255) | 角色头像文件名                     |
| visibility        | enum         | PUBLIC / PRIVATE / UNLISTED |
| tags              | text[]       | 角色标签（最多 3 个）                |
| interaction_count | bigint       | 互动次数（热度指标）                  |
| creator_id        | uuid         | 创建该角色的用户                    |
| created_at        | timestamptz  | 创建时间                        |
| updated_at        | timestamptz  | 更新时间（自动维护）                  |

**设计说明**：

* `tags` 使用数组而非 jsonb，便于约束数量和索引
* `visibility` 支持公开、私有、非列表（可分享）
* `interaction_count` 用于角色广场排序，不参与业务逻辑

---

## 4. chats 表（会话表）

表示一次**用户 × 角色**之间的独立对话实例。
一个角色可以被多次开启不同的会话。

| 字段名               | 类型          | 说明                          |
| ----------------- | ----------- | --------------------------- |
| id                | uuid        | 会话唯一标识（主键）                  |
| user_id           | uuid        | 会话所属用户                      |
| character_id      | uuid        | 对话角色                        |
| type              | enum        | ONE_ON_ONE / ROOM           |
| state             | enum        | ACTIVE / ARCHIVED           |
| visibility        | enum        | PRIVATE / UNLISTED / PUBLIC |
| last_turn_at      | timestamptz | 最近一次对话时间                    |
| last_turn_id      | uuid        | 最近一次 turn                   |
| last_read_turn_no | bigint      | 用户已读到的 turn                 |
| created_at        | timestamptz | 会话创建时间                      |
| updated_at        | timestamptz | 更新时间                        |
| archived_at       | timestamptz | 归档时间                        |
| meta              | jsonb       | 扩展字段                        |

**设计说明**：

* Chat 是“对话实例”，不是对话内容
* 同一用户可与同一角色创建多个 chat（平行剧情）
* `last_turn_*` 字段用于聊天列表页性能优化
* `ARCHIVED` 用于历史会话归档，而非删除

---

## 5. turns 表（对话轮次表）

**Turn 是一个“气泡级单位”**，表示一次发言机会。
一条用户消息或一条 AI 回复，都是一个 Turn。

| 字段名                  | 类型          | 说明                              |
| -------------------- | ----------- | ------------------------------- |
| id                   | uuid        | 轮次唯一标识                          |
| chat_id              | uuid        | 所属会话                            |
| turn_no              | bigint      | 全局递增序号（分页游标）                    |
| author_type          | enum        | USER / CHARACTER / SYSTEM       |
| author_user_id       | uuid        | 发言用户（若为 USER）                   |
| author_character_id  | uuid        | 发言角色（若为 CHARACTER）              |
| state                | enum        | OK / FILTERED / DELETED / ERROR |
| is_proactive         | boolean     | 是否角色主动发起                        |
| primary_candidate_id | uuid        | 当前展示的候选回复                       |
| created_at           | timestamptz | 创建时间                            |
| updated_at           | timestamptz | 更新时间                            |
| meta                 | jsonb       | 扩展字段                            |

**设计说明**：

* Turn ≠ Message，而是“一次发言节点”
* 一个 Turn 可以拥有多个候选内容（见 candidates）
* `author_type + author_*_id` 由数据库 CHECK 强约束
* `primary_candidate_id` 决定 UI 当前显示内容

---

## 6. candidates 表（候选内容表）

存储某个 Turn 下的**具体文本版本**，用于支持 regenerate / swipe / 编辑。

| 字段名          | 类型          | 说明      |
| ------------ | ----------- | ------- |
| id           | uuid        | 候选内容 ID |
| turn_id      | uuid        | 所属 turn |
| candidate_no | bigint      | 候选序号    |
| content      | text        | 实际文本内容  |
| model_type   | varchar(80) | 使用的模型类型 |
| is_final     | boolean     | 是否生成完成  |
| rank         | int         | 可选排序字段  |
| created_at   | timestamptz | 创建时间    |
| updated_at   | timestamptz | 更新时间    |
| extra        | jsonb       | 扩展信息    |

**设计说明**：

* 一个 Turn 可对应多个 Candidate
* regenerate = 新增 candidate
* swipe = 切换 `primary_candidate_id`
* 数据不覆盖、不丢失，支持回溯与分析
* 数据库层强制保证：
  **primary_candidate 必须属于对应的 turn**

---

## 7. 表关系总览（逻辑模型）

```text
users
 ├── characters (creator_id)
 └── chats (user_id)
      └── turns (chat_id)
           └── candidates (turn_id)

characters
 └── chats (character_id)
```

---

## 8. 架构设计特点总结

* 使用 `uuid` 作为核心实体主键，适合分布式与 API 暴露
* 采用 **Chat → Turn → Candidate** 三层模型，支持高级对话交互
* 对话数据是“树状结构的线性投影”，而非简单消息流
* 所有关键一致性由数据库约束保证，而非依赖应用层
* PostgreSQL 仅负责事实存储，可与记忆系统 / 向量库解耦