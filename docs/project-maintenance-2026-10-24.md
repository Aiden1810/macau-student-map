# 依赖安全维护与发布（2026-10-24）

用户已授权修复清理复核发现的问题、合并 PR #3 并发布正式站点。本轮沿用现有 Next.js、Tailwind 3 和 GitHub Actions → Vercel 部署结构。

## 修复范围

- Zod 从 4.4.3 更新到 4.6.7，处理 GHSA-mrhx-c7xc-m3w5。
- Vitest 精确更新到 4.1.12，包含修复后的 `@vitest/mocker`。
- 在现有 dependency 范围内更新 Vite、`@humanfs/node`、两个版本分支的 `brace-expansion` 及相关依赖。
- 通过 npm override 固定 `postcss-selector-parser@7.1.6`，处理 GHSA-rj75-hqrm-r3gf。Tailwind 3 和 postcss-nested 原来依赖 parser 6；直接运行强制审计修复会迁移到 Tailwind 4，影响现有样式结构，因此采用范围更小的解析器覆盖。
- 新增 `tests/scripts/tailwind-selector-compat.test.ts`，实际运行 PostCSS + Tailwind，验证任意颜色、hover、group、响应式和任意选择器变体仍生成预期 CSS。
- CI 审计全部依赖并以 `low` 阈值阻止任何等级的已知告警；保留普通 `npm test` 的默认执行方式。
- `actions/checkout`、`actions/setup-node` 使用 Node 24 的 v6，并固定为已核对的提交 SHA；Ubuntu 固定为 24.04，避免 `ubuntu-latest` 镜像切换。
- GitHub token 权限收紧为 `contents: read`；Vercel token 只传给需要认证的步骤，通过环境变量读取，不再作为命令行参数传递。

完整 npm 审计目前为 0 项已知漏洞。审计只覆盖其数据库已收录的依赖问题，不能证明业务代码没有未知安全缺陷。

## 本地运行与验证

已有 `.env.local` 保留；新拉取的工作区使用 Node 24：

```powershell
npm ci
npm audit --audit-level=low
npm test -- --maxWorkers=1
npm run i18n:check
npm run build
npm run dev
```

新增兼容性测试已单独通过；依赖更新后全量本地测试为 106 个文件、667 项测试通过。生产构建（包含 lint 和 TypeScript 检查）、三语言 287 个 key 契约和 `git diff --check` 均通过；复核后补强的嵌套样式与响应式断言也已单独复测通过。

## 合并与发布顺序

1. PR #3 的最新提交通过 GitHub CI 和 Vercel preview 检查。
2. 合并到 `main`，核对合并提交。
3. 等待主分支 CI 和正式部署任务结束，确认正式域名关联的是本次主分支版本。
4. 检查浏览器地图与列表、搜索、详情、多语言入口，以及公开读取接口、匿名访问权限拒绝和运行日志。

发布过程不运行远端数据库 reset 或 migration，不向生产环境写入测试店铺、评价或投稿。账号写入流程仅靠本轮匿名检查无法完整验证，需使用独立测试账号与数据。

## 本地生成文件的剩余限制

约 5.30 GB 的旧生成文件已移到 `D:\项目\CityU_Food-cleanup-recovery-20261024`。在用户再次明确授权清理后，永久删除命令仍被自动审批拦截；工具只返回 `blocked by policy`，未提供具体原因，因此继续保留恢复目录。不能把移出项目描述为已释放磁盘空间，也不能改用另一种删除手段绕过拦截。

两个空源码目录暂留。路演素材、源文件、交接包、迁移和历史数据继续保留。
