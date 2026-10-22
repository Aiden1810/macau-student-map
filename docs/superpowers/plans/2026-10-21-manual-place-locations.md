# 手动地点与小摊收录实施计划

> 使用 superpowers:executing-plans 在当前会话逐项执行。用户已批准聊天中的方案并要求继续实现。

**Goal:** 地图搜不到的地点也能通过手动选点、位置描述和审核可靠收录。

**Architecture:** 在现有 places / place_submissions 增加 location_details JSONB；使用同一个校验模型贯穿投稿、审核、公开数据和详情。保留现有分类、坐标和审核权限，不新增独立板块。

**Tech Stack:** Next.js、React、TypeScript、Zod、Supabase PostgreSQL、Vitest、PGlite；不新增依赖。

**Spec:** 本会话已确认的第一版：手动标点＋位置描述＋小摊标记＋位置确定程度；照片、出摊时间可选。

## Global Constraints

- Windows；保持现有项目结构及工作区中用户已有修改。
- 经营形式与美食分类独立；旧资料默认未知，不推断准确位置或营业状态。
- 手动提交和手动地点发布必须有位置描述；草稿允许待补充。
- 地标用于辅助定位，不覆盖摊位名称；采用地标坐标时只能标为大致位置。
- 不实施实时追踪、自动营业状态、到访打卡或历史投稿内容猜测补全。

## Review Focus

- 已选择搜索结果再切手动模式，不得保留旧店名或旧坐标。
- 搜索地标、重新选点、切回搜索模式，不得混用不同来源的坐标。
- 审核保存、重新加载、发布后详情必须保留所有位置字段。
- 数据库直接写入也要拒绝非法字段及缺少描述的手动发布，普通用户仍无管理权限。
- 旧地点及旧客户端省略字段时保持兼容，重复 ID 合并不得丢失新资料。

## Task 1 — 数据契约和数据库

Files: `lib/domain/location-details.ts`、投稿和管理校验、两个 repository、`supabase/migrations/*_manual_place_locations.sql`、位置服务及 PGlite 测试。

- [x] 先写并运行测试：手动发布要求描述；旧记录未知；拒绝非法字段；草稿可缺描述。
- [x] 实现共享字段：source、businessForm、accuracy、mobility、description、landmark、hours。
- [x] 增加两表字段；扩展现有管理员校验和保存函数；添加数据库约束及发布校验，保留权限和审计。
- [x] 验证真实 SQL 中保存、审核发布、重新读取和权限拒绝。

## Task 2 — 投稿与审核

Files: `components/ContributionForm.tsx`、`components/admin/PlaceEditor.tsx`、共享位置表单、投稿 API、管理数据读取、组件交互测试。

- [x] 先验证手动名称不被地标覆盖、描述进入 API、切换模式不串用坐标。
- [x] 添加可复用的位置资料表单；投稿保留一个入口，支持重选地图点及返回搜索。
- [x] 审核可查看、修正位置资料，并明确提示核对位置依据。
- [x] 运行组件和 API 回归测试。

## Task 3 — 公开展示和验证

Files: `types/shop.ts`、`lib/mappers/canonical-shop.ts`、公开查询、列表合并、地点卡片、详情和导航、操作说明。

- [x] 先验证公开映射和旧新资料合并不会丢失位置资料。
- [x] 在卡片显示小摊和大致位置标记，详情展示怎么找、参考地标、出摊时间和位置变动提示；复制包含找路信息。
- [x] 加入小摊筛选，沿用现有筛选结构。
- [x] 运行完整测试、TypeScript、lint、build；检查移动端实际显示。
- [x] 更新操作说明和验证结果；交付运行方法及部署前迁移要求。

## Execution ledger

- 已确认：当前分支已有用户文档和 tmp 修改，保留；在原结构小步修改。
- Ruling: 直接执行已批准的第一版 — 用户明确要求按方案继续 — 不额外增加实时状态等功能。

- Review: 独立审查发现并修复手机选点遮挡、旧点复用和旧客户端清空字段；聚焦复审通过。
- Verified: 93 个测试文件／566 项测试通过；TypeScript、lint、i18n、正式构建通过。真实数据库回滚验证通过、测试记录为 0；手机实际选点和模拟详情已查看截图。
- Migration: 已应用到项目配置对应的 Supabase；本地文件对齐远程版本 20261021133733。前端代码未推送或发布线上。
