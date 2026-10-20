# 其他菜系：实现与验收

日期：2026-10-21（香港时间）。

## 交互与数据规则

- 投稿、管理员地点编辑和旧店铺编辑共用 `components/PrimaryTagSelector.tsx`。点击“其他菜系”展开印度菜、东南亚菜、其他／暂未细分；展开本身不算选择。
- 保存实际选择的具体标签，不额外保存父分组，继续执行合计最多 8 个标签的限制。
- 印度菜：`indian-cuisine`，ID `00000000-0000-0000-0000-000000000112`。
- 其他／暂未细分：`other-cuisine`，ID `00000000-0000-0000-0000-000000000113`，对外显示“其他菜系”。
- 东南亚菜保留原有 `southeast-asian-cuisine` 及 ID 尾号 111；旧数据不需要重新分类。
- 搜索或筛选“其他菜系”命中以上三种标签；单独筛选印度菜不匹配东南亚菜。具体菜系与父分组在店铺卡片、手机卡片、详情及后台列表展示。
- 普通搜索、后台搜索、AI 助手匹配与 SQL `search_places` 使用同一组菜系语义。印度菜支持中英文明确名称；不将“咖喱”推断为印度菜。
- 历史别名按 ID 增删：例如“泰餐”可以取消为东南亚菜；“日韩料理”取消日料后保留韩餐，未知自定义标签不丢失。

## 数据库迁移

`supabase/migrations/20261020163349_other_cuisines.sql` 已应用到当前项目 Macau-Student-Map，线上记录版本 `20261020163349`。

新增两项标签及搜索别名，更新 `private.assert_place_editor_input` 白名单和 `public.search_places` 的父分组过滤。事务有超时与 ID/slug 冲突检查，能够重复执行。没有变更既有函数的角色授权或安全模式。

迁移前后数量：50 个地点、163 条地点标签关联、8 条投稿。已验证匿名角色可读取 3 项菜系与印度菜别名，新类型通过数据库保存校验。安全 advisors 的发现与迁移前一致。

当前线上没有已发布且带这三项标签的地点，父筛选实际结果与预期均为 0；有结果的查询语义使用本地 PGlite PostgreSQL 测试数据验证，没有往线上创建演示店铺。

## 主要文件

- 分类与标签：`lib/domain/taxonomy.ts`、`lib/domain/place-types.ts`、`lib/tags/schema.ts`。
- 共用选择器及投稿：`components/PrimaryTagSelector.tsx`、`components/ContributionForm.tsx`。
- 后台：`components/admin/PlaceEditor.tsx`、`PlacesManager.tsx`、`SubmissionQueue.tsx`，以及旧后台 `app/[locale]/admin/page.tsx`。
- 搜索：`lib/search/filter-options.ts`、`legacy-filters.ts`、`lib/services/search-places.ts`、`lib/assistant/decision.ts`。
- 店铺展示：`lib/tags/display.ts`、`lib/mappers/canonical-shop.ts`、`lib/mappers/shop.ts`、`components/MobilePlaceCard.tsx`。
- 检查配置：Vitest 只收集 `tests`，最多使用 4 个 worker，避免大量并发导致子进程清理测试超时；TypeScript 排除 `output`、`.worktrees`、`tmp`，避免旧发布源码进入当前测试与类型检查。

## 本地运行和验证

```powershell
Set-Location D:\项目\CityU_Food
npm test
npm run lint
npm run i18n:check
npm run build
npx tsc --noEmit --incremental false
npm run start -- --port 3015
```

构建与独立 TypeScript 检查按顺序执行，二者会读写 `.next/types`。

浏览器打开 `http://localhost:3015/zh-CN`，在“美食 → 分类 → 其他菜系”选择父分组或具体菜系，验证地址栏、刷新、清空筛选。390×844 手机尺寸已检查分类选项及横向溢出。

投稿和后台选择器已做 React DOM 交互测试；数据库有本地 PostgreSQL 执行测试，包含分类冲突、搜索父子关系与迁移重跑。

最终检查：86 个测试文件、529 项测试通过；ESLint、TypeScript、三语言文案检查、production build、doctor（14/14）与 `git diff --check` 通过。浏览器确认“其他菜系”筛选刷新后仍保留，390px 页面宽度与内容宽度一致。手机筛选截图保存于 `output/cuisine-check/mobile-filter.png`。

本轮未登录浏览器创建真实投稿并完成审核发布；该完整人工流程仍需使用用户实际允许的地点验收。数据库迁移已完成；应用发布状态见 [本次发布记录](release-other-cuisines-2026-10-21.md)。

## 后续扩展

后续根据真实投稿增加具体菜系时，维护共用分组、标准标签和配套数据库迁移；无需再为投稿和后台各写一套选择器。此轮不增加自由创建公共标签的功能。
