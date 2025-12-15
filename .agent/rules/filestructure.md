---
trigger: always_on
---

# Role-Playing 项目新增文件指南（给 AI 的约束）

## 0. 总原则（必须遵守）

1. **不要新建无意义的目录**（例如：features、shared、utils 大杂烩），除非我明确要求。
2. **不要移动已有文件路径**，除非我明确要求。
3. **新增文件必须放到正确位置**，并说明你新增了哪些文件、修改了哪些文件。
4. 如果你需要新增组件/工具，请优先复用现有：`src/components/*`、`src/lib/*`。
5. **不要引入新的状态管理库（Zustand/Redux）**，除非我明确要求。
6. 不要引入新的 UI 框架（Chakra/MUI 等），默认用现有 Tailwind / 简单组件。

---

## 1. 路由与布局新增规则（Next.js App Router）

### 1.1 新页面放哪里

* **需要侧边栏（App 壳）**的页面：放在
  `src/app/(app)/<route>/page.tsx`
* **不需要侧边栏（登录/引导）**的页面：放在
  `src/app/<route>/page.tsx`

> 解释：`src/app/(app)/layout.tsx` 会渲染 `<Sidebar/>`。
> 因此任何需要 Sidebar 常驻的页面，都必须在 `(app)` 下面。

### 1.2 新增动态路由

* 在 `(app)` 内新增动态路由示例：
  `src/app/(app)/characters/[id]/page.tsx`
  `src/app/(app)/chat/[id]/page.tsx`（已存在，不要重复）

### 1.3 不要创建“每个角色一个页面”

* 聊天页只有一个模板：`src/app/(app)/chat/[id]/page.tsx`
* 不允许按角色写死页面文件。

---

## 2. 组件新增规则（UI 组件放哪里）

### 2.1 业务组件

新增的业务组件统一放：

* `src/components/<ComponentName>.tsx`

命名规则：

* React 组件 **PascalCase**：`ChatMessage.tsx`、`CharacterList.tsx`
* 文件名与导出组件同名

> 注意：当前已有 `Chatmessage.tsx`，如果你新增同类组件，请用规范命名（`ChatMessage.tsx`），并避免同时存在两套同功能组件导致混乱。除非我要求你重命名迁移。

### 2.2 组件放置边界（别写到 page.tsx 里）

* `page.tsx` 只做：取 params、请求数据、组合组件渲染
* 复杂 UI、弹窗、列表、表单：放 `src/components/`

---

## 3. API / 业务请求新增规则（防止乱写 fetch）

### 3.1 所有 HTTP 请求封装统一走这里

* 统一入口：`src/lib/api.ts`

新增接口调用时：

* **优先在 `src/lib/api.ts` 里新增函数**（例如 `getPublicCharacters()`、`getOrCreateChat(id)`）
* 页面/组件里不要散落手写 `fetch(...)`（除非我明确要求）

### 3.2 SSE / WebSocket

* 如果新增 SSE/WS 的客户端封装：仍然放在 `src/lib/`
  例如：`src/lib/stream.ts` 或 `src/lib/ws.ts`
* 不要把“连接、重连、解析 chunk”逻辑直接写进组件里

---

## 4. 身份与鉴权新增规则（避免重复状态源）

* 身份状态统一由：`src/lib/auth-context.tsx` 管理
* 新增需要登录态的组件/页面：

  * **必须从 auth-context 获取用户/Token**
  * 不要再造一个新的 auth store

如果需要“路由守卫”：

* 优先在页面层判断跳转（client redirect）或在布局层处理（视需求而定）
* 不要引入第三方 auth 框架，除非我明确要求

---

## 5. 样式与静态资源新增规则

* 全局样式：`src/app/globals.css`
* 如果新增局部样式文件（不推荐）：放 `src/styles/`（仅在确实需要时）
* 图片/图标等静态资源：放 `public/`

---

## 6. 新增文件清单输出格式（你必须这样汇报）

当你新增/修改文件时，请按下面格式输出（强制）：

**新增文件**

* `path/to/new-file.tsx`：一句话说明用途
* ...

**修改文件**

* `path/to/existing-file.tsx`：修改点列表（3 条以内）
* ...

---

## 7. 常见错误清单（请你主动避免）

1. 把需要 Sidebar 的页面放到 `src/app/` 顶层 → 会导致布局不一致/Sidebar 行为异常
2. 在 `page.tsx` 里堆太多 UI 与业务细节 → 后期无法维护
3. 到处手写 fetch，不经过 `src/lib/api.ts` → 以后全站改 baseURL/鉴权会崩
4. 新增 `utils/` 然后把所有东西都丢进去 → 目录再次变垃圾桶
5. 引入 Redux/Zustand/新 UI 库 → 没必要且会加维护成本（除非我明确要求）

---

## 8. 你在生成代码前必须自检的 3 个问题

1. 这个新页面需要 Sidebar 吗？需要 → 放 `(app)`
2. 这个逻辑是 UI 细节还是 API/鉴权？UI → `components/`，API/鉴权 → `lib/`
3. 新增文件是否最少？能复用就不新建
