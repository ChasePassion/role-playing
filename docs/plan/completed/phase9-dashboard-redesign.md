# Phase 9.1: Dashboard (数据总览) 娱乐化重构设计方案

## 1. 理解当前现状
- 当前数据总览页面（`src/app/(app)/stats/page.tsx`）采用传统的 KPI 看板布局。
- 页面顶部是 4 个基础指标卡片（连签、今日词数、历史总词数、聊过角色）。
- 中间大面积展示“全局阅读等价”（四级/六级篇数），视觉占比较大但信息密度低。
- 底部是拆分为词数和消息数的两个 30 天折线图（单色），以及角色台账表格。
- 整体风格偏向严谨的 B 端数据面板，缺乏个性化和娱乐感。
- 后端提供的趋势数据（`GrowthTrendPoint`）目前仅为每天的全局汇总值（总词数、总消息数），不包含按照角色维度的拆分数据。

## 2. 系统位置与影响边界
- **位置**：前端工作区 `StatsPage` 组件（路径：`/stats`）。
- **影响边界**：仅影响数据面板展示，不影响任何核心聊天链路。
- **关联后端**：需要后端 `GrowthOverviewResponse` 接口的趋势数据字段进行扩展，增加按角色的堆叠数据。
- **不应改动的模块**：不改变当前的签到打卡逻辑及数据库的核心指标计算（仅改变查询与聚合的维度和展示方式）。

## 3. 核心流程与界面结构
重构后的界面自上而下结构如下：
1. **[核心视觉焦点] 多角色堆叠柱状图（Stacked Bar Chart）**：
   - 位置：页面最上方（代替当前的 KPI 卡片位置）。
   - 图表：以天为 X 轴的 Stacked Bar Chart（可选用 Recharts 的 `<BarChart>` 和 `<Bar stackId="a">`）。
   - 交互：右上角提供“词数”与“用户发送消息数”的切换 Toggle。Hover 某个柱子时，显示 Tooltip，列出该天互动角色的贡献明细。
2. **KPI 概览与成就标签**：
   - 位置：柱状图下方。
   - 形式：横向排列的 4 个精简指标卡片。在“总词数”指标旁，将原有的“阅读等价”作为趣味性的 Badge 或副标题（Subtitle）点缀，大幅缩小其面积。
3. **角色台账表格**：
   - 位置：最下方，保持表格形式，但可适当优化 UI 使之更契合整体的年轻化、娱乐化风格（如调整表头、圆角、行 Hover 效果）。

## 4. 契约级细节（前后端接口）
- 当前前端类型 `GrowthTrendPoint` 需要支持角色拆分。
- 需要与后端（Chase）协同，在 `GET /api/growth/overview` 接口的 `trends.last_30_days` 中新增字段：
```typescript
export interface GrowthTrendPoint {
  stat_date: string;
  total_message_count: number;
  total_word_count: number;
  // 新增：按角色明细的数组，按贡献降序排序（如最多返回 Top N，剩余合并为 Others，或者由前端进行合并）
  character_breakdown?: Array<{
    character_id: string;
    character_name: string;
    message_count: number;
    word_count: number;
    color_hex?: string; // 可选，由后端分配固定颜色种子或前端根据 ID 生成
  }>;
  is_natural_signed: boolean;
  is_makeup_signed: boolean;
}
```
*澄清点：这里需要询问用户，是希望由后端直接聚合出 `character_breakdown`，还是前端自行根据全量的单日聊天记录聚合？最佳实践是由后端接口聚合好（Top 10 角色 + Others），避免传输大量数据。*

## 5. 方案与决策
### 方案 A（推荐）：后端聚合 + 前端 Recharts 堆叠图
- **核心思路**：后端聚合每日 Top N 角色的词数/消息数，作为明细随 `trends` 返回。前端使用 `recharts` 的 `<BarChart>` 渲染，为不同 `character_id` 分配固定的哈希颜色。
- **优点**：性能好，前端渲染压力小；Recharts 已在项目中使用，无需引入新依赖；颜色哈希保证同一个角色在各天的颜色一致。
- **风险**：需要等待后端开发并刷新 `dataschema.md`，存在短暂的阻塞。

### 方案 B：纯前端使用现有数据（不可行）
- **核心思路**：尝试在前端用现有的按天汇总数据，但由于缺乏角色明细，无法画出“角色堆叠”的效果。
- **结论**：被否决，因为无法满足需求。

**决策建议**：采用方案 A，首先需要修改后端接口契约。在后端未就绪时，前端可以使用 Mock 数据进行 UI 开发。

## 6. 落地锚点
- 页面入口：`src/app/(app)/stats/page.tsx`
- 重构组件：提取新的 `src/components/growth/StatsStackedChart.tsx`。
- KPI 改造：修改 `src/components/growth/StatsKpiCards.tsx`，精简阅读等价展示。
- 数据类型：更新 `src/lib/growth-types.ts`。

## 7. 实施路径
- [ ] **Step 1：确定后端接口变动并与用户对齐**（当前阶段，确认后端如何提供 `character_breakdown` 数据）。
- [ ] **Step 2：前端类型更新与 Mock**：在 `growth-types.ts` 补充类型，并在本地 Mock 堆叠图数据。
- [ ] **Step 3：开发堆叠柱状图组件 `StatsStackedChart`**：
  - 实现基于 Recharts 的堆叠柱状图。
  - 实现自定义 Tooltip（列出不同角色及数值）。
  - 实现右上角的“词数 / 消息数”切换开关。
- [ ] **Step 4：重构 `StatsPage` 布局与 KPI 组件**：
  - 将堆叠柱状图置顶。
  - 修改 `StatsKpiCards`，将“阅读等价”作为 Badge 融入。
  - 调整页面整体色系与阴影，增强“娱乐化”成就感（使用更鲜艳的渐变色或品牌色）。
- [ ] **Step 5：联调真实后端接口并验收**。

## 8. 明确 non-goals 与禁止事项
- 不修改原有的打卡、连签等底层业务逻辑。
- 不引入 ECharts 等大型图表库，继续沿用现有的 Recharts 以避免增加打包体积。

## 9. 验证与验收标准
- 页面顶部正确展示堆叠柱状图，且支持词数/消息数无缝切换。
- Hover 柱子时，Tooltip 清晰展示构成当日数据的角色及对应数值。
- “阅读等价”不再独立成块，而是精简为附属标签。
- 整体视觉层级清晰，符合预期。