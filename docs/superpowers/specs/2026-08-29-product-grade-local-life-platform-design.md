# Product-grade Local Life Platform Design

## 1. Goal

将现有“澳门学生美食地图”升级为可部署、可运营、可持续扩展的本地生活平台 MVP。用户可以可靠地发现地点、组合搜索和筛选、查看可信评价、收藏、投稿新地点；管理员可以审核投稿、合并重复地点、管理图片与标签、查看搜索缺口和数据健康状态。

“产品级”在本项目中的含义是：数据模型有唯一事实来源，写入有校验和权限边界，失败不会产生半条数据或孤儿图片，数据库可由迁移复现，关键规则有自动化测试，生产构建和部署步骤可重复执行。它不等于第一版就实现支付、配送调度、商家结算和广告竞价。

## 2. Product Boundary

### Included in this delivery

- 匿名用户浏览已发布地点、地图、详情、搜索和筛选。
- 登录用户收藏、投稿地点、撰写评价和上传图片。
- 管理员审核、拒绝、合并投稿，编辑已发布地点，管理媒体和分类标签。
- 餐饮、购物、娱乐、生活服务四类地点，以及跨类别的场景、设施、优惠标签。
- 搜索日志、未命中词、审核日志和数据健康检查。
- Supabase 数据库迁移、RLS、Storage 规则、Next.js 生产构建和部署说明。

### Explicitly deferred

- 在线支付、退款、订单、骑手配送、商家结算。
- 商家自助入驻和认证、广告竞价、优惠券核销。
- Elasticsearch、向量数据库或大模型搜索。
- 原生 iOS/Android 应用。

这些能力可以在地点与用户数据稳定后继续建设，但不应混入当前 MVP 的核心数据模型。

## 3. User Roles and Permissions

| Role | Read published places | Submit place | Review | Manage own draft | Moderate | Edit published data |
| --- | --- | --- | --- | --- | --- | --- |
| Guest (`anon`) | Yes | No | No | No | No | No |
| Member (`authenticated`) | Yes | Yes | Yes | Yes | No | No |
| Admin (`profiles.role = admin`) | Yes | Yes | Yes | Yes | Yes | Yes |

管理员身份只从受保护的 `profiles.role` 或 JWT `app_metadata` 获取，不能使用用户可修改的 `user_metadata`。客户端只持有 publishable/anon key；`service_role` 不进入浏览器。

## 4. Canonical Domain Model

### 4.1 Places and submissions

- `places`：唯一的已发布地点事实。公共页面只读取 `status = 'published'` 的地点。
- `place_submissions`：用户提议的新地点或修改建议，状态为 `draft | pending | approved | rejected | merged`。
- 审核批准通过数据库函数完成：创建或更新 `places`、迁移已上传媒体、写审核日志、更新投稿状态，处于同一事务。
- `source_place_id` 表示“对现有地点提出修改”；`merged_into_place_id` 记录重复投稿最终合并到哪里。

### 4.2 Taxonomy

- `place_categories`：稳定分类，首批 slug 为 `food`, `shopping`, `entertainment`, `service`。
- `tags`：稳定标签，包含 `kind = category | cuisine | product | scene | facility | deal`。
- `tag_aliases`：搜索同义词、澳门常用词、繁简体和英文别名，以及权重。
- `place_tags`：地点与标签多对多关系。一个地点只有一个主分类，可以有多个标签。
- TypeScript 静态目录只作为离线兜底和表单首屏默认值；数据库是运行时唯一事实来源。

`场景`、`设施`、`优惠`不再作为地点主分类。例如“适合拍照”和“学生折扣”是 facet（筛选维度），不是店铺类型。

### 4.3 Reviews and rating confidence

- `reviews`：用户对地点的评价，一名用户对一个地点最多一条活跃评价，可更新，不用空格伪造内容。
- `review_media`：评价图片，必须引用已经存在的评价。
- `places.rating_average` 和 `places.review_count` 由数据库触发器维护。
- 排行使用 Bayesian score（贝叶斯平滑分数），避免一条五星评价直接成为“封神之作”：

