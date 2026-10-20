# 平台管理员工作台第一版

本轮沿用现有后台，商家后台暂缓。代码在 `codex/admin-place-workflow` 上修改，未部署、未提交或推送，也未执行远端迁移。没有修改真实店铺、评价、反馈或其他人工数据，没有读取、输出或覆盖 `.env.local` 密钥。

## 完成内容

1. 总览默认近 7 个澳门自然日，保留 24 小时、7 天、30 天选择。展示地点、投稿、反馈、评价待办、使用概况、内容质量、搜索需求和最近操作。
2. 新增“数据分析”：访问趋势、热门路径、设备、来源、重复访问较多的浏览器、最近 50 条已加载前台访问明细，以及独立地点详情页热度。明细可按设备与来源筛选，每页 10 条。
3. 搜索面板展示热门词、无结果词、搜索次数与筛选记录数量；无结果词只是补充资料的线索，不自动导入或修改地点。
4. 内容质量只检查已发布的新地点资料，统计缺图片、缺地址、缺坐标；点击问题进入现有地点管理的对应筛选，也可打开原有地点编辑器。
5. 新增“操作记录”，解析现有数据库的操作类型、嵌套地点名称、操作者短编号和澳门时间。
6. 未来的本地开发、本机与常见私有局域网地址的页面浏览和首页搜索不再发送统计；后台和登录页面不再采集页面浏览。没有删除历史统计。

## 文件与职责

| 文件 | 作用 |
| --- | --- |
| `components/admin/PlatformDashboard.tsx` | 工作台加载、时间范围、刷新及各面板组合 |
| `components/admin/OperationsPanels.tsx` | 质量、搜索、访问明细、操作记录和共享数据提示 |
| `components/admin/AdminNavigation.tsx`、`AdminQuickLinks.tsx` | 新入口与四类管理快捷卡片 |
| `components/admin/PlacesManager.tsx`、`lib/admin/place-quality.ts` | 对现有地点列表增加资料完整度筛选，重复进入同一待办时清空旧搜索 |
| `app/[locale]/admin/page.tsx` | 在原有后台接入工作台和现有编辑器 |
| `lib/admin/operations.ts`、`traffic.ts` | 统计类型、统一时间窗口、设备来源归类、关键词与资料质量汇总 |
| `lib/admin/operations-repository.ts` | 有上限的分页只读查询、错误隔离与审计记录映射 |
| `lib/admin/operations-api.ts`、`app/api/admin/operations/route.ts` | 复用管理员鉴权与用户权限的 GET 接口，`private, no-store` |
| `lib/analytics/traffic-policy.ts`、`components/TrafficTracker.tsx`、`app/[locale]/page.tsx` | 页面与搜索统计共用本地环境排除规则；统计失败不阻断公共页面 |
| `supabase/migrations/20261019163622_admin_search_events_read.sql` | 本地新增的最小搜索读取权限迁移，远端未执行 |
| `tests/lib/admin/operations*.test.ts` | 汇总、分页、权限入口、失败状态和实际审计格式测试 |
| `tests/lib/admin/platform-dashboard.test.tsx`、`place-quality-filter.test.tsx` | 工作台交互、请求竞争、错误状态及重复质量入口回归测试 |
| `tests/lib/admin/search-permissions.test.ts` | 在隔离 PostgreSQL 中执行真实搜索表定义、RLS 和新增迁移 |

没有增加第三方依赖。保留原有店铺编辑、投稿审核、评价审核、反馈处理与旧版工具，没有大规模重构。

## 数据口径和限制

- 24 小时为滚动窗口；7 天／30 天为澳门自然日，包含今天；不使用管理员电脑的时区。
- 待办和地点质量为当前快照，不受时间范围影响。地点质量与地点管理一致，只涵盖 `legacy_shop_id is null` 的新地点资料。
- 访问和搜索各最多读取所选期间最近 5,000 条；地点最多 500 条，审计最多 30 条。查询按稳定字段排序，分批读取，记录数超过上限或无法确认完整性时明确提示，不当作完整总量。
- 最近访问明细只展示上述已加载记录中的最近 50 条前台访问；设备和来源筛选仅作用于这 50 条，不是全库明细检索。
- 去重浏览器是存储标识的去重，不能解释成实际人数。浏览器显示编号只在当前报告内有效，不是跨报告追踪编号。
- 设备／疑似自动化是按 User-Agent 声明推测，不能确认真人。来源只显示域名，不输出完整 URL、查询参数、原始 User-Agent、原始浏览器标识或完整登录账号 ID。
- 来源为空可能来自浏览器隐私限制、应用内打开等原因；同站来源也不是外部获客渠道，当前没有可靠的会话级归因。
- 历史记录没有页面运行环境字段。`localhost` 来源仅说明来源页，不能直接证明当前记录发生于本地，也不能据此精确剔除历史测试访问。生产模式的云预览地址不会自动被识别为测试环境。
- 地点热度只统计 `/shop/:id` 独立详情页路径，不包含首页弹窗打开、导航点击、收藏、分享或实际到店。未采集的行为不显示为零转化或成交率。
- 当前首页只上报满足原有规则的关键词搜索；“只有筛选条件”的统计仅反映已有记录，不代表已全面采集所有筛选操作。
- 操作记录只涵盖已写入审计表的管理操作；不宣称所有历史修改均已留痕。

