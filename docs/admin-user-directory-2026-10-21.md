# 2026-10-21 管理员用户列表与店铺来源

## 当前状态

已完成并上线。数据库迁移已安装，代码已提交并推送；正式地址为 https://www.aiden-macau-map.top/zh-CN/admin 。完整上线信息见文末记录。

## 已实现

- 后台新增“用户管理”：注册账号总数、当前邮箱、账号 ID、角色、注册时间（澳门时间），支持按邮箱或账号 ID 搜索，每页 25 条。
- 注册总数来自 Supabase Auth 的账号记录，不依赖 profiles 是否已补齐；排除已删除账号和匿名登录账号，包含尚未完成邮箱验证的注册账号。它不等于浏览量、去重浏览器数或实际人数。
- “店铺资料”显示创建／提交账号的当前邮箱；账号来源使用 places.created_by。既有审核发布流程将原投稿用户写入该字段，后续管理员编辑不覆盖它。
- “投稿审核”显示原投稿用户的当前邮箱，使用 place_submissions.submitted_by，与 reviewed_by 审核管理员分开。
- 没有创建账号的历史记录显示“来源未记录”。有账号 ID 但邮箱不存在或账号已删除时，显示“邮箱不可用”及原账号 ID；不猜测原邮箱。
- 本版显示最初创建／投稿账号，不代表最后编辑者、所有合并投稿者或每张图片的上传者；不修改已有来源数据。

## 权限与读取方式

新增只读 RPC：

- public.admin_list_users(p_query, p_page, p_page_size)：分页用户列表和精确计数，默认每页 25 条、最大 50 条，查询最长 200 字符。
- public.admin_account_emails(p_user_ids)：按给定账号 ID 批量读取邮箱，每批最多 500 个；地点列表和投稿列表分别只做一次批量查询。

public 函数为 SECURITY INVOKER，调用 private 内的 SECURITY DEFINER 实现。private 实现先检查 auth.uid() 和数据库中当前 profiles.role='admin'，固定空 search_path；匿名角色没有执行权限。普通登录用户即使绕过网页直接调用 public 或 private 函数，也会被拒绝。没有授予客户端 auth.users 表权限，也没有新增 service_role 密钥。

新增 GET /api/admin/users 复用既有 requireAdmin 认证，固定每页 25 条。所有相关后台响应为 Cache-Control: private, no-store；公开地点接口、公共缓存和普通用户投稿接口不加入邮箱。用户列表失败时隐藏旧数据并显示错误，不把失败显示成 0 人。

