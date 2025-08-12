### Token 消耗优化方案

> 适用于 LDIMS 文档检索-MCP 服务
>
> 目标：在确保信息完整性的同时，大幅降低大模型调用时的 Token 消耗。

---

## 一、问题概述

1. 现状：`searchDocuments` 直接返回文档 **全部** 提取内容，导致一次响应动辄上万字符。
2. 后果：
   - GPT / LLM 处理时消耗大量 Token，成本高、响应慢。
   - 片段缺乏结构与位置信息，难以做精准摘要。

---

## 二、核心优化思路

| 优化点                       | 目的                        | 关键做法                                                                   |
| ---------------------------- | --------------------------- | -------------------------------------------------------------------------- |
| 结构化片段 (Snippet[])       | 让 LLM 获得可解析的上下文块 | 将命中关键词前后 **±400** 字符提取为片段，保留起止位置、命中关键词等元数据 |
| 相关性评分 (relevance_score) | 突出重点，便于 LLM 聚焦     | 根据关键词密度、集中度及文档位置等规则计算分值并降序返回                   |
| 上下文感知边界               | 保证语义完整、可读          | 片段边界自动延伸到最近的句号 / 段落边界，避免截断句子                      |

---

## 三、接口参数调整

```ts
// SearchDocumentsSchema 新增/调整
content_mode?: "full" | "smart_extract" = "smart_extract";
context_chars?: number = 400;           // 关键词前后字符数（单侧）
merge_overlapping?: boolean = true;     // 是否合并重叠片段
```

> 说明：`smart_extract` 模式即启用本优化方案；`full` 保持向后兼容，返回完整内容。

---

## 四、算法流程

```mermaid
flowchart TD
  A[搜索结果含全文 extractedContent] --> B[提取查询关键词]
  B --> C[定位所有匹配位置]
  C --> D[按 ±context_chars
           生成初始区间]
  D --> E[延伸区间到最近标点]
  E --> F[合并重叠或相邻区间]
  F --> G[计算相关性评分]
  G --> H[构造 Snippet[] 并按 score 降序]
```

**区间合并规则**

1. 如果 `current.start` ≤ `last.end + 50` (间隔≤50)，则视为同一片段，合并。
2. 合并时 `end = max(last.end, current.end)`；关键词数组去重合并。

**相关性评分示例**

```
score = (unique_keywords * 10) + (1 / avg_distance_between_keywords) + position_bonus
```

---

## 五、返回数据结构示例

```jsonc
{
  "documentId": "doc123",
  "documentName": "合同管理制度",
  "snippets": [
    {
      "content": "...合同签署流程...",
      "keywords_matched": ["合同", "签署"],
      "original_char_start": 1024,
      "original_char_end": 1830,
      "relevance_score": 0.92
    },
    {
      "content": "...合同归档要求...",
      "keywords_matched": ["合同"],
      "original_char_start": 5678,
      "original_char_end": 6400,
      "relevance_score": 0.75
    }
  ],
  "fileDetails": [...],
  "totalMatches": 2
}
```

---

## 六、优势

1. **Token 使用减少 80-90%**：只返回命中上下文，而非全文。
2. **语义完整**：边界延伸至标点，避免破句。
3. **重点突出**：相关性评分让 LLM 先读最重要的片段。
4. **扩展灵活**：不限制片段数，支持后续全文获取 (备用接口)。

---

## 七、实施步骤

1. 更新 `SearchDocumentsSchema` 新增参数。
2. 在 `ldims-api.ts` 中实现
   - 关键词匹配定位
   - 片段生成与边界延伸
   - 片段合并与评分
   - 返回 `snippets` 数组。
3. 保持 `getDocumentFileContent` 作为可选全文获取接口。
4. 编写单元测试确保：
   - 关键词定位、合并逻辑正确
   - 相关性评分排序符合预期
5. 更新 `README` / 接口文档。
6. **实现进阶优化**：加入关键词加权评分、动态上下文窗口与片段去重逻辑。
7. **扩充测试用例**：覆盖评分细节、动态窗口与去重边界情况。

---

## 八、后续可拓展方向

- **更高级的关键词提取**：词干还原、同义词匹配。
- **动态 context_chars**：根据文档平均句长自动调整。
- **缓存 & 去重策略**：对于重复查询结果做缓存，进一步节省成本。

---

> 文档创建日期：{{DATE}}

---

## 九、进阶优化：关键词加权评分与片段去重

> 以下内容为 2025-07-XX 新增的进阶优化方案，用于在现有基础上进一步提升相关性与 Token 使用效率。

### 1. 关键词加权相关性评分

| 指标              | 说明                          | 默认系数         |
| ----------------- | ----------------------------- | ---------------- |
| `unique_keywords` | 片段中出现的不同关键词数量    | α = 10           |
| `total_keywords`  | 关键词出现次数（含重复）      | β = 1            |
| `span`            | 片段内首末关键词的字符跨度    | γ = 150 _(分母)_ |
| `percent_in_doc`  | 片段起始位置 / 文档总长 (0~1) | δ = 50           |

