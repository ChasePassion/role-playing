# 前端审阅不修复问题清单

> 本文档记录代码审阅中讨论过、确认暂不修复的问题。每个问题包含位置、问题描述、不修复原因和风险评估。

---

## #1 — GET/DELETE 请求无条件设置 Content-Type

**文件:** `src/lib/http-client.ts:79-80`
**问题:** `HttpClient.request()` 方法对所有请求（包括 GET/DELETE）无条件设置 `Content-Type: application/json`，而 GET/DELETE 请求不携带 body。

**代码片段:**
```typescript
// src/lib/http-client.ts:74-80
private async request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };
```

**不修复原因:** HTTP 规范要求服务端忽略无 body 请求的 Content-Type header。实际所有主流服务端框架（Express、FastAPI、Nginx、CDN）都合规处理，不会因此产生任何问题。

**风险:** 无

---

## #2 — compress: false 全局关闭压缩

**文件:** `next.config.ts:44-46`
**问题:** `compress: false` 全局关闭了 Next.js 的 gzip 压缩。

**代码片段:**
```typescript
// next.config.ts:43-46
const baseConfig: NextConfig = {
  // Disable compression so SSE responses aren't buffered by the proxy layer.
  // (Streaming endpoints rely on incremental flush of chunks.)
  compress: false,
```

**不修复原因:** 为防止 SSE 流被中间层缓冲的已知取舍，注释已清楚说明原因。生产环境应在 nginx/反向代理层按路由粒度控制压缩策略（对 SSE 端点禁用，对静态资源启用）。

**风险:** 低（静态资源传输体积略大，可通过 CDN 或 nginx 层补偿）

---

## #3 — pendingShareCards 从 React Query 同步到 local state

**文件:** `src/lib/growth-context.tsx:159-163`
**问题:** `pendingShareCards` 通过 useEffect 从 React Query 结果同步到 useState local state。`enqueueShareCard` / `dismissShareCard` 只改 local state 不改 query cache，当 query refetch 触发时本地修改会被覆盖。

**代码片段:**
```typescript
// src/lib/growth-context.tsx:159-163
useEffect(() => {
  if (pendingShareCardsQuery.data) {
    setPendingShareCards(pendingShareCardsQuery.data.items);
  }
}, [pendingShareCardsQuery.data]);
```

**不修复原因:** 实际触发数据丢失的场景极少——用户操作 share card 时不会触发 query refetch（refetch 仅在 userId 变化时触发）。重构为完全基于 query cache 的方案需要大幅改动 enqueue/dismiss 的调用链，成本大、收益低。

**风险:** 低

---

## #4 — createNewChatId 绕过 useMutation

**文件:** `src/lib/chat-helpers.ts:18-37`
**问题:** `createNewChatId` 绕过 `useMutation`，直接命令式调用 `queryClient.setQueryData` / `invalidateQueries`，不符合 React Query 的惯用模式。

**代码片段:**
```typescript
// src/lib/chat-helpers.ts:18-37
export async function createNewChatId(
    queryClient: QueryClient,
    userId: string | null | undefined,
    characterId: string,
): Promise<string> {
    const created = await createChatInstance({ character_id: characterId });
    queryClient.setQueryData(queryKeys.chats.recent(userId, characterId), {
        chat: created.chat,
        character: created.character,
    });
    await Promise.all([
        queryClient.invalidateQueries({
            queryKey: queryKeys.sidebar.characters(userId),
        }),
        queryClient.invalidateQueries({
            queryKey: queryKeys.chats.history(userId, characterId),
        }),
    ]);
    return created.chat.id;
}
```

**不修复原因:** 设计取舍。该函数在非 React 上下文（如路由跳转前）中使用，需要接收 QueryClient 作为参数。改为 mutation 需要重构所有调用方为 React 组件内调用，改动范围大且不解决实际问题。

**风险:** 无

---

## #5 — token-store.ts 文件名误导

**文件:** `src/lib/token-store.ts`
**问题:** 文件名 `token-store.ts` 暗示存储 token 的功能，实际只导出 `ApiError` 和 `UnauthorizedError` 两个错误类。

**代码片段:**
```typescript
// src/lib/token-store.ts (完整文件)
export class UnauthorizedError extends Error { ... }
export class ApiError extends Error { ... }
```

**不修复原因:** 纯命名问题。重命名为 `api-errors.ts` 需要更新所有 import 路径（至少 `http-client.ts` 等多处引用），机械性工作但收益极低，可通过 IDE 批量重构一次性解决但无紧迫性。

**风险:** 无

---

## #6 — FeedbackCardPopover key_phrases 用 index 做 key

**文件:** `src/components/FeedbackCardPopover.tsx:55`
**问题:** `key_phrases.map` 使用 `key={idx}` 而非唯一 ID。

**代码片段:**
```tsx
// src/components/FeedbackCardPopover.tsx:54-55
{feedbackCard.key_phrases.map((kp, idx) => (
    <div key={idx} className="flex flex-col gap-0.5">
```

**不修复原因:** `key_phrases` 为 API 返回的只读数据，API 设计上该数据结构（KeyPhrase 只有 surface/ipa_us/zh 字段）没有唯一 ID。列表在 Popover 生命周期内不变、不会动态增删重排，index 做 key 安全。

**风险:** 无

---

## #7 — ReplyCardPopover key_phrases 用 index 做 key

**文件:** `src/components/ReplyCardPopover.tsx:51`
**问题:** `key_phrases.map` 使用 `key={idx}` 而非唯一 ID。

**代码片段:**
```tsx
// src/components/ReplyCardPopover.tsx:50-51
{replyCard.key_phrases.map((kp, idx) => (
    <div key={idx} className="flex flex-col gap-0.5">
```

**不修复原因:** 同 #6，`key_phrases` 为 API 返回的只读数据，无唯一 ID 字段，列表在 Popover 生命周期内不变，index 做 key 安全。

**风险:** 无

---

## #8 — WordCardPopover pos_groups 和 senses 用 index 做 key

