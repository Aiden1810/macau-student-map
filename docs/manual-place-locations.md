# 地图搜不到的地点与小摊收录

## 已实现的第一版

沿用现有投稿入口，支持地图搜索店铺或手动录入地点。手动地点需要名称、地图位置、位置描述和具体类型；经营形式、位置准确程度、是否固定、参考地标、营业／出摊时间单独记录，照片仍然可选。

投稿表单开头增加“店铺／小摊”选择，首页仍保留一个投稿入口。店铺默认搜索店名，小摊默认手动填写并自动标记经营形式；两者均可使用地图搜索或手动定位。切换方式保留位置描述，切换经营形式也保留已经填写的地点资料、分类、草稿和图片。空表单可以自由切换默认路径，不会因为选择“小摊”就立即遮住表单进入地图选点。

这服务于城觅的收录目标：分享同学吃过、熟悉的本地好去处，包括地图或点评平台尚未收录的小店小摊。是否上榜或平台是否收录，不作为地点质量的推断依据。

经营形式“小摊”与美食分类独立。使用附近地标定位时保留投稿地点的名称，采用的坐标只能显示为大致位置。地图选点和重新选点期间收起表单、隐藏移动端店铺抽屉；返回后保留已填写的文字，但更换定位来源会使旧地图点失效。

公开卡片、移动端卡片和详情展示小摊及位置提示。详情说明怎么找、附近地标、参考出摊时间及位置变化；复制地址会包含位置描述和不确定提示。快捷筛选增加“小摊”，只匹配明确记录的经营形式，不根据店名推断。

旧资料默认为未知，不推断准确位置、固定经营或当前营业。旧管理员客户端省略新字段时，更新保留原有位置资料。

## 使用方式

1. 打开首页“我的 → 投稿”。
2. 选择“店铺”或“小摊”。店铺优先搜索店名；小摊直接填写资料，经营形式自动填好。
3. 搜索不到时手动添加；小摊点击“在地图标点”选择实际位置，或者搜索附近地标。已被地图收录的小摊也可以点“返回搜索店铺”搜索其本身。
4. 填写名称、怎么找和具体类型。位置准确程度、是否固定等不确定的信息保留未知。
5. 登录后提交审核。管理员从投稿队列打开“编辑并审核”，核对位置描述、标点和环境照片后发布。

对于历史的“楼下烤冷面”投稿，需要人工确认地标名称与摆摊位置，然后在审核表单中选择“手动地点”补充资料。此次没有猜测其实际坐标，也没有修改或批准这条历史投稿。

## 文件与数据流

| 文件 | 作用 |
| --- | --- |
| `lib/domain/location-details.ts` | 共享字段校验、默认值和找路文字 |
| `components/LocationDetailsFields.tsx` | 投稿与审核复用表单 |
| `components/ContributionForm.tsx`、`app/[locale]/page.tsx` | 录入、地标搜索、地图选点及移动端切换 |
| `components/admin/PlaceEditor.tsx`、`components/admin/SubmissionQueue.tsx` | 审核显示、修改和发布 |
| `lib/data/*`、`lib/admin/place-data.ts`、`lib/mappers/canonical-shop.ts`、投稿 API | 数据保存、读取、公开映射 |
| `components/PlaceLocationInfo.tsx`、卡片、详情与导航组件 | 公开提示、复制位置与小摊筛选 |
| `supabase/migrations/20261021133733_manual_place_locations.sql` | 两表新字段、数据库校验及两条审核路径 |
| `supabase/tests/manual/manual_place_locations.rollback.sql` | 真实数据库回滚验证 |

`places.location_details` 与 `place_submissions.location_details` 使用 JSONB，字段为 `source`、`businessForm`、`accuracy`、`mobility`、`description`、`landmark`、`hours`。数据库独立拒绝未知字段、非法取值和没有位置描述的手动发布，权限与审计沿用现有规则。资料没有存入只供管理员查看的原稿备注中。

数据库迁移已于 2026-10-21 应用到项目配置对应的 Macau-Student-Map，迁移版本 `20261021133733` 与本地文件一致。不应再次执行该已应用的迁移。

## 生产发布记录（2026-10-21）