综合得分公式：

```text
score_keywords = α * unique_keywords + β * total_keywords
score_density  = γ / (span + 1)
score_position = δ * (1 - percent_in_doc)
relevance_score = score_keywords + score_density + score_position
```

返回结果示例片段：

```jsonc
{
  "content": "...合同签署流程...",
  "relevance_score": 0.93,
  "scoring_details": {
    "unique_keywords": 3,
    "total_keywords": 5,
    "span": 120,
    "percent_in_doc": 0.18
  }
}
```

### 2. 动态上下文窗口

根据 `unique_keywords` 动态调整每侧字符窗口：

| unique_keywords | ±context_chars |
| --------------- | -------------- |
| ≥ 3             | 300            |
| 2               | 400            |
| 1               | 500            |

这样能在保证信息量的同时进一步节省 Token。

### 3. 片段去重策略

- 对 `snippet.content` 做规范化（去空白、转小写）。
- 计算 Jaccard 或简单 Levenshtein 相似度；阈值 ≥ **0.9** 视为重复。
- 多个高度相似片段只保留 `relevance_score` 更高者。

---

> 以上进阶优化预计在 1~2 人日内完成，主要为文本处理逻辑，风险低，可快速迭代。

---

## 十、实现方式与配置（第一阶段）

> 目标：默认启用 smart_extract 优化，在确保向后兼容的前提下落地“片段抽取 + 基础评分 + 可配置摘要拼接”。

- 实现策略

  - 默认模式：`content_mode = "smart_extract"`（可通过入参切换为 `full`）
  - 片段来源：仅从真实文件内容生成（方式 A）。当文档无文件或文件无内容时，不返回 `snippets`，仅在
    `matchedContext` 提供简短摘要或提示
  - Snippet 结构（必填字段）：
    - `content: string`
    - `file_id: string`（来源文件 ID）
    - `file_name: string`（来源文件名）
    - `keywords_matched: string[]`
    - `original_char_start: number`
    - `original_char_end: number`
    - `relevance_score: number`
    - `scoring_details?: { unique_keywords; total_keywords; span; percent_in_doc }`（第一阶段默认不返回）
  - `matchedContext` 向后兼容：在 smart_extract 下是否拼接“短摘要”由环境变量控制（见下）

- 环境变量配置（服务级）

  - `LDIMS_SEARCH_MAX_SNIPPETS`（默认 10，范围 1~50）：限制返回片段上限；请求不再提供该入参，统一以环境变量生效
  - `LDIMS_RETURN_SNIPPET_SUMMARY`（默认 true）：是否将前 N 个片段的“短摘要拼接”写入
    `matchedContext`；若为 false，则 `matchedContext` 可为空或仅保留极短提示
  - 可选：`LDIMS_DEFAULT_CONTENT_MODE`（默认 `smart_extract`）：需要时可在不同环境切换默认返回模式

- 接口入参（Schema）扩展

  - 新增：`content_mode?: "full" | "smart_extract" = "smart_extract"`
  - 新增：`context_chars?: number = 400`
  - 新增：`merge_overlapping?: boolean = true`
  - 新增：`return_scoring_details?: boolean = false`
  - 说明：`max_snippets` 不作为入参提供，统一由环境变量 `LDIMS_SEARCH_MAX_SNIPPETS` 控制

- 基础相关性评分（第一阶段）

  - 采用“关键词去重计数 + 简单密度 + 位置轻度加成”的基础评分；不启用加权系数与动态窗口、去重等进阶能力（见第九节）

- 向后兼容

  - `full` 模式下保持现状，`matchedContext` 仍可返回全文（或长文本拼接）
  - `smart_extract` 模式下主要读取 `snippets`；是否在 `matchedContext` 中拼接摘要由
    `LDIMS_RETURN_SNIPPET_SUMMARY` 控制

- 环境变量示例

```env
# 片段上限（1~50）
LDIMS_SEARCH_MAX_SNIPPETS=10

# 是否将前 N 个片段的短摘要拼接到 matchedContext（true/false）
LDIMS_RETURN_SNIPPET_SUMMARY=true

# 可选：默认返回模式（smart_extract 或 full）
# LDIMS_DEFAULT_CONTENT_MODE=smart_extract
```

### 排序规则

- 片段排序：按 `relevance_score` 降序；同分则按去重后关键词数 `unique_keywords` 降序；仍同分则按
  `original_char_start` 升序。
- 摘要拼接：当 `LDIMS_RETURN_SNIPPET_SUMMARY=true` 时，取前 N（由 `LDIMS_SEARCH_MAX_SNIPPETS`
  控制）的片段，按上述顺序拼接到 `matchedContext`。
- 结果排序：`results[*].relevanceScore` 定义为该文档内 `snippets` 的最高
  `relevance_score`；最终返回按该分值降序排序（无片段则视为 0）。
