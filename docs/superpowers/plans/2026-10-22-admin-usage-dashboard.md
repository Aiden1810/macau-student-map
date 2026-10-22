# 管理后台注册增长与 API 用量实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在独立 worktree 中完成第一阶段注册增长、AI 用量与关键接口运行看板，保留现有功能和其他窗口工作。

**Architecture:** 注册趋势由管理员专用数据库函数聚合 Auth 注册时间。服务器记录 AI 和 HTTP 的必要元数据，使用独立写入令牌和有界只写 RPC 保存到未公开 schema；后台仅返回汇总。Next.js after 在响应后写入一批记录，写入失败不阻断业务。

**Tech Stack:** Next.js 15.5.28、AI SDK 7.0.143、Supabase/PostgreSQL、React、现有 Vitest/PGlite，不新增依赖。

**Spec:** docs/admin-dashboard-roadmap-2026-10-22.md；用户已确认“直接做”，按已说明的第一阶段实施。

## Global Constraints

- 不输出、覆盖或提交 .env.local；不复制任何真实业务数据，不执行真实店铺／投稿／评价写入。
- 单独工作目录 C:/Users/AnD/.codex/worktrees/admin-usage-dashboard/CityU_Food，起点 896b838；不提交另一窗口的手动地点资料修改；发布时保留其已上线快照。
- 注册统计用澳门时间：24h 为滚动 24 小时；7d、30d 为含今天的澳门自然日，与既有访问分析一致。
- 费用为官方峰谷价参考区间（USD），标注价格核对日期、来源和覆盖率；未知模型或缺失输入／输出用量不计为零费用。
- 只采集正式生产域名的服务器请求；不记录聊天正文、坐标、邮箱、IP、密钥或用户身份。
- 注册与账号邮箱为管理员专有数据。浏览器不能直接写用量表或伪造统计。
- 第一阶段不采集浏览器高德调用，不宣称已获得套餐剩余额度、留存、去重 AI 使用人数或服务商实际账单。

## Review Focus

- 普通账号、匿名调用、缺失令牌和直接 RPC 调用都不能读取或伪造统计。
- 日期边界、空结果、删除／匿名账号和未来注册时间的计算正确。
- 模型解析失败仍保留已知用量；取消／超时用量未知不显示零；并发请求不串记录。
- 写入失败、after 执行、预览环境和回放重复不会阻断正常请求或污染正式数据。
- 错误刷新、切换范围乱序、手机布局、长期增长后的查询和日志存储有界。

## Task 1：管理员注册增长

Files: 新增 lib/admin/registrations-api.ts、components/admin/UserGrowthPanel.tsx、app/api/admin/users/stats/route.ts；修改 UsersManager.tsx；新增迁移和 SQL/API/UI 测试。

- [x] 写日期边界、权限、缺失 profile、删除及匿名账号排除测试并确认失败。
- [x] 实现 private admin_registration_stats + public invoker，聚合总量、新增和连续时间桶。
- [x] 实现受保护 API 与独立范围／刷新界面，不受邮箱搜索和列表分页影响。
- [x] 运行相关测试、确认通过。

## Task 2：服务器采集和安全存储

Files: 新增 lib/observability/{events,context,recorder,api}.ts；修改两个模型适配器、两个助手入口和公开 places/shops GET；迁移包含 observability_private 表、只写令牌与 RPC；新增单元及 PostgreSQL 权限测试。

- [x] 先写缺失用量、费用上下界、并发隔离、失败／超时、令牌权限和重复事件测试，确认失败。
- [x] 实现白名单事件字段、服务端计时、AI usage 提取、生产域名过滤与 after 批量写入。
- [x] 写入 RPC 仅凭独立随机令牌授权，数据库只保存 SHA-256 摘要；令牌只进入 Vercel server 环境，不添加 service_role 密钥。
- [x] 私有表启用 RLS 且撤销客户端表权限；输入最多 20 条、严格检查字段与值、事件 UUID 幂等；按日清理 45 天前记录。
- [x] 实现仅管理员可读的数据库聚合函数；不读取或返回原始聊天内容。
- [x] 运行相关测试。

## Task 3：用量与运行看板

Files: 新增 lib/admin/usage-api.ts、components/admin/UsageDashboard.tsx、app/api/admin/usage/route.ts；修改 AdminNavigation.tsx、admin/page.tsx；补充 API/UI 测试。

- [x] 写未登录／普通用户拒绝、缺失配置、零与缺失、过期请求和价格覆盖测试，确认失败。
- [x] 展示范围选择、HTTP／AI 调用、成功率、限流、超时、平均及 P95、已知 Token、未知用量条数、费用区间及分功能统计。
- [x] 明确展示采集启用时间、45 天保留期限、只统计已保存事件、公开接口统计范围和实际账单区别。
- [x] 运行相关测试。

## Task 4：验证、发布和记录

- [x] 全套测试、TypeScript、lint、i18n 和生产构建，独立审查修复问题，虚构数据浏览器布局检查。
- [ ] 核对远端项目／迁移／安全基线，安装仅包含本轮内容的迁移。
- [ ] 生成专用随机写入令牌，仅经 stdin 写入 Vercel server 环境，保存并配置对应数据库摘要；不打印或持久化明文。
- [ ] 在独立分支提交、推送、生产暂存验证后再 promote，沿用用户已有直接部署授权；不部署未核实的其他窗口工作；已上线功能以校验过的发布快照保留。
- [ ] 真实角色只读核验与正式接口回归，补充运行、验收、限制和迁移映射记录。

## 执行记录

- 2026-10-22：独立 worktree 已创建，复用原目录 node_modules junction，未复制 .env.local。
- Ruling: 服务器没有 service_role 环境变量，使用只有插入统计能力的独立令牌，避免为统计开放广泛权限。
- Ruling: DeepSeek 官方现行价格存在峰谷及节假日差异，先显示参考区间，不猜测实际扣费或中国节假日计费。

- 发布核对：手动地点功能已于 2026-10-21 从源码快照发布，但没有 Git 提交。本轮发布必须保留 output/releases/20261021-store-stall 中经 SHA-256 校验的 40 个源码／测试／迁移文件；与本轮文件无重叠，不提交这些文件。
- 本机最初使用跨盘 node_modules junction，导致 Next 构建路径错误；已只移除链接并独立 npm ci，无产品依赖变更。
- Next 生产构建发现包装路由的 Request 被推导为可选参数；改为必填，并将两个旧 GET 测试改为传入真实 Request，保持 Next 路由类型要求。
- 费用审查发现 SDK 会把服务商缺失的 usage 字段补成零；已优先使用原始 usage 字段，补充真实 SDK 配合虚构响应的回归测试。