**文件:** `src/components/WordCardPopover.tsx:53,57`
**问题:** `pos_groups.map` 使用 `key={idx}`，`senses.map` 使用 `key={sIdx}`，均无唯一 ID。

**代码片段:**
```tsx
// src/components/WordCardPopover.tsx:52-57
{wordCard.pos_groups.map((group, idx) => (
    <div key={idx}>
        <span ...>{group.pos}</span>
        <div className="mt-1 space-y-1">
            {group.senses.map((sense, sIdx) => (
                <p key={sIdx} className="text-sm text-gray-700">
```

**不修复原因:** 同 #6/#7，`pos_groups` 和 `senses` 为 API 返回的只读数据（WordCardPosGroup 只有 pos/senses 字段，Sense 只有 zh/note 字段），均无唯一 ID。列表在 Popover 生命周期内不变，index 做 key 安全。

**风险:** 无

---

## #9 — share 页面用原生 img 加载 SVG

**文件:** `src/app/share/[slug]/page.tsx:19-20,161-162`
**问题:** 使用原生 `<img>` 加载 `/icon.svg` 并通过 `eslint-disable` 抑制 `@next/next/no-img-element` 规则。

**代码片段:**
```tsx
// src/app/share/[slug]/page.tsx:19-25
{/* eslint-disable-next-line @next/next/no-img-element */}
<img
  src="/icon.svg"
  alt="ParlaSoul"
  className="size-7 rounded-lg"
  width={28}
  height={28}
/>
```

**不修复原因:** `/icon.svg` 是 public 目录下的本地静态 SVG（28x28 像素）。`next/image` 对本地 SVG 不提供实际收益——不做格式转换、不做尺寸适配，反而需要 `dangerouslyAllowSVG` 配置并引入额外 JS 运行时。`eslint-disable` 注释明确标注了原因，保持现状合理。

**风险:** 无

---

## #10 — ChatThread.tsx 大组件未拆分

**文件:** `src/components/chat/ChatThread.tsx`（1256 行）
**问题:** 11 个 useState、3 个 useFloating、3 处内联 optimistic favorite 切换逻辑（重复了 Popover 组件中已有的 `useOptimisticFavorite` hook），职责过多。

**不修复原因:** 大规模拆分风险高、工作量大（需要处理共享状态、floating-ui 实例、回调依赖链等），当前功能稳定不急迫。如未来需要修改该组件，可在局部重构时顺路拆分。

**风险:** 低（可维护性略差，但不影响功能和性能）

---

## #11 — chat/[id]/page.tsx 大页面组件未拆分

**文件:** `src/app/(app)/chat/[id]/page.tsx`（903 行）
**问题:** ~200 行滚动逻辑、~80 行 realtime 重载、~130 行聊天历史 CRUD 混在一个页面组件中，职责未分离。

**不修复原因:** 同 #10，拆分工作量大、需要处理大量 useEffect 依赖链和共享 ref，功能稳定暂不动。

**风险:** 低

---

## #12 — Billing/Pricing 组件未拆分

**文件:** `src/components/billing/BillingPageContent.tsx`（656 行）、`src/components/billing/PricingPageContent.tsx`（686 行）
**问题:** 两个计费组件各 650+ 行，职责未拆分。

**不修复原因:** 同 #10/#11，低优先级。功能稳定，拆分不会带来用户可感知的改善。

**风险:** 低

---

## #13 — globals.css 暗色模式变量缺失

**文件:** `src/app/globals.css`
**问题:** 24+ 自定义 CSS 变量（`--bg-primary`、`--text-primary/secondary/tertiary`、`--sidebar-*`、`--workspace-bg`、`--divider`、`--input-border`、`--user-bubble`、`--send-button`、`--glass-*`、`--cc-*` 等）缺少 `.dark` 块覆盖，暗色模式下这些变量仍为亮色值。

**代码片段:**
```css
/* src/app/globals.css:7-35 — 只有 :root 定义，无对应 .dark 覆盖 */
:root {
  --bg-primary: #fff;
  --text-primary: #0d0d0d;
  --text-secondary: #5d5d5d;
  --sidebar-bg: #f2f2f2;
  --workspace-bg: #ffffff;
  --user-bubble: #e5f3ff;
  --send-button: #924ff7;
  /* ... */
}
```

**不修复原因:** 项目当前未上线暗色模式功能（`.dark` 块中只有 shadcn/radix 语义变量的暗色覆盖，见第 694-726 行）。等真正需要暗色模式时，应统一设计暗色色板、一次性处理所有变量，而非逐个修补。

**风险:** 无（当前不使用暗色模式）

---

## #14 — 缺少 Error Boundary

**范围:** 整个应用无 `error.tsx` / `global-error.tsx`
**问题:** 任何未捕获的 JS 错误会导致白屏，没有优雅降级的 UI。

**不修复原因:** 崩溃后即使保留侧边栏等壳组件，用户也无法进行有意义的操作（所有上下文已丢失）。当前应用的错误处理在各组件层面已覆盖已知场景，通用的 Error Boundary 对用户体验改善有限。

**风险:** 低（极端情况下白屏，但用户刷新即可恢复）

---

## #15 — user-settings-context 7 个独立 useState + setter

**文件:** `src/lib/user-settings-context.tsx:112-118`
**问题:** 7 个设置字段各自使用独立的 useState 和 useCallback setter，加上 latestRef 模式，看起来冗长。建议改用 useReducer。

**代码片段:**
```typescript
// src/lib/user-settings-context.tsx:112-118
const [messageFontSize, setMessageFontSizeState] = useState(defaultState.messageFontSize);
const [displayMode, setDisplayModeState] = useState<DisplayMode>(defaultState.displayMode);
const [memoryEnabled, setMemoryEnabledState] = useState(defaultState.memoryEnabled);
const [replyCardEnabled, setReplyCardEnabledState] = useState(defaultState.replyCardEnabled);
const [mixedInputAutoTranslateEnabled, setMixedInputAutoTranslateEnabledState] = useState(...);
const [autoReadAloudEnabled, setAutoReadAloudEnabledState] = useState(...);
const [preferredExpressionBiasEnabled, setPreferredExpressionBiasEnabledState] = useState(...);
```

