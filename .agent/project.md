# NeuraChar 项目说明（当前实现）

更新时间：2026-03-20

## 1. 项目边界

NeuraChar 当前由两个代码仓库组成：

1. 后端：`E:\code\NeuraChar`
2. 前端：`E:\code\role-playing`

当前产品定位：

- 面向 C 端的 AI 角色扮演英语学习应用
- 文本聊天是主链路
- 语音输入、自动朗读、音色管理是增强能力
- 学习辅助已经进入 Phase 3：句子卡、单词卡、更好表达、收藏表达偏置

## 2. 技术栈

### 2.1 后端

- Python `3.11+`
- FastAPI
- SQLAlchemy 2 + SQLModel
- Alembic
- PostgreSQL
- Milvus
- LiteLLM
- DashScope（STT / TTS / Voice Clone）

### 2.2 前端

- Next.js `15`
- React `19`
- TypeScript `5`
- Tailwind CSS `4`
- shadcn/ui + Radix
- `react-markdown`

## 3. 当前运行链路

```text
Browser
  -> Next.js App Router (3001)
  -> rewrite /v1/* and /uploads/*
  -> FastAPI (8000)
  -> PostgreSQL / Milvus / LiteLLM / DashScope / SMTP
```

补充说明：

- 前端通过 `next.config.ts` 代理 `/v1/*` 和 `/uploads/*`
- 为了保证 SSE 正常增量刷出，前端代理层禁用了压缩

## 4. 后端结构

### 4.1 启动与装配

- 入口：`src/main.py`
- App Factory：`src/bootstrap/app_factory.py`

启动阶段当前会做：

1. 数据库连接检查
2. Schema Guard 检查
3. Langfuse 初始化（可选）
4. Memory 子系统预热
5. 语义归并 scheduler 启动（可配置）

### 4.2 当前路由模块

- `auth`
- `users`
- `upload`
- `memories`
- `characters`
- `chats`
- `turns`
- `learning`
- `saved_items`
- `voice`
- `voices`

### 4.3 分层方式

- Router：HTTP 协议与依赖注入
- Service：业务编排
- Repository：数据库 / 上游网关访问
- Schema：API Contract
- Core / Bootstrap：配置、UoW、依赖装配、异常与启动逻辑

## 5. 前端结构

### 5.1 App Router 页面

- `/login`
- `/setup`
- `/`
- `/chat/[id]`
- `/favorites`
- `/profile`

### 5.2 当前关键模块

- `src/hooks/useChatSession.ts`
  - 聊天加载、流式消息、候选切换、regen、edit、TTS feed
- `src/components/chat/ChatThread.tsx`
  - 聊天气泡列表、Word Card、Feedback Card、Knowledge Card、收藏与 loading 状态
- `src/lib/user-settings-context.tsx`
  - 用户设置本地缓存 + 云端同步
- `src/components/voice/*`
  - 音色卡片、克隆、编辑、试听

## 6. 当前已落地能力

### 6.1 账号与个人资料

- 邮箱验证码登录
- 用户资料编辑
- 用户设置持久化

### 6.2 角色与会话

- 创建 / 编辑 / 删除角色
- 角色市场
- 最近会话恢复
- 基于 turn tree 的分支聊天
- select / regen / user-edit

### 6.3 学习辅助（Phase 1 ~ 3）

- mixed-input 自动转英文
- reply suggestions
- sentence card
- word card
- feedback card（Better Expression）
- saved items / favorites
- `preferred_expression_bias_enabled` 控制收藏表达注入

### 6.4 语音

- STT：录音转文字并回填输入框
- TTS：assistant 单条播放
- Chat 流中实时自动朗读
- 音色目录
- 克隆音色
- 编辑 / 删除音色

## 7. 开发与验证命令

### 7.1 后端

常用命令：

```text
alembic upgrade head
pytest
python -m compileall src
python src/main.py
```

### 7.2 前端

常用命令：

```text
npm run dev
npx tsc --noEmit
npx eslint <files> --max-warnings 0
npm run build
```

## 8. 当前系统边界

1. PostgreSQL 与 Milvus 没有分布式事务
2. `sentence_card` 会随聊天 SSE 异步返回，不保证和 `done` 同时到达
3. `word_card` / `feedback_card` 目前按需生成，不做独立持久化
4. 音色克隆是异步能力，`POST /v1/voices/clones` 返回 `202 Accepted`
5. `docs/dev/*` 是规划记录，不应视为运行时事实来源
