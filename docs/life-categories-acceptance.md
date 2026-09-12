# 首发四类地点：本地实现与验收

更新：2026-09-12。数据库分类迁移已执行；应用代码通过本次发布提交上线，完整链路仍需联合验收。

## 实现范围

| 用户入口 | 保存的主分类 | 具体标签 | 地图图标 |
| --- | --- | --- | --- |
| 饭店 | food | 原有餐饮标签 | 餐具 |
| 理发 | service | hair-salon | 剪刀 |
| 酒吧 | entertainment | bar | 酒杯 |
| 桌游／剧本杀 | entertainment | board-games / murder-mystery | 骰子 / 推理放大镜 |

桌游与剧本杀不是同义词，只有明确提供两者时才能同时勾选。历史分类、旧地点、未知历史标签继续保留；超过 8 个标签会要求手动调整，不再静默截掉。分类切换保留兼容场景标签，移除不兼容的主标签。

主要文件：

- `lib/domain/place-types.ts`、`lib/domain/taxonomy.ts`、`lib/tags/schema.ts`：共用类型、主标签及别名。
- `components/LaunchCategorySelector.tsx`、`ContributionForm.tsx`、`app/[locale]/admin/page.tsx`：前后台录入，复用已有 POI 搜索。
- `lib/shops/payload.ts`、`lib/services/submissions.ts`：分类与标签一致性校验。
- `lib/data/tag-catalog.ts`、投稿提交/审核/合并 API：数据库标签缺失时阻止提交或发布，避免类型被静默丢失。
- `lib/search/filter-options.ts`、`lib/search/url-state.ts`、`app/[locale]/page.tsx`、`components/FilterBar.tsx`、`ShopList.tsx`：手机和电脑筛选。
- `lib/amap/place-marker.ts`、`components/MapPlaceholder.tsx`、`PlaceTypeBadge.tsx`、卡片/详情/审核队列：统一类型名称及图标。

## 数据库迁移状态（已执行）

用户已明确授权执行线上 Supabase 分类迁移：

- `supabase/migrations/20260912034831_launch_life_categories.sql`
- `supabase/tests/database/launch_life_categories.test.sql`

迁移新增 bar（ID 尾号 704）、murder-mystery（705）及 17 条别名，扩展 `shops_category_check`，保留所有已知旧值。事务遇到冲突会中止；有锁等待超时。执行前后均为 0 条 legacy shops、1 条 canonical place、2 条投稿，没有修改已有地点、投稿或 favorites 数据。

线上迁移记录版本为 `20260912034831`。匿名角色已验证可读取两项有效标签；数据库现有 35 个标签。`shops_category_check` 已允许 shopping / entertainment / service，同时保留 food / drink / vibe / deal / all。

当前机器没有 Docker Desktop / Podman，本轮仍未运行本地 pgTAP。不要对生产运行 db reset，也不要为界面演示创建虚构线上地点。应用发布后，使用真实地点或明确允许的测试地点完成联合验收。

## 本地运行与自动检查

```powershell
Set-Location D:\CityU_Food
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run i18n:check
npm run doctor
npm run build
git diff --check
npm run start -- --port 3011
```

浏览器打开 `http://localhost:3011/zh-CN`。本地页面仍可能连接生产 Supabase；未明确切换到测试环境前，只做浏览和筛选，不测试写入。

自动测试覆盖：新别名、四类选择与筛选、标签顺序、旧数据兼容、后台 payload 经 mapper 读回、主分类冲突、标签上限、桌游/剧本杀区分、缺失价格、三种大小的安全图标 HTML、数据库目录缺失/网络异常。它们不代替真实数据库和浏览器完整投稿审核流程。

## 手动联合验收（等待用户确认开始）

1. 在已准备且明确允许写入的测试环境，分别创建饭店、理发、酒吧、仅桌游、仅剧本杀五条测试记录；核对同名分店的 POI ID、地址和坐标。
2. 从用户投稿与管理员录入两条路径分别验证保存、审核、队列与顶部统计刷新。拒绝分类冲突；切换类型不遗留旧主标签。
3. 刷新或重新进入用户首页，四类筛选、列表数量和地图地点一致。桌游子筛选不得显示仅剧本杀地点，反之亦然。刷新、浏览器后退和清空筛选正常。
4. 点击“查看位置”，定位到该分店；普通、选中、悬停、筛选后的图标均正确。点击地图打开对应地点；过滤掉当前地点后不残留旧详情。
5. 核对卡片、手机详情、独立详情中的类型和消费参考；缺价格不能显示 0 元。旧餐厅仍能找到并显示餐具。
6. 手机和电脑分别检查；手机分类栏可横向滑动，桌游/剧本杀子选项可点击，界面不溢出。
7. 真机测试高德导航：澳门目的地、iOS/Android、微信/普通浏览器、未装高德、拒绝定位、缺坐标、复制失败。不能以链接存在代替导航成功。

## 已检查与未检查

- 本轮最终检查：34 个测试文件 / 213 个测试通过；lint、TypeScript、i18n（227 keys）、doctor（14/14）、production build 均通过。`git diff --check` 通过，仅有 LF→CRLF 提示；build 有既有 Edge runtime 静态生成提示。
- 已在本地浏览器确认桌面四类入口；理发无结果时不混入旧餐厅，切回“全部”恢复真实旧店铺。
- 已确认真实餐厅“查看位置”能定位并显示餐具图标；手机 390×844 布局可进入桌游/剧本杀并显示两个独立子选项。
- 新生活类型的图标逻辑有自动测试，但缺少已授权的真实/测试生活地点，尚未完成其数据库写入及地图实景联合验收。
- 已核对远程结构：PostgreSQL 17、四个 canonical 大类和相关外键/RLS 均与迁移一致；bar / murder-mystery 和新分类约束已经生效。
- Supabase advisors 没有发现由本次标签/约束迁移新增的专项问题；报告仍列出项目原有 RLS、SECURITY DEFINER、索引和密码保护提醒，应另开安全维护任务处理。
- 线上应用联合验收、真机导航、pgTAP、canonical-only 收藏持久化不包含在数据库迁移验证中，需分别确认。
- 保留原有未提交改动，根目录 `PLAN.md` 未修改，问卷未发布。