**不修复原因:**
1. 消费端 `SettingsModal` 每个字段独立绑定到 `Switch`/`Slider` 组件，独立 setter 的类型安全性和直接性更好。
2. `latestRef` 的存在是因为 `syncSettings` 需要在 debounced 异步回调中读取最新值，`useReducer` 同样解决不了这个闭包问题（dispatch 后 state 在当前回调中仍是旧值）。
3. 改 `useReducer` 不会减少代码量（需要 reducer 函数 + action type + dispatch 调用），反而增加间接层。

**风险:** 无

---

## #16 — 约 72 处内联 style={{}} 创建新对象引用

**范围:** ChatMainFrame、ChatHeader、CharacterCard、ChatInput、ChatThread、HeroCarousel、SettingsModal、PricingPageContent、MessageNavigator、AvatarCropper 等 19 个文件
**问题:** 每次渲染通过 `style={{}}` 创建新对象引用，理论上阻止 React.memo 浅比较。

**代码片段（典型示例）:**
```tsx
// ChatInput.tsx — speaking capsule 动态高度
style={{
    width: SPEAKING_CAPSULE_WIDTHS[index],
    height: SPEAKING_CAPSULE_MIN_HEIGHTS[index] + level * SPEAKING_CAPSULE_TRAVEL[index],
    backgroundColor: "rgba(255, 255, 255, 0.92)",
}}
```

**不修复原因:**
1. 绝大多数是 CSS 自定义属性绑定（`--header-height`、`--workspace-bg`）、动态 URL（`backgroundImage: url(...)`）或组合 CSS 变量（`var(--cc-card-bg-blur)` 等），Tailwind 无法表达。
2. 这些组件本身没有包裹 `React.memo`，新引用不会阻止任何 memo 优化，无实际性能影响。
3. 抽取为 useMemo/style constant 需要逐一分析每个内联样式的依赖变化频率，工作量大且收益趋近于零。

**风险:** 无

---

## #17 — 零 React.memo

**范围:** 全部 46 个应用组件均未使用 React.memo
**问题:** CharacterCard、ChatMessage、VoiceCard 等列表项在父组件 rerender 时全部重新渲染。

**不修复原因:**
1. 项目不是高频率更新的列表场景（非实时 ticker、非虚拟滚动表格）。聊天消息更新由用户行为驱动，不是每帧 rerender。
2. ChatMessage 有 15+ props，要使 memo 生效需要全部 props 稳定，而 `message` 对象每次 `setMessages` 都是新引用，还需 custom comparator，复杂度/收益比不值得。
3. 无实际性能瓶颈证据（无用户报告卡顿、无 profiling 数据表明 rerender 是瓶颈），不做 premature optimization。

**风险:** 无

---

## #18 — 4 处 && 与非布尔值

**文件/位置:**
- `src/components/ChatHeader.tsx:66` — `{chatId && <ReadingRing />}`（chatId 为 string）
- `src/components/voice/VoiceAvatarField.tsx:145` — `{avatarError && <p>...}`（avatarError 为 string）
- `src/components/voice/VoiceUsageManagerDialog.tsx:70` — `{helperText && <p>...}`（helperText 为 string）
- `src/components/ui/navigation-menu.tsx:27` — `{viewport && <NavigationMenuViewport />}`（viewport 为 boolean，本身无问题）

**代码片段:**
```tsx
// ChatHeader.tsx:66
{chatId && <ReadingRing chatId={chatId} />}

// VoiceAvatarField.tsx:145
{avatarError && <p className="text-center text-xs text-red-500">{avatarError}</p>}
```

**不修复原因:** 理论上如果值为 `"0"` React 会渲染字面量 "0"，但：
1. `chatId` 来自路由参数 `params.id`，Next.js 路由匹配要求非空字符串，不可能是 `"0"` 或空字符串。
2. `avatarError` / `helperText` 来自 `Error.message` 或业务文案，值域完全可预测。
3. 业务逻辑受控，不是通用库代码，不需要教条式改为三元表达式。

**风险:** 无

---

## #19 — 生产环境 console.log

**文件:** `src/lib/auth.ts:336`
**问题:** Dodo Payments webhook handler 中存在 `console.log("Received Dodo Payments webhook:", payload.type)`。

**代码片段:**
```typescript
// src/lib/auth.ts:335-337
onPayload: async (payload) => {
  console.log("Received Dodo Payments webhook:", payload.type);
},
```

**不修复原因:** 服务器端代码，输出到 stdout 不影响用户体验。该 handler 目前是占位实现（只 log 无实际业务逻辑），下次碰到此文件时顺路改为 `logger.info` 或删除即可。

**风险:** 无

---

## #20 — 7 处列表渲染 index as key

**文件/位置:**
- `src/components/ChatInput.tsx:898` — speaking capsules（`key={index}`）
- `src/app/(app)/favorites/page.tsx:576` — 骨架屏（`key={index}`）
- `src/components/chat/ChatHistorySidebar.tsx:72` — 骨架屏（`key={i}`）
- `src/components/FeedbackCardPopover.tsx:55` — key_phrases（`key={idx}`）
- `src/components/WordCardPopover.tsx:53` — pos_groups（`key={idx}`）
- `src/components/ReplyCardPopover.tsx:51` — key_phrases（`key={idx}`）
- `src/components/ui/slider.tsx:55` — shadcn 固定 thumbs（`key={index}`）

**代码片段（典型示例）:**
```tsx
// ChatInput.tsx:896-898 — speaking capsule（固定 5 项）
{levels.map((level, index) => (
    <div key={index} className="shrink-0" style={{...}}>

// favorites/page.tsx:574-576 — 骨架屏（固定 3 项）
Array.from({ length: 3 }).map((_, index) => (
    <div key={index} className="rounded-xl border ...">
```

