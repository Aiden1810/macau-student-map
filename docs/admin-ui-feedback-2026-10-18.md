# 后台界面与站内反馈

## 本轮范围

- 后台：总览、店铺资料、投稿审核、用户反馈、更多工具；常用入口不再混在长页面中。
- 总览：管理快捷入口、页面浏览、去重浏览器、趋势、热门页面。
- 联系我们：首页“我的”菜单进入；支持使用问题、店铺纠错、投诉、建议。
- 登录后提交到管理员后台，确认保存成功才显示反馈编号；失败保留内容，超时重试沿用同一编号。
- 管理员查看、按待处理／已处理筛选、分页、标记处理或重新打开。
- 批量上线／下线只记录在 `docs/product-backlog.md`，本轮没有实现。

## 主要文件

- `app/[locale]/admin/page.tsx`、`components/admin/AdminNavigation.tsx`、`AdminQuickLinks.tsx`、`TrafficOverview.tsx`：后台布局与总览。
- `components/admin/PlacesManager.tsx`、`SubmissionQueue.tsx`：状态统计、入口适配，原有编辑与审核流程保留。
- `components/Header.tsx`、`app/[locale]/contact/page.tsx`、`components/ContactForm.tsx`：联系入口和反馈表单。
- `components/admin/FeedbackInbox.tsx`：管理员反馈收件箱。
- `lib/admin/traffic.ts`：按澳门时间和真实日期统计，排除后台、登录页。
- `lib/contact/*`、`lib/api/feedback-routes.ts`、`app/api/feedback/route.ts`、`app/api/admin/feedback/*`：校验、鉴权、存储、幂等重试。
- `supabase/migrations/20261018153506_user_feedback_inbox.sql`：独立反馈表、RLS（行级权限）和列权限，不修改店铺。文件版本与远程实际迁移记录一致。
- `supabase/tests/manual/user_feedback_inbox.rollback.sql`：真实角色权限验收；全部测试写入在事务末尾回滚。
- `vitest.config.mts`：为 React 渲染测试使用与 Next 一致的 JSX 模式，未增加依赖。

## 验收方式

1. 本地地址：`http://localhost:56544/zh-CN`；“我的 → 联系我们”。
2. 未登录时显示登录入口，提交按钮禁用；登录在新页面进行，原表单留在当前页面。
3. 登录后填写至少 10 字；提交成功后保留反馈编号。网络失败时不得显示成功，可重试。
4. 管理员登录后进入 `/zh-CN/admin` 的“用户反馈”，按编号核对内容，标记已处理，再切到已处理查看。
5. 后台在 24 小时／7 天／30 天间切换；空数据和读取失败应显示不同状态。

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run i18n:check
npm run build
```

修改后必须重新构建、停止已核对的本项目 56544 预览进程，再运行 `npm run start -- --port 56544`。不要结束其他项目进程。

## 统计口径与限制

- 浏览器标识不是实际人数。同一人换设备、清理存储、无痕模式会重复统计。
- 24 小时为滚动窗口；7 天／30 天为澳门自然日（含今天）。
- 读取失败显示不可用；查询受返回行数限制时明确提示记录可能不完整。
- 新地点概况基于已加载资料（最多 500 条），不把历史店铺和新地点相加冒充总数。
- MVP 不提供附件、站内回复或工单系统；如希望管理员回复，可选填联系方法。没有承诺处理时限。
- 自动测试包含 API 权限、参数伪造、重复提交、冲突及失败状态；真实管理员浏览器收发仍需已登录账号验收。

## 数据库与发布状态

- 项目所有者已明确授权“允许新增反馈表并验证”。已在项目 `mczhcwtlldhbmrgiggjl` 执行 `user_feedback_inbox`，迁移版本 `20261018153506`。
- 真实数据库权限验收通过：本人可提交及读取、其他用户不可读取、普通用户不能修改状态或伪造身份／受保护字段、管理员可读取／处理／重新打开、未登录访客不可读取或提交。
- 测试反馈全部回滚，最终反馈表 0 条；地点总数执行前后均为 49，历史 shops 表均为 0。
- 安全检查未报告新增反馈表问题；项目已有管理 RPC、旧表 RLS 和密码保护提示仍保留，未在本轮扩展修改。可参考 [Supabase 数据库检查说明](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) 和 [密码保护说明](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。
- `npm test` 364 项通过；lint、TypeScript、i18n 校验、生产构建通过。三个本地反馈接口在未登录时均返回 401，并设置 private/no-store。
- 手机浏览器检查：320、390 宽度无横向溢出，分类、字数、空内容校验、复制、编辑后清除旧提示、首页菜单跳转正常；未伪造管理员登录或注入假反馈。
- 当前浏览器未登录管理员；真实登录后的表单提交、按编号在后台核对与处理，仍需使用管理员账号验收。后台独立界面演示使用明确标注的空数据，不冒充运营数据。
- 本地预览已重建并重启，端口 56544。未部署本轮更改，未提交或推送 Git。

## 界面证据

- `output/admin-feedback-verification-2026-10-18/contact-mobile.png`：实际用户反馈页面。
- `output/admin-feedback-verification-2026-10-18/admin-overview-desktop.png`、`admin-overview-mobile.png`：从本轮 React 组件渲染的独立空数据布局演示；页面已明确标注不是实际运营数据。
- 后台五个入口在 320 宽度下无横向溢出，文字不换行；临时演示服务已停止，仅保留截图和 HTML。

## 后续发布

用户随后授权上线，以上功能现已发布到正式域名。部署身份、验证结果和回退方式见 [本次正式发布记录](production-release-2026-10-18-admin-feedback.md)；前文“未部署”描述保留为当时本地验收阶段的记录。
