# 2026-10-20 发布前检查

用户已授权检查通过后提交、推送并部署。本文件记录发布方案；实际部署和迁移完成状态另见发布执行记录，不能仅凭本文件判定已经上线。

## 发布范围

- 评价与事后审核：已有提交 `9f75372`，本次配套启用远端迁移。
- 平台管理工作台、访问与搜索汇总、地点质量与操作记录。
- 公开地点与旧版店铺列表服务端缓存、写入后失效。
- 图片按需挂载、首页移除店铺实时连接并在返回页面时静默更新。
- 对应测试、容量评估工具和开发记录。

当前工作区还有另一个讨论中新增的小程序规划 `docs/product-backlog.md` 和 `docs/wechat-miniapp-roadmap.md`，保留在工作区，不纳入本次发布提交。

## 目标与配置

- 仓库：`Aiden1810/macau-student-map`。
- 推送分支：`codex/admin-place-workflow`，不修改 `main`。
- Vercel：现有 `macau-student-map` 项目，Node.js 24，生产构建。
- 正式域名：`https://www.aiden-macau-map.top`。
- 数据库：现有 Supabase 项目；本地查询和构建测试使用隔离数据。
- 生产环境的 Supabase、地图和 AI 所需变量均已配置，仅检查变量名，不读取或打印密钥；未改动 `.env.local`。

## 检查结果

- 82 个测试文件、509 项测试通过。
- TypeScript、ESLint、三语言 276 个 key 的契约检查通过。
- 最近的隔离正式构建与列表缓存验收通过；使用提交快照在 Vercel 再构建一次并检查后才提升为正式版本。
- 数据库只读基线：49 个地点，其中 5 个已发布；旧版 shops 和评价表均为 0 条。
- 数据库结构与权限快照保存在被 Git 忽略的 `output/release-2026-10-20/schema-before.json`，不包含用户评价内容，也不是完整灾备备份。
- 现有安全检查有 6 个管理 SECURITY DEFINER 函数告警；已确认数据库中均有管理员检查且匿名角色不可执行。本轮不会因告警机械撤销其合法用途。
- 其他既有提示包括未开启泄露密码保护，以及若干启用 RLS 但没有 policy 的旧表；本次不放宽这些表的访问权限，也不升级付费计划。

安全检查参考：[可执行的 SECURITY DEFINER 函数](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)、[密码保护](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)、[RLS 无策略](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)。

## 顺序和回退边界

1. 提交已检查的源码并推送现有功能分支。
2. 从该提交导出发布副本，排除本地环境文件；部署为暂不分配正式域名的生产构建。
3. 检查暂存版本的公开读取、三语言页面、未登录权限拒绝及迁移前升级提示。
4. 提升新应用到正式域名，再安装评价审核和搜索统计权限两项新迁移。
5. 查询迁移历史、角色权限及管理函数，读取正式 API，并对比地点资料指纹。不会用真实店铺发布、删除或审核评价来验收。

评价迁移不回填评分、不修改地点事实，新增字段、权限策略及受保护的评价函数；搜索迁移仅给 authenticated 表级 SELECT，现有管理员 RLS 限制行访问。

已安装的 `20261019081749` 批量状态迁移不会重复执行。迁移 API 可能生成不同的远端版本号，发布执行记录会列明名称与实际版本；不能仅按本地时间戳盲目执行 `db push`。

新应用在迁移尚未安装时保留功能升级提示。迁移安装后旧评价 API 的直接表写入会被禁止，因此不能不检查兼容性就回滚到旧应用，也不会自动撤销数据库迁移。若迁移出现问题，先保留兼容升级提示的新应用并检查失败项。