**不修复原因:**
1. 骨架屏（favorites、ChatHistorySidebar）和 speaking capsules 是静态固定长度的列表，不会重排。
2. 三个 Popover 的数据结构（KeyPhrase 只有 surface/ipa_us/zh，WordCardPosGroup 只有 pos/senses）API 设计上就没有唯一 ID 字段。
3. 所有列表都是短列表（1-5 项）、来自一次性 API 响应、不会动态增删重排。在无唯一 ID 且列表静态的场景下 index 是合理选择。
4. shadcn slider 的 thumbs 数量由配置决定，固定不变。

**风险:** 无

---

## #21 — 无 hover/focus 预加载

**范围:** 全局
**问题:** Popover 等组件没有在 hover/focus 时预加载。

**不修复原因:**
1. 当前 Popover 组件都是轻量级（< 90 行、无重型依赖），代码已在初始 bundle 中，预加载收益趋近于零。
2. hover 预加载的前提是组件已通过 `next/dynamic` 拆分为独立 chunk，而当前代码库未做动态导入，预加载无从谈起。
3. 如未来落地动态导入，可在触发按钮的 `onMouseEnter` 上加 prefetch，目前无基础设施支持。

**风险:** 无

---

## #22 — 3 个问题已在审阅前修复

**状态:** 已修复（仅作记录）

### #40 — auth-email-otp-log.ts:28 message 字段未转义双引号

**文件:** `src/lib/auth-email-otp-log.ts`
**原问题:** message 字段拼接时未转义双引号，可能导致日志格式异常。
**当前状态:** 已重构为结构化日志（`logger.info`/`logger.error`），原始字符串拼接问题已不存在。

**代码片段（当前代码）:**
```typescript
// src/lib/auth-email-otp-log.ts:20-24
logger.info(Module.AUTH, AuthEvent.EMAIL_OTP_DELIVERY_QUEUED, message, {
  email_hint,
  otp_type: otpType,
});
```

### #41 — auth-email-otp-log.ts:41 appendFile 并发写入无锁

**文件:** `src/lib/auth-email-otp-log.ts`
**原问题:** `appendFile` 并发写入无锁，可能导致日志交错。
**当前状态:** 已在 commit `d09edf3` 中修复，改用结构化日志输出。

### #42 — error-map.ts:331-334 error.message.includes("fetch") 匹配过宽

**文件:** `src/lib/error-map.ts:330-334`
**原问题:** `error.message.includes("fetch")` 会错误匹配包含 "fetch" 的无关错误信息。
**当前状态:** 已在 commit `0030eb3` 中修复，改为精确匹配 `"Failed to fetch"` 和正则表达式。

**代码片段（当前代码）:**
```typescript
// src/lib/error-map.ts:330-334
if (
  error.message === "Failed to fetch" ||
  /^(typeerror|networkerror|referenceerror)\s*:\s*failed to fetch$/i.test(error.message) ||
  /^(typeerror|networkerror)\s*:\s*network error$/i.test(error.message)
) {
```

---

## #23 — fetchWithBetterAuth 类型兼容性

**文件:** `src/lib/better-auth-token.ts`
**问题:** 审查报告质疑 `fetchWithBetterAuth` 的类型定义与现代浏览器 Fetch API 的兼容性。

**代码片段:**
```typescript
// src/lib/better-auth-token.ts:93-128
export async function fetchWithBetterAuth(
  request: RequestInfo | URL,
  options?: RequestInit,
): Promise<Response> {
  // ...
}
```

**不修复原因:** `RequestInfo | URL` 是现代浏览器 `fetch()` API 的标准参数类型。函数签名与 `globalThis.fetch()` 完全兼容，`better-auth/react` 库内部正确处理该类型。TypeScript 类型定义正确。

**风险:** 无

---

## #24 — 微信支付回调状态显示重复判断

**文件:** `src/components/billing/BillingPageContent.tsx:322-388`
**问题:** 审查报告称多个 JSX 条件表达式可能同时显示，导致状态重复。

**不修复原因:** 代码使用独立的 JSX 三元表达式（`condition ? <Element> : null`），每个表达式独立求值 checkoutStatus、checkoutChannel、isLoading。不会存在"同时满足多个条件显示重复内容"的问题。这是 React 正确的条件渲染模式。

**风险:** 无

---

## #25 — syncSettings 只发送 dirty fields

**文件:** `src/lib/user-settings-context.tsx:147-191`
**问题:** 审查报告建议 `syncSettings` 应发送完整 payload 而非仅 dirty fields。

**不修复原因:** 
1. 减少网络带宽
2. 避免与其他并发的修改冲突（只修改自己改的字段）
3. 后端 `updateMySettings` 是 PATCH 操作，接受部分更新
4. 代码在 `dirtyFields.length === 0` 时提前返回是正确的

**风险:** 无

---

## #26 — RemoteUserSettingsResponse 可选性不一致

**文件:** `src/lib/user-settings-context.tsx:58-66`
**问题:** `message_font_size` 是必需字段，但其他字段是可选的，与 `UserSettingsResponse` 不一致。

**不修复原因:** `RemoteUserSettingsResponse` 是 API 返回数据的本地解析类型。`message_font_size: number` 必需反映了 API 保证该字段必有值；其他字段可选反映了实际 API 行为。代码在第 244-249 行对可选字段提供了默认值，进一步确保安全性。

**风险:** 无

---

## #27 — isTierBlocked 命名可读性

**文件:** `src/components/billing/PricingPageContent.tsx:89-97`
**问题:** 审查报告认为 `isTierBlocked` 命名可读性差。

**不修复原因:** "Tier blocked" = 当前等级阻止了向目标等级的升级。函数逻辑 `getBillingTierRank(currentTier) > 0 && getBillingTierRank(targetTier) <= getBillingTierRank(currentTier)` 准确反映了业务语义。比 `canUpgradeToTier` 或 `isUpgradeBlocked` 更准确地描述了函数的真实含义。

**风险:** 无

---

## #28 — 支付状态函数类型不同