## 真实访问的只读核对

通过 Supabase 连接对现有项目执行 SELECT 聚合与权限查询，没有写入或回填数据，没有读取密钥。

按澳门时间 **2026-10-19 00:00 至 2026-10-20 00:00**，排除后台和登录等路径后：

| 项目 | 结果 |
| --- | --- |
| 页面浏览 | 89 次 |
| 去重浏览器标识 | 61 个 |
| 手机声明 | 55 次、37 个浏览器标识 |
| 电脑声明 | 23 次、16 个浏览器标识 |
| 疑似自动化声明 | 10 次、7 个浏览器标识 |
| 平板声明 | 1 次、1 个浏览器标识 |
| 无来源／直接来源未明 | 51 次 |
| `weixin110.qq.com` 来源 | 37 次 |
| `macau-student-map.vercel.app` 来源 | 1 次 |
| 浏览最多的时段 | 18 时 28 次；17 时 15 次；01 时 10 次 |

设备组中的浏览器标识可能跨组出现，不能把各组标识数当作互斥人群。仅凭微信相关域名不能确认访问来自真实用户、检查服务或某种特定机制；同样，10 次疑似自动化也不能直接换算成需要扣除的人数。上述核对复现了原来的 89／61，但不能推出实际人数或“除以 2”的估计。

## 数据库启用条件

本次核对确认：`authenticated` 对 `search_events` 没有表级 SELECT 权限，虽然已有管理员 SELECT RLS policy。新增本地迁移只补：

```sql
grant select on table public.search_events to authenticated;
```

继续使用现有 `canonical_search_events_admin_read` RLS policy 限制管理员；没有授予匿名读取，也没有新增修改或删除权限。隔离 PostgreSQL 测试验证管理员可读、普通账号读到 0 行、匿名读取被拒绝。

**本轮没有执行远端迁移。** 正式启用前需按既有发布流程分别处理：

- `20261019163622_admin_search_events_read.sql`：新搜索读取权限。未安装时工作台提示“搜索统计读取权限尚未启用”。
- `20261019110033_review_post_moderation.sql`：上一轮评价审核迁移，仍未在远端执行。需与评价应用版本配套；未安装时评价待办提示“尚未启用”，不显示为 0 条。
- 已安装的 `20261019081749` 批量状态迁移没有重复执行。

## 验证与本地运行

```powershell
Set-Location 'D:\项目\CityU_Food'
npm test
npm run lint
npx tsc --noEmit
npm run i18n:check

# 保留原来的 56544 预览，使用独立构建目录。
$env:CITYU_BUILD_DIR = 'output/platform-admin-build'
npm run build
npm run start -- --port 56545
```

打开 `http://localhost:56545/zh-CN/admin`，使用管理员账号登录。构建可能自动更新 `next-env.d.ts` 与 `tsconfig.json` 引用的类型目录；本轮已恢复这些验证过程产生的配置改动，没有将临时构建目录写入交付配置。

浏览器验收使用 `output/platform-admin-testing/` 中的隔离页面、虚构记录和查询客户端适配器，调用实际工作台组件及实际只读处理器；不等同于正式 Supabase 管理员完整联调。没有使用真实账号新增、编辑、审核或删除店铺、评价与反馈。

- 桌面 1280px、手机 390px 与 320px 无整页横向溢出。
- 已检查设备筛选、明细翻页、时间切换、重复进入质量待办、审计名称解析、失败隐藏旧统计与重试恢复。
- 浏览器没有运行时异常。主动模拟 503 的失败场景产生一条预期网络错误，不属于正常加载错误。
- 实际 Next.js 的未登录 GET 返回 401，缓存策略为 `private, no-store`；POST 返回 405。
- 独立代码复核发现的搜索权限、审计格式和质量入口残留筛选问题均已修复并增加回归测试。
- 最终全量验证：74 个测试文件、477 项测试通过；ESLint、TypeScript、三语言 275 个 key 契约和独立生产构建均通过。原有 DeepSeek JSON schema 兼容模式提示仍会出现，本轮没有改动模型配置。
- 正式库管理员查询仍需在迁移启用后，用真实管理员登录完成验收；本轮没有代为执行远端迁移。

截图（全部明确标注为虚构演示数据）：

- `output/playwright/platform-overview-desktop.png`
- `output/playwright/platform-overview-mobile.png`
- `output/playwright/platform-analytics-1280.png`
- `output/playwright/platform-analytics-390.png`
- `output/playwright/platform-analytics-320.png`

后续可在这一版稳定后，单独设计运行环境标记、首页详情弹窗和导航埋点、可靠的会话来源归因，再开始商家后台；本轮没有提前加入这些功能。