- 正式入口：[城觅](https://www.aiden-macau-map.top/zh-CN)。根域名跳转到 www 后返回 200。
- 新生产部署：`dpl_HJvzygnHh1aagk4fT4dyGMen63MW`，部署地址 `https://macau-student-60qo6hv7o-aiden1810s-projects.vercel.app`。
- 先以 production / skip-domain 构建，确认 Ready，并检查页面、公开地点 API（200，7 条地点、新字段存在）和未登录投稿拒绝（401），然后通过 promote 切换正式域名。正式域名的页面和同样两个 API 检查通过。
- 发布前全套 569 项测试、TypeScript、lint、三种语言键名、正式构建及独立代码审查通过。
- 发布后实际打开正式域名，在 390×844 浏览器完成“我的 → 投稿 → 小摊”，确认小摊选中、地图标点入口可用、无横向溢出和控制台错误；截图为 `output/playwright/production-stall-contribution.png`。未登录状态检查仅验证界面与拒绝写入，未创建真实投稿。
- 使用独立源文件快照部署，未复制本地 `.env.local`、其他用户文档和临时文件。发布清单位于本地忽略目录 `output/releases/20261021-store-stall-manifest.json`；基础提交为 `896b838dccd6e987ec1049cc2a48f57040088e0f`，实际部署包含本次工作区改动，未自动提交或推送 Git。
- 上一生产部署为 `dpl_3eaVPCuMYe45rS2vtkJUVopFzoTf`，地址 `https://macau-student-cybsseec0-aiden1810s-projects.vercel.app`，用于需要时回退。

## 本地运行

沿用现有 `.env.local`，没有新增第三方依赖。

```powershell
Set-Location 'D:\项目\CityU_Food'
npm run dev -- --port 3100
```

打开 `http://localhost:3100/zh-CN`。若 3100 已运行本次预览，直接访问即可。

## 验证

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run i18n:check
npm run build
```

- 全套 Vitest：93 个文件、569 项测试通过；TypeScript、lint、语言键检查及正式构建通过。
- 新测试覆盖：缺少描述拒绝提交、草稿兼容、地标不覆盖名称、旧坐标失效、管理保存保留字段、公开默认未知、复制提示、小摊筛选数据、移动端卡片及两条 SQL 审核路径。
- 真实 Supabase 回滚 SQL：保存／更新、旧客户端省略字段、两条发布路径、非法手动发布拒绝、非管理员拒绝；查询确认测试地点和投稿均为 0。
- 真实本地 HTTP：公开地点 API 返回 200，返回 7 条现有资料及未知默认值；未登录投稿返回 401。
- Playwright 真实移动端 390×844：手动选点、重新选点、地图可点击、文字保留、无横向溢出；没有用真实账号提交浏览器测试投稿。
- 已用隔离的模拟接口检查完整移动端详情：小摊、大致位置、位置变化、找路描述、地标、参考时间、导航提示均正常显示。该示例未写入数据库，不代表真实账号已完成浏览器投稿和审批全流程。
- 店铺／小摊入口交互测试涵盖默认路径、小摊自动标记、手动店铺保留 store、切换搜索保留描述和经营形式。实际 390×844 浏览器已检查两种选项、选点和返回，未发生横向溢出或浏览器错误。
- 浏览器截图保存在本地忽略目录 `output/playwright/`，包括 `manual-location-map-pick.png`、`manual-location-form.png` 与 `manual-location-detail.png`。

检查中另观察到一张既有店铺图片的 Next.js 图片请求返回 500，此次没有修改该图片资料。开发浏览器的既有 Service Worker 会缓存开发资源，新增语言键的检查以重新加载和正式构建为准。

Supabase 安全顾问仍提示现有管理员 SECURITY DEFINER RPC 对 authenticated 可调用；函数体继续强制校验管理员，普通账号拒绝测试通过。另有既有表未配 RLS policy、未启用泄露密码检查的提示，此次未变更相关权限。参考：[RPC 权限说明](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)、[RLS 提示](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)、[密码保护](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。JSONB 的用法参考 [Supabase 官方文档](https://supabase.com/docs/guides/database/json)。

## 后续可改进

近期到访确认、位置变化反馈、流动摊位的多个常见出摊点可在真实需求出现后增加。第一版不自动判断营业状态，也不做实时追踪。
