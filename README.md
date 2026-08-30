# CityU Local Life Map

面向澳门高校学生的本地生活平台 MVP。公开用户可以浏览地图、搜索和筛选地点；登录用户可以投稿、上传图片、收藏和评价；管理员可以批准新地点、合并重复地点、驳回投稿并查看搜索缺口。

## 当前产品边界

- 支持美食、购物、娱乐、生活服务四类地点。
- 投稿与公开地点分离：`draft → pending → approved / rejected / merged`。
- 搜索支持名称、规范标签、中英/简繁别名和诚实的零结果。
- 同组筛选为 OR，不同筛选维度为 AND；查询与顶部筛选写入 URL。
- 一名用户对一个地点最多一条评价；评分榜采用置信度规则，少量五星不会直接“封神”。
- 现有 `shops` 数据保留，应用采用规范 `places` + 旧表兼容双读。

本版本不包含支付、外卖配送、商家结算或广告竞价。这些能力涉及许可证、风控、履约和财务系统，不属于首个可上线 MVP。

## Windows 本地运行

要求 Node.js 20+。数据库本地重建还要求 Docker Desktop。

```powershell
Copy-Item .env.example .env.local
npm ci
npm run doctor
npm test
npm run i18n:check
npm run dev
```

打开 `http://localhost:3000`。`.env.local` 只填写 publishable/anon key；不要把 `service_role` 密钥放入任何 `NEXT_PUBLIC_*` 变量。

## 数据库初始化

```powershell
npx supabase start
npx supabase db reset --local
npx supabase test db --local
```

迁移、RLS、Storage 和生产推送步骤见 [数据库迁移手册](docs/database-migration-runbook.md)。生产环境不能运行远程 reset，也不能把 `supabase/seed.sql` 的演示数据推入生产。

## 质量检查

```powershell
npm test
npm run lint
npm run i18n:check
npm audit --omit=dev --audit-level=high
npm run build
```

数据库测试需要 Docker Desktop；没有 Docker 时仍可运行 TypeScript 单元测试、lint 和生产构建，但不能声称 pgTAP 已在真实 PostgreSQL 上执行。

## 上线顺序

1. 备份生产 Supabase 数据库和 Storage 清单。
2. 在 staging 项目执行 migration dry-run、迁移和 pgTAP。
3. 创建 `submission-media` 私有桶及 `place-media` 公开桶，限制 JPEG/PNG/WebP、单图 10 MiB。
4. 配置 Vercel 环境变量和 Supabase Auth redirect URL。
5. 在 staging 完成注册、搜索、投稿、上传、重复确认、审核、评价全流程验收。
6. 再把同一迁移推送生产，最后部署 Web 应用。

GitHub Actions 会执行依赖安装、lint、单元测试、翻译键检查、安全审计和生产构建；只有 `main` 分支 push 才进入 Vercel 部署任务。

## 回滚

应用兼容旧 `shops` 表。若规范模型上线后出现问题，先回滚 Web 部署到上一版本并停止新的审核操作，再按备份恢复数据库。不要手工删除 Storage 元数据；对象清理由 Storage API 完成并核对 `place_media` 记录。