参考：[Supabase 数据库函数与权限文档](https://supabase.com/docs/guides/database/functions)。已核对 2026-10-21 的 changelog 和相关文档；本次不新增产品依赖。

## 主要文件

| 位置 | 用途 |
| --- | --- |
| components/admin/UsersManager.tsx | 用户列表、搜索、翻页和错误状态 |
| components/admin/AccountAttribution.tsx | 来源账号、未知来源和邮箱不可用提示 |
| components/admin/AdminNavigation.tsx、app/[locale]/admin/page.tsx | 用户管理入口 |
| components/admin/PlacesManager.tsx、SubmissionQueue.tsx | 原有店铺和投稿列表显示邮箱 |
| lib/admin/accounts.ts、users-api.ts、app/api/admin/users/route.ts | 受保护的账号读取、字段筛选和 HTTP 接口 |
| lib/admin/place-data.ts、place-editor.ts、app/api/admin/places/route.ts | 店铺账号关联 |
| lib/api/admin-submissions-route.ts、app/api/admin/submissions/route.ts | 投稿账号关联 |
| supabase/migrations/20261021130159_admin_user_directory.sql | 只读账号函数与权限 |

## 验证与运行

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run i18n:check
```

- 全套测试：89 个文件、548 项通过。新测试覆盖真实 PostgreSQL 权限（PGlite 内存实例）、无 profile 的账号计数、删除／匿名账号排除、字段筛选、分页和批量限制、未知来源、邮箱显示、搜索、失败刷新与旧请求乱序。
- TypeScript、ESLint、三语 277 个 key 检查通过。
- Next.js 15.5.28 生产构建通过；使用独立 output/admin-users-next-build 目录，构建后恢复 Next.js 自动改写的 next-env.d.ts 和 tsconfig.json，不覆盖正在运行的预览。
- 独立只读审查未发现需修复问题；审查者在内存数据库用 5,000 个虚构账号检查了正确计数和 25 条分页。这不是线上容量测试。
- 浏览器使用实际 UsersManager 和 AdminNavigation 组件、虚构账号数据检查 1280×900 与 390×844 布局、翻页及搜索；未使用真实管理员登录或访问真实邮箱。截图位于被 Git 忽略的 output/playwright/admin-users-*.png。
- 线上核对过 Auth 所需列名与类型，以及地点来源记录数量；没有改动真实店铺、投稿或账号，没有向工具输出真实邮箱明细。迁移后在数据库内用真实管理员身份验证只读函数，仅检查计数、字段和权限，不返回账号明细。

数据库迁移安装后，运行 npm.cmd run dev，打开 /zh-CN/admin，使用管理员账号进入“用户管理”“店铺资料”“投稿审核”验证。未安装迁移时，相应读取会明确报错；不能仅更新网页代码。

## 上线顺序与后续

1. 核对目标项目和远端迁移历史，安装新迁移 20261021130159_admin_user_directory.sql，再发布应用；已有迁移不能重复执行。
2. 注意此前迁移在远端的版本号与本地时间戳不同，映射见 docs/release-2026-10-20.md；不要直接批量 db push 旧文件。
3. 迁移安装后执行安全 advisor，并验证管理员可读、普通用户与匿名访问被拒绝；上线后核对网页和接口。

当前店铺／投稿列表分别保留原有 500／200 条加载限制。本版用户列表已经分页；如果以后需要按用户查看全部贡献，可另外增加筛选入口。

原有 docs/product-backlog.md、docs/wechat-miniapp-roadmap.md 和 tmp/ 属于其他窗口工作，本轮保留，不混入提交。发布期间另一窗口开始修改手动地点资料相关文件（包括 lib/admin/place-editor.ts 等），这些后续工作也没有纳入本次发布源码，不回退或覆盖。

## 上线记录

- 用户此前已授权检查通过后直接推送部署，本次沿用该授权；不合并 main，也不覆盖旧版迁移。
- 目标：Supabase mczhcwtlldhbmrgiggjl、Vercel 项目 prj_Hpu3ocNgDefJ7ATF2juPvL45J30l（aiden1810s-projects/macau-student-map）。
- 新迁移已成功安装：本地 20261021130159_admin_user_directory.sql → 远端 20261021131517，名称 admin_user_directory；不要重复执行。
- 迁移后真实 authenticated 角色下管理员读取成功，返回计数与 Auth 当前未删除非匿名注册账号一致；普通用户调用列表、邮箱批量查询及 private 实现被拒绝，匿名调用被拒绝。
- public 两个函数为 invoker，private 两个函数为 definer，四个函数都没有 anon EXECUTE 权限。
- 安装前后地点 53 条、投稿 8 条，完整行指纹分别仍为 f03e46ab5f17fd45966bfadb463e1b0b 和 3d9d07b0e6aa7186d254e281dad512d5，内容未发生变化。
- 安全 advisor 与安装前一致，无新增告警；既有 6 项公开管理 definer、1 项密码保护 WARN 保持原样。参考：[函数权限检查](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)、[密码保护说明](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。
- 发布前正式部署为 dpl_3GfxH4TGjb4zQu3BTHVbuvMuWFzE，已包含“其他菜系”更新；本次基于 1cb7d71 后继续修改，保留这部分代码。
- 发布源码：47e560ac8e7d1fd8b989507f926292bf42382cd6，已推送 codex/admin-place-workflow。
- 新部署：dpl_3eaVPCuMYe45rS2vtkJUVopFzoTf，READY、production；构建地址 https://macau-student-cybsseec0-aiden1810s-projects.vercel.app 。metadata 的 releaseCommit 和 releaseBranch 与上述提交、分支一致。
- 使用该 Git 提交的干净 archive 导出源码，未复制 .env.local。先 --prod --skip-domain 构建暂存，确认正式域名仍指向旧部署；暂存检查通过后 promote，正式域名 inspect 已指向新部署。
- 暂存：简体首页与公开地点接口 200；未登录访问用户管理、店铺管理、投稿审核接口均 401，带 private, no-store；公开地点数据没有 email、createdBy、submitter 字段。
- 正式：三语言首页和后台页面 200；公开地点接口 200、7 条，旧店铺接口 200、0 条；未登录访问用户、店铺、投稿、平台工作台接口均 401、private, no-store。公开接口未暴露新增账号字段。
- 已下载正式后台页面所引用的实际脚本，核对新“用户管理”和“来源未记录”文案存在，避免只验证旧页面 HTTP 200。
- 新部署近 15 分钟、最多 20 条 5xx 日志查询未返回记录；这只是有限时间检查，不代表长期稳定性。
- 未登录真实管理员账号进行网页端邮箱查看或人工写入验收。网页交互使用虚构账号检查；线上管理员读取和权限使用数据库内受控身份验证，没有输出邮箱明细。
- 暂存／正式响应和检查脚本保存于 Git 忽略目录 output/release-admin-users-20261021/；界面预览服务和本次专用浏览器会话已关闭。