```text
confidence_score = (review_count / (review_count + 5)) * rating_average
                 + (5 / (review_count + 5)) * global_average
```

- `封神之作` 至少要求 `review_count >= 5` 且 `rating_average >= 4.8`；样本不足只显示真实均分和“评价较少”，不进入高置信榜单。

### 4.4 Media

- `place_media` 和 `review_media` 保存 bucket、object path、排序、审核状态、所有者和关联实体。
- 投稿图片先上传到私有 `submission-media` bucket 的 `user_id/submission_id/*` 路径。
- 批准投稿后由服务端复制/移动到公开 `place-media` 路径，并在事务中建立记录。
- 放弃草稿、拒绝投稿和删除图片时，通过 Storage API 删除对象；不能只删除数据库 URL，也不能直接修改 `storage` schema。

## 5. Search and Filter Contract

### 5.1 Request

```ts
type PlaceSearchRequest = {
  query?: string;
  category?: 'food' | 'shopping' | 'entertainment' | 'service';
  tagIds?: string[];
  region?: string;
  priceMax?: number;
  minRating?: number;
  openNow?: boolean;
  sort?: 'relevance' | 'rating' | 'distance' | 'newest';
  center?: {longitude: number; latitude: number};
  page?: number;
  pageSize?: number;
};
```

同组标签使用 OR、不同筛选维度使用 AND。例如选择“汉堡、炸鸡”并选择“氹仔”表示 `(汉堡 OR 炸鸡) AND 氹仔`。前端不再只读取 `tags[0]`。

### 5.2 Ranking

Postgres 第一阶段足够支撑澳门区域 MVP：

1. 名称精确命中：100 分。
2. 名称前缀/包含：80/65 分。
3. 标签规范名命中：60 分。
4. 标签别名命中：`50 * alias_weight`。
5. 地址/区域命中：30 分。
6. 关键词全文命中：20 分。
7. 置信评分和距离作为同分排序因素。

使用 `pg_trgm` 的 GIN 索引处理名称模糊匹配，使用 generated `tsvector` 和 GIN 索引处理可搜索文本。RPC 返回 `score` 和 `matched_by`，前端可显示“名称匹配”“标签：汉堡”等解释。

只有当用户明确选择“查看相近结果”时才使用相近类别扩展。零结果必须诚实显示零结果及修改条件建议，不能从固定的 `[中餐, 日料, 奶茶, 甜品]` 随机返回无关地点。

### 5.3 Search feedback loop

`search_events` 记录规范化查询、筛选、结果数、匹配类型和匿名会话标识。管理员查看高频未命中词后，将其加入 `tag_aliases`，无需修改前端代码即可生效。日志不保存敏感自由文本之外的个人信息，并设定保留周期。

## 6. Application Boundaries

```text
Browser UI
  -> Next.js route handlers / server actions
      -> validation + authorization + use-case service
          -> Supabase RPC / tables / Storage
              -> RLS + constraints + triggers (final defense)
```

- 浏览器可直接读取公共地点和当前用户自己的收藏；所有复杂写入经过同源 API。
- API 使用 Zod 做输入校验，返回统一 `ApiSuccess<T> | ApiError`。
- 领域类型放在 `lib/domain/`，Supabase row 映射放在 `lib/data/`，业务用例放在 `lib/services/`。
- 页面只组合状态和组件，不再承载搜索算法、投稿事务或权限判断。
- 管理后台按“审核队列、地点管理、标签管理、运营数据”拆分组件，避免单文件继续膨胀。

## 7. Submission and Moderation Flow

1. 登录用户创建草稿，服务端返回稳定 `submissionId`。
2. 用户填写基本信息、地图位置、主分类、标签和图片；每一步可保存草稿。
3. 提交前服务端做字段校验和重复候选检查（名称相似度 + 200 米距离）。
4. 用户确认后状态从 `draft` 变为 `pending`；此后普通用户不能修改审核字段。
5. 管理员选择批准为新地点、合并到已有地点或拒绝，并填写审核备注。
6. 数据库函数原子化更新地点、标签、媒体、投稿和审计日志。