**文件:** `src/components/billing/BillingPageContent.tsx:75-108`
**问题:** 审查报告认为 `isRecurringCheckoutSucceeded` 和 `isWechatCheckoutSucceeded` 是重复代码。

**不修复原因:** 两个函数处理的输入类型完全不同：
- `isRecurringCheckoutSucceeded` 接受 `string | null | undefined`（Dodo subscription/payment status）
- `isWechatCheckoutSucceeded` 接受 `PaymentOrderResponse["status"] | null | undefined`（微信支付订单状态）

来自完全不同的支付渠道，有不同的可能取值范围。混用会导致类型错误，必须分开。

**风险:** 无

---

## #29 — getBillingTierRank 输入验证

**文件:** `src/lib/billing-plans.ts:173-181`
**问题:** 审查报告认为函数缺少输入验证。

**代码片段:**
```typescript
export function getBillingTierRank(value: BillingTier | "free" | null | undefined) {
  if (value === "pro") return 2;
  if (value === "plus") return 1;
  return 0;
}
```

**不修复原因:** 
1. TypeScript 类型系统保证只有合法值能传入
2. 所有可能值都有处理：`"pro"` → 2，`"plus"` → 1，其他 → 0
3. 没有"无效输入"需要验证——任何传入的值都会被正确处理

**风险:** 无

---

## #30 — mapCharacterToSidebar 显式映射

**文件:** `src/lib/character-adapter.ts`
**问题:** 审查报告认为函数使用"浅层映射"，缺少深度响应式更新。

**不修复原因:** 
1. 显式优于隐式：每个字段显式列出，新增字段必须显式处理，避免遗漏
2. 类型安全：API 新增字段但未添加到映射时，TypeScript 编译器会报错
3. 关注点分离：适配层明确区分 API 模型和 UI 模型

**风险:** 无

---

## #31 — CreateCharacterModal 表单重置与 mode 耦合

**文件:** `src/components/CreateCharacterModal.tsx:117-177, 371-385`
**问题:** 审查报告认为表单重置逻辑与 mode 耦合。

**不修复原因:** 
- useEffect 中的重置：确保每次打开 modal 时表单是干净的
- handleSubmit 中的重置：仅在 `mode === 'create'` 且提交**成功**后重置

这是**内聚性**的体现：表单状态与操作模式自然关联。`create` 模式成功后清空表单准备创建下一个角色，`edit` 模式保存后不清空（用户可能还需要再次保存）是正确行为。

**风险:** 无

---

## #32 — 单词卡关闭已正确清理 selectionButtonDataRef

**文件:** `src/components/chat/ChatThread.tsx:458-464`
**问题:** 审查报告认为关闭单词卡时未清理 `selectionButtonDataRef`。

**不修复原因:** `handleCloseWordCard` 确实调用了 `hideSelectionButton()`（第 462 行），而 `hideSelectionButton` 将 `selectionButtonDataRef.current = null`（第 332 行）。这是正确的清理逻辑。

**风险:** 无

---

## #33 — Favorite toggle 乐观更新竞态条件

**文件:** `src/hooks/useOptimisticFavorite.ts:42`
**问题:** 审查报告认为快速切换 favorite 状态存在竞态条件。

**不修复原因:** 这是所有乐观更新系统都面临的通用问题。代码已经有回滚机制（catch 块），可以在出错时恢复状态。这是可接受的设计权衡，不需要修复。

**风险:** 无

---

## #34 — 单词卡请求不需要防抖

**文件:** `src/components/chat/ChatThread.tsx:409-431`
**问题:** 审查报告认为单词卡请求缺少防抖。

**不修复原因:** 用户必须先选中文本（mouseup 事件），再点击按钮才会触发请求。这是用户主动行为，不是自动触发。没有连续快速触发 API 的场景（如输入搜索词防抖场景）。

**风险:** 无

---

## #35 — 历史上下文已正确过滤空消息

**文件:** `src/hooks/useLearningAssistant.ts:75-80`
**问题:** 审查报告认为历史上下文可能包含空消息。

**不修复原因:** 第 75-80 行已使用 `.filter((message) => message.content.trim())` 过滤空消息。这是正确的行为——空消息对学习助手没有意义，不需要包含在上下文里。

**风险:** 无

---

## #36 — TtsPlaybackManager dispose() 已正确实现

**文件:** `src/app/(app)/chat/[id]/page.tsx:118-133`
**问题:** 审查报告认为 `TtsPlaybackManager` 缺少 `dispose()` 方法。

**不修复原因:** `TtsPlaybackManager` 确实有 `dispose()` 方法（`tts-playback-manager.ts:337-343`），在 page.tsx 的 useEffect cleanup 中被正确调用。dispose 实现完整：停止所有播放、关闭 AudioContext。

**风险:** 无

---

## #37 — /api/share-card-image HTTP 缓存已正确配置

**文件:** `src/app/api/share-card-image/route.ts`
**问题:** 审查报告认为缺少 HTTP 缓存。

**不修复原因:** API response 包含正确的 Cache-Control header（`public, max-age=604800, immutable`），缓存 TTL 为 7 天。Redis 层面也有缓存（7 天 TTL）。

**风险:** 无

---

## #38 — growth-entry-prompt.ts 工具函数是备用实现

**文件:** `src/lib/growth-entry-prompt.ts:126-154`
**问题:** 审查报告认为 `readGrowthEntryAutoOpenHandledStatDate` 和 `markGrowthEntryAutoOpenHandledForSession` 未被使用。

**不修复原因:** `growth-context.tsx` 使用了自己的 session 管理实现，但 `growth-entry-prompt.ts` 的函数作为备用实现保留。测试文件 `growth-entry-prompt.test.ts` 验证了这两个函数的功能正确性。

**风险:** 无

---

## #39 — getAudioFormat 文件扩展名提取是标准做法

**文件:** `src/components/voice/CreateVoiceCloneModal.tsx:171-181`
**问题:** 审查报告认为通过文件扩展名获取格式"不可靠"。

