# 注册增长与 API 用量看板（第一阶段）

## 管理员怎么查看

进入 `/zh-CN/admin`，在「用户管理」查看现有注册总量和新增趋势；可切换近 24 小时、近 7 天、近 30 天。在「用量与运行」查看已采集的接口请求、AI 调用、Token、费用参考区间、错误、限流、超时和响应耗时。

注册增长按 Supabase Auth 的 `created_at` 计算，不依赖 profile 是否创建。排除已删除和匿名账号。因此统计的是当前仍存在的注册账号，删除后无法还原历史累计注册量。近 24 小时采用滚动窗口；7／30 天采用含今天的澳门自然日。邮箱搜索不影响增长统计。

## 本轮实现

- `components/admin/{UserGrowthPanel,UsageDashboard,DashboardStatsPanels}.tsx`：两个看板、时间范围、刷新、图表、状态提示和手机布局。
- `lib/admin/{dashboard-stats,registrations-api,usage-api}.ts` 及两个 admin 路由：管理员验证、返回值校验、私有且不缓存的汇总接口。
- `lib/observability/{events,context,recorder}.ts`：白名单事件、每个请求独立的上下文、耗时、AI 用量及响应后批量写入。
- 两个助手模型适配器和 assistant／assistant/chat／places／shops 路由：在实际执行位置记录调用，不根据按钮点击推算。
- `supabase/migrations/20261022023204_admin_usage_dashboard.sql`：私有表、有限只写函数、管理员聚合、45 天清理。
- 四个新增测试文件；目录 UI 测试隔离子组件，两个旧公开 GET 测试补充真实 Request。

## 统计含义和限制

HTTP 请求数和 AI 请求数是两个口径：一次助手请求可能产生一条 HTTP 记录和一条 AI 记录，不能相加后当作使用人数。只记录正式生产环境和指定正式域名；本地与预览不采集。正式域名上的机器人、技术检查也实际消耗 API，因此计入。记录不包含用户身份、邮箱、IP、聊天正文、位置或密钥。

目前覆盖 `/api/assistant`、`/api/assistant/chat`、`/api/places` 和 `/api/shops`。没有浏览器端高德调用数量、去重 AI 使用人数、Supabase／Vercel 套餐余额或真实账单。采集失败不阻断用户请求，因此页面明确显示「已保存的记录」，不承诺百分之百完整。没有历史补录。

AI 服务商缺失的 usage 字段保持未知；即使 SDK 将其补成零，也优先核查原始响应。未知模型或缺少输入／输出 Token 时不伪造零费用。DeepSeek 价格按 2026-10-22 官方价计算 USD 峰谷参考区间；未判断节假日，未包含其他服务成本。来源：https://api-docs.deepseek.com/quick_start/pricing/ 。

记录按日、在下一次成功写入时清理 45 天前的数据；完全没有新请求时，旧记录可能继续保留到下一次写入。看板最大查询范围为 30 天。

## 权限与配置

私有 schema 的表启用 RLS，客户端没有表访问权。注册和用量聚合函数在数据库内检查当前账号仍为管理员。写入函数使用独立的 64 位随机令牌，只能写允许字段，最多 20 条，事件 ID 幂等；数据库仅保存令牌 SHA-256。令牌只保存为 Vercel 生产环境的服务端 Secret `API_USAGE_INGEST_TOKEN`，不使用 `service_role`，不进入 Git 或本地明文文件。

迁移初始不启用采集，配置摘要后才启用。迁移与用量配置不会修改店铺、投稿、评价或注册账号。

## 本地运行和验证

沿用现有环境：`npm ci`、`npm run dev`，管理员登录后打开后台。默认本地不采集正式用量。

执行 `npm test`、`npx tsc --noEmit`、`npm run lint`、`npm run i18n:check` 和 `npm run build`。测试覆盖 PostgreSQL 角色权限、时间边界、缺失 profile、未知用量、幂等、输入限制、清理、真实 SDK 使用虚构服务商响应、请求隔离及 UI／API 状态。独立浏览器使用虚构数据验证电脑和手机布局，不创建真实账号或发起付费 AI 请求。

## 发布来源

起点提交为 `896b838`。此前生产环境的小摊／手动地点功能来自 `output/releases/20261021-store-stall` 发布快照，尚未提交到 Git。本轮发布保留其中 SHA-256 校验通过的 40 个功能／测试／迁移文件，和本轮修改没有重叠；这些文件不纳入本轮 Git 提交，原目录的其他工作保持原样。单独从本轮 Git 提交部署会丢失已上线功能，因此必须使用组合发布目录及其 manifest。

发布完成后在此补记迁移映射、组合校验和部署结果。

## 后续可改进

下一阶段再增加内容运营、搜索无结果、访问转化等看板；浏览器地图服务和服务商实际账单需要单独接入，不能从当前服务器统计直接推算。