投稿不再强迫用户评分。评价属于独立流程；创建地点不会预写 `rating_count = 1`。

## 8. Compatibility and Migration Strategy

采用 expand-and-contract（扩展—迁移—收缩）而非清空重建：

1. 新增规范表、约束、索引和兼容视图，不删除 `shops`。
2. 从 `shops` 回填 `places`，保留原 UUID，记录 `legacy_shop_id`。
3. 从旧 `tags`, `tag_ids`, `canonical_tags`, `main_category`, `sub_tags` 归一化到 `place_tags`。
4. 应用进入双读阶段：优先新模型，缺失时读取旧模型。
5. 验证行数、空坐标、孤儿标签、评分聚合和媒体引用。
6. 新模型稳定后停止旧表写入；删除旧字段另开独立迁移，不在本次强制执行。

所有数据库变化放入 `supabase/migrations/`，开发数据放入 `supabase/seed.sql`，RLS 测试放入 `supabase/tests/database/`。远程生产库只允许先 dry-run、备份、在 staging 验证后再 push。

## 9. Security and Reliability

- `public` 暴露表全部启用 RLS，同时显式配置 GRANT；不能只写 policy 不收回权限。
- RLS 的所有 ownership 条件使用 `(select auth.uid())`，并给过滤列建立索引。
- UPDATE policy 同时包含 `USING` 和 `WITH CHECK`。
- 管理函数如必须使用 `SECURITY DEFINER`，放在非暴露 schema、固定 `search_path`、显式撤销 `PUBLIC EXECUTE`，函数内部再次验证管理员。
- 对投稿、评论、搜索日志增加数据库约束、请求大小限制和简单速率限制接口。
- 每个写入返回可追踪 request id；服务端日志不打印 access token、密钥和完整个人资料。
- 所有破坏性管理员操作写 `admin_audit_logs`。

## 10. UI and Accessibility

- 首页保留“列表 + 地图”核心，但搜索框与筛选条件成为 URL 状态，可复制、刷新和后退。
- 搜索建议分为地点、分类、标签和历史搜索，不把标签文字强行写回输入框。
- 激活的筛选以 chips 展示，可单独删除或一键清除，并显示结果数量。
- 投稿改为“基本信息 → 分类位置 → 图片确认”三步。
- 所有图片有替代文本；图标按钮有可访问名称；星级评分支持键盘操作。
- 中文界面统一使用翻译文件，澳门默认 `zh-MO`，避免简繁文本混杂。

## 11. Operational Readiness

- `doctor` 检查环境变量、Node 版本、迁移目录、必需 bucket 和可公开配置。
- CI 至少执行 `npm test`, `npm run lint`, i18n check, `npm run build`；数据库环境可用时再执行 `supabase db reset` 和 `supabase test db`。
- 管理端显示投稿积压、审核时长、搜索零结果率、缺图地点和低置信地点。
- README 提供 Windows 本地运行、Supabase 初始化、迁移、测试、Vercel 部署和回滚步骤。

## 12. Acceptance Criteria

- `汉堡`、`日料`、英文别名和地点名称能得到相关且可解释的结果；未知词不返回无关地点。
- 多标签、区域、价格和评分筛选按既定 AND/OR 语义组合，URL 可复现当前结果。
- 匿名用户无法投稿或评论；登录用户只能修改自己的草稿和评价；管理员权限有服务端校验与 RLS 双重保护。
- 投稿不直接创建公开地点，不要求评分；批准/合并/拒绝有原子状态变化和审核日志。
- 取消或拒绝投稿后没有不可追踪的新孤儿媒体；删除媒体会同时删除 Storage 对象和业务记录。
- 一条五星评价不会获得高置信“封神之作”或榜首资格。
- 新数据库能从迁移和 seed 重建；旧 `shops` 数据有无损回填路径和健康检查。
- `npm test`, `npm run lint`, i18n check, `npm run doctor`, `npm run build` 全部通过。
- 项目包含本地运行、数据库迁移、staging 验证、生产部署和回滚说明。