**不修复原因:** 
1. Web 应用中的标准做法
2. 文件上传时已通过 `ACCEPTED_AUDIO_FORMATS.includes(file.type)` 验证文件类型
3. 后端也会检测真实格式
4. 函数使用 "wav" 作为安全默认值

**风险:** 无

---

## #40 — base64 解码实现可读性好

**文件:** `src/lib/voice/tts-playback-manager.ts:81-84`
**问题:** 审查报告建议优化 base64 解码实现。

**不修复原因:** 当前实现正确且可读性好。性能差异在实际使用中可忽略。在音频流这种高频调用路径上，当前的实现是合理的。

**风险:** 无

---

## #41 — invalidateQueries 使用 Promise.all 并行执行

**文件:** `src/components/voice/EditVoiceModal.tsx:125-139`
**问题:** 审查报告声称 `invalidateQueries` 串行执行。

**不修复原因:** 代码明确使用了 `Promise.all` 来并行执行三个 `invalidateQueries` 操作。不是串行，是并行。第一轮审查的描述与实际代码不符。

**风险:** 无

---

## #42 — useEffect 依赖数组完整

**文件:** `src/components/billing/PricingPageContent.tsx:274-281`
**问题:** 审查报告认为 useEffect 依赖数组不完整。

**不修复原因:** 依赖数组完整：`[checkoutStatus, checkoutChannel, checkoutOrderId, checkoutOrderQuery.data, refreshEntitlements, user]`。所有被 capture 的值都在依赖数组中。

**风险:** 无

---

## #43 — handledAutoCheckoutRef 无内存泄漏

**文件:** `src/components/billing/PricingPageContent.tsx:119`
**问题:** 审查报告认为 ref 可能导致内存泄漏。

**不修复原因:** `handledAutoCheckoutRef` 是一个 Set，在组件生命周期内持久化。每次 checkout 只处理一次，用 Set 跟踪已处理的 slug 是正确的模式。Set 会自动去重，不会无限增长。

**风险:** 无

---

## #44 — checkoutChannel 在多处使用

**文件:** `src/components/billing/BillingPageContent.tsx:139-353`
**问题:** 审查报告认为 `checkoutChannel` 未被使用。

**不修复原因:** `checkoutChannel` 在多个地方使用：
1. 启用 `useWechatPaymentOrderQuery`
2. 根据渠道类型显示不同的支付状态消息（第 322-353 行多处检查）

**风险:** 无

---

## #45 — 缓存 TTL 60 秒是合理设计

**文件:** `src/lib/dodo-payments.ts:24`
**问题:** 审查报告认为 60 秒缓存 TTL 过短。

**不修复原因:** 
1. 定价目录从 Dodo Payments API 获取，该数据变化不频繁
2. 60 秒缓存足以避免每次渲染都调用 API
3. 如果需要，用户可以通过刷新页面强制重新获取

**风险:** 无

---

## #46 — image.complete 竞态条件已有正确处理

**文件:** `src/lib/share-card-assets.ts:109-111`
**问题:** 审查报告认为存在竞态条件。

**不修复原因:** 代码已有正确处理，`finish()` 是幂等的。

**风险:** 无

---

## #47 — isRemoteHttpUrl 实际被使用

**文件:** `src/lib/share-card-assets.ts:70-79`
**问题:** 审查报告认为 `isRemoteHttpUrl` 未被使用。

**不修复原因:** `isRemoteHttpUrl` 实际在 `resolveShareCardImageSrc` 中被使用。

**风险:** 无

---

## #48 — 缓存 key 使用 SHA256 hash 是正确的

**文件:** `src/app/api/share-card-image/route.ts:118`
**问题:** 审查报告对缓存 key 有疑虑。

**不修复原因:** SHA-256 hash 是正确的做法，用于生成唯一的缓存 key。

**风险:** 无

---

## #49 — ETag 为 null 是符合 HTTP 规范的正常行为

**文件:** `src/lib/api-service.ts:905-914`
**问题:** 审查报告认为未处理 ETag 为 null 的情况。

**不修复原因:** 当上游响应没有 ETag header 时，值为 null 是符合 HTTP 规范的正常行为，不需要特殊处理。

**风险:** 无

---

## #50 — external_error 已足够处理 R2 错误码

**文件:** `src/lib/api-service.ts:905-914`
**问题:** 审查报告认为 R2 错误码映射缺失。

**不修复原因:** `external_error` 已足够处理错误情况，不需要为每个可能的错误码单独映射。

**风险:** 无

---

## #51 — Set + filter 对少量 URL 是合理实现

**文件:** `src/lib/share-card-assets.ts:46-68`
**问题:** 审查报告对去重效率有疑虑。

**不修复原因:** 对于小量 URL，Set + filter 是合理实现。不会造成性能问题。

**风险:** 无

---

## #52 — 记忆 API 错误处理已统一

**文件:** `src/lib/api-service.ts:1569-1606`
**问题:** 审查报告认为记忆 API 缺少错误处理。

**不修复原因:** `httpClient` 内部已经通过 `throwApiErrorResponse` 统一处理 HTTP 错误。当 HTTP 响应不 ok 或状态码非正常时，会自动抛出 `ApiError` 或 `UnauthorizedError`。

**风险:** 无

---

## #53 — searchMemories 无分页是过度设计

**文件:** `src/lib/api-service.ts:1602-1605`
**问题:** 审查报告建议添加分页。

**不修复原因:** 这些记忆 API 在当前正式页面中并未直接使用，主要通过 SSE 事件间接使用。在没有明确调用场景的情况下，添加分页支持是过度设计。

**风险:** 无

---

## #54 — memoryEnabled 权益校验已正确实现

**文件:** `src/components/SettingsModal.tsx:172-176`
**问题:** 审查报告对前端权益校验有疑虑。

**不修复原因:** 前端已经正确实现了权益校验逻辑（`SettingsModal.tsx:49-52`）。`canUseMemoryFeature` 通过 `entitlements?.features.memory_feature` 判断。后端会进行二次校验是合理的安全防护。

**风险:** 无

---

## #55 — 记忆模块 token 限制管理概念不明确

**文件:** `src/lib/api-service.ts`
**问题:** 审查报告建议添加 token 限制管理。

**不修复原因:** "token 限制管理"的概念不明确。如果是指 API 调用频率限制，这是后端职责；如果是指记忆检索的 prompt token 预算，这属于 RAG 实现细节，不应暴露给前端。

**风险:** 无

---

## #56 — React 默认转义 description 内容

**文件:** `src/app/share/[slug]/page.tsx:87-106`
**问题:** 审查报告认为 `description` 可能存在 XSS 风险。

**不修复原因:** `character.description` 作为 React props 传递（`{phase.character.description}`），而非使用 `dangerouslySetInnerHTML`。React 默认会对内容进行 HTML 转义，不存在 XSS 风险。

**风险:** 无

---

## #57 — buildShareUrl 返回相对路径是设计如此

**文件:** `src/lib/share-link.ts:28-31`
**问题:** 审查报告认为 `buildShareUrl` 返回相对路径有问题。

**不修复原因:** 服务端渲染时 `window` 未定义，`origin` 为空字符串，返回相对路径。单元测试显式验证此行为："builds a relative share URL during server-side tests"。分享链接生成主要在客户端执行，此时 `window.location.origin` 有效。

**风险:** 无

---

## #58 — toLocaleLowerCase() 同一模式在代码库多处使用

**文件:** `src/lib/share-link.ts:5`
**问题:** 审查报告对 `toLocaleLowerCase()` 跨环境问题有疑虑。

**不修复原因:** `character-avatar.ts:57`、`discover-data.ts:70,75` 等多处也使用 `toLocaleLowerCase()`。该函数用于 Unicode 字符的大小写转换，对于 ASCII 字符（角色名称的主要构成），与 `toLowerCase()` 结果一致。

**风险:** 无

---

## #63 — 远程设置覆盖本地设置时序问题

**文件:** `src/lib/user-settings-context.tsx:228-261`
**问题:** `syncSettings` 成功后没有主动 refetch，可能丢失其他设备的并发修改。

**不修复原因:** 多设备并发修改同一设置的场景极罕见。`syncSettings` 使用 PATCH 只同步本地修改的字段，降低了冲突概率。如果需要最新远程状态，用户可以手动刷新页面。

**风险:** 低

---

## #59 — imageLoadCache 成功条目永不清理

**文件:** `src/lib/share-card-assets.ts:9, 82-116`
**问题:** `imageLoadCache`（模块级 `Map<string, Promise<void>>`）仅在错误路径 `delete` 条目，成功路径永不清理，无 LRU/TTL/容量上限。

**不修复原因:** 缓存条目是一个 `string → Promise<void>` 引用，单条目内存可忽略。URL 为日期种子 picsum URL（每天一个新 URL），浏览器 session 不可能持续运行数年。即使运行一年也仅 365 条条目，内存影响为零。页面刷新/关闭时全部清零。

**风险:** 无

---

## #60 — auth.ts email HTML 直接拼接变量

**文件:** `src/lib/auth.ts:300-312`
**问题:** 邮件 HTML 模板中 `${title}` 和 `${otp}` 直接拼入 HTML，未做转义。

**不修复原因:** `title` 由 `type` 枚举决定，硬编码为两个中文字符串（`"邮箱验证验证码"` / `"登录验证码"`），`type` 经 better-auth 内部 Zod enum 验证。`otp` 是库生成的 6 位纯数字码。两者均非用户输入，无注入路径。整个前端代码库不存在 HTML 转义工具也不使用 `dangerouslySetInnerHTML`。

**风险:** 无

---

## #61 — Profile 页 Image 组件 remotePatterns 不完整

**文件:** `next.config.ts:48-55`、`src/app/(app)/profile/page.tsx:214-221`
**问题:** `remotePatterns` 只配了 `lh3.googleusercontent.com`，非 Google 域名的外部头像可能被拦截。

**不修复原因:** 唯一受 remotePatterns 限制的是 Profile 页的 Next.js `<Image>` 组件，实际头像来源为后端本地路径（`/media/images/avatars/users/...`）或 Google OAuth（`lh3.googleusercontent.com`），均已覆盖。其余所有头像渲染使用 `<AvatarImage>`（底层 `<img>`）或 `<Image unoptimized />`，不受 remotePatterns 限制。项目仅配了 Google 一个 OAuth 提供商。

**风险:** 无

---

## #62 — SttRecorder 转录中 cleanup() 可能中断识别

**文件:** `src/lib/voice/stt-recorder.ts:53-56, 117-161`
**问题:** `startRecording()` 在非 idle 状态时强制调用 `cleanup()`，可能在转录进行中清空资源，无 AbortController 保护。

**不修复原因:** UI 层（`ChatInput.tsx`）有完整守卫：`handleMicClick` 在非 `"default"` 状态时 return、取消/确认按钮在 `"transcribing"` 时 disabled。唯一绕过路径是 `dispose()`（组件卸载），此时丢弃转录结果是正确行为。`confirmAndTranscribe()` 在 `await sttTranscribe()` 期间 blob 已收集完毕，不依赖被 `cleanup()` 清空的引用，后续逻辑不会崩溃。

**风险:** 无

---

## #64 — 单词卡英文检测逻辑不完整

**文件:** `src/components/chat/ChatThread.tsx:376-380`
**问题:** 仅用 `/[a-zA-Z]/.test()` 检测，中英混合文本也会触发单词卡功能。

**代码片段:**
```typescript
// Only trigger on English text (basic check - contains letters)
if (!/[a-zA-Z]/.test(selectedText)) {
    hideSelectionButton();
    return;
}
```

**不修复原因:**
1. 这是用户主动行为：用户必须先选中文本（mouseup 事件），再点击按钮才会触发 API 请求。用户选中中英混合文本是自己的操作失误，后端是大模型，可以处理一些额外情况。
2. 修复带来的收益有限，改动有引入新问题的风险。

**风险:** 无

---

## #65 — 学习助手SSE finally状态问题

**文件:** `src/hooks/useLearningAssistant.ts:162-167`
**问题:** `finally` 中设置 `setIsStreaming(false)` 与 `onDone`/`onError` 内部设置重复。

**代码片段:**
```typescript
try {
  await streamLearningAssistant(
    { ... },
    {
      onDone: (fullContent) => {
        // ... 处理完成
        setIsStreaming(false);  // ← 第137行
      },
      onError: (streamError) => {
        // ... 处理错误
        setIsStreaming(false);  // ← 第158行
      },
    }
  );
} finally {
  if (abortRef.current === controller) {
    abortRef.current = null;
  }
  setIsStreaming(false);  // ← 第166行 又调用一次
}
```

**不修复原因:**
原报告认为 `finally` 中的 `setIsStreaming(false)` 是冗余的，但实际上**不是冗余**。`handleStreamError`（`sse-stream.ts:71-98`）对 `AbortError` 会**静默忽略**（直接 `return;`），不调用任何回调：

```typescript
if (isAbortError(error)) {
  return;  // ← AbortError 场景下不调用 onError！
}
```

当用户主动调用 `stop()` 时：
1. `abortRef.current?.abort()` 触发 AbortError
2. `handleStreamError` 检测到 AbortError → 直接 return，不调用 `onError`
3. `streamLearningAssistant` 正常返回
4. `finally` 执行 → `setIsStreaming(false)` 是**唯一的状态清理**

虽然 `stop()` 本身也会设置 `setIsStreaming(false)`（第48行），但 `finally` 中的调用是防御性编程，确保在所有场景下状态都能被正确重置。这是合理的冗余，不是 bug。

**风险:** 无

---

## #66 — AudioContext webkit 前缀 fallback 实际无风险

**文件:** `src/lib/voice/tts-playback-manager.ts:41-45`
**问题:** 审查报告称类型断言 `window.webkitAudioContext` 不存在时会抛 TypeError。

**代码片段:**
```typescript
this.audioContext = new (
  window.AudioContext ||
  (window as unknown as { webkitAudioContext: typeof AudioContext })
    .webkitAudioContext
)();
```

**不修复原因:** 报告描述与实际代码不符。这是标准的 webkit 前缀兼容写法，`(window as unknown as {...}).webkitAudioContext` 只是 TypeScript 类型转换，运行时不会抛 TypeError。如果浏览器既不支持标准 AudioContext 也不支持 webkit 版本才会崩溃——但 2026 年所有现代浏览器（Chrome 35+/Firefox 25+/Safari 14+/Edge）均已原生支持 AudioContext，`webkitAudioContext` 只是给非常老的 Safari 用的兼容 fallback，实际场景中不会触发。

**风险:** 无

---

## #67 — onConversationEvent 回调实际无异常风险

**文件:** `src/hooks/useRealtimeVoiceSession.ts:115-117`
**问题:** 回调缺少 try-catch，异常导致 WebRTC 消息处理中断。

**代码片段:**
```typescript
onConversationEvent: (event) => {
  void onConversationEventRef.current?.(event);
},
```

**不修复原因:** 
1. 回调内调用的是 `scheduleRealtimeChatTurnsReload`（内部调用 `queryClient.invalidateQueries`）和 `setSubtitles`（React state 更新），都是稳定操作，不会抛异常。
2. 如果组件 unmount，cleanup effect 会先调用 `client.disconnect()`，不会再收到事件。
3. 实际问题场景几乎不会发生：WebRTC 正常工作 → 组件 mounted → 回调稳定执行。
4. 同文件 `onSubtitleDelta` / `onSubtitleFinal` 也直接操作 state，没有 try-catch，逻辑一致。

**风险:** 无

---

## #68 — resampleTo16kMono 采样率设置正确

**文件:** `src/lib/voice/stt-recorder.ts:241`
**问题:** 审查报告称 `monoBuffer` 使用原始采样率而非目标 16kHz，应使用 `TARGET_STT_SAMPLE_RATE`。

**代码片段:**
```typescript
const offlineCtx = new OfflineAudioContext(
  1,
  targetLength,
  TARGET_STT_SAMPLE_RATE,  // 16000 - 输出采样率
);
const monoBuffer = offlineCtx.createBuffer(1, mono.length, audioBuffer.sampleRate);
//                                                                 ↑ 原始采样率
```

**不修复原因:**
原报告理解错误。代码设计就是要**接受任意采样率的输入，输出统一的 16000Hz**：

1. `audioBuffer` 来自用户麦克风，可能是 48000、44100、16000 等任意采样率
2. `mono.length` 是按原始采样率计算的样本数
3. `monoBuffer` 必须用**原始采样率**来正确描述这些样本
4. `OfflineAudioContext.startRendering()` 会根据输入输出采样率差异自动做重采样

如果改成 `TARGET_STT_SAMPLE_RATE`，会导致 `monoBuffer` 的采样率被错误标记，破坏重采样逻辑。

**风险:** 无

---

## #69 — AudioBuffer 引用延迟释放无实际影响

**文件:** `src/lib/voice/tts-playback-manager.ts:200-220`
**问题:** `stopRealtime()` 停止 source 后没有将 `source.buffer` 置 null，可能导致 AudioBuffer 延迟释放。

**代码片段:**
```typescript
private stopRealtime(): void {
  for (const source of this.realtimeActiveSources) {
    try {
      source.stop();
    } catch {
      // Already stopped
    }
    // ← 没有 source.buffer = null
  }
  this.realtimeActiveSources = [];
  // ...
}
```

**不修复原因:**
1. `source.stop()` 后 source 会被 `onended` 回调从 `realtimeActiveSources` 中移除，一旦没有任何引用，GC 会回收 buffer。
2. 只是没有显式断开引用，延迟释放。TTS chunk 大小有限，内存影响可忽略。
3. `AudioBufferSourceNode` 生命周期短，播放完毕后立即可回收。

**风险:** 无
