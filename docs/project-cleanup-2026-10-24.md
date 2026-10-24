# 项目清理记录（2026-10-24）

## 源码与依赖

使用 TypeScript 模块解析检查全部已跟踪的源码和测试引用，再用全文搜索核对组件名称、导出类型及动态引用，移除以下没有调用方的旧模块：

- `components/LanguageSwitcher.tsx`：旧版语言选择组件。
- `components/MobileShopDetailModal.tsx`：旧版移动端详情弹窗。
- `components/ShopSearch.tsx`：旧版 POI 搜索组件，含已停用的 Mapbox 坐标字段。
- `data/shops.ts`：旧版静态筛选项。
- `lib/submissions/local.ts`：旧版本地投稿记录工具。

同时移除 `types/shop.ts` 中只被旧筛选项使用的 `FilterOption`，以及只被旧搜索组件使用的 `gcoord` dependency（依赖）；同步更新 `package-lock.json`，保留其余依赖版本。

现有测试、数据库迁移、历史 SQL、规划文档及数据来源记录继续保留。不能仅凭文件较旧或没有 TypeScript import，就认定这些内容无用。

## 本地生成文件

22 处构建产物、临时浏览器资料和重复工具依赖共计 **5,297,135,097 字节**（约 5.30 GB / 4.93 GiB），已移出项目：

- 根目录 `.next`、`.playwright-cli`、空 `.worktrees`、`tsconfig.tsbuildinfo`。
- `output` 下 4 个旧验证构建目录、10 个隔离验证副本中的 `.next`。
- 视频工程和临时 POI 工具各自的 `node_modules`。
- `tmp/promo-chrome`、`tmp/video-chrome` 两个临时浏览器资料目录。

自动审批拦截了递归删除操作，改为可恢复迁移。恢复目录为 `D:\项目\CityU_Food-cleanup-recovery-20261024`，其中 `restore-manifest.json` 记录每个原路径、恢复路径和字节数。这次迁移整理了项目目录，**没有释放磁盘空间**。

路演 PPT、视频、讲稿、素材及制作源文件，交接包，设计参考，验收截图，发布清单，数据库结构快照均保留。项目根目录的 `node_modules`、`.env.local`、`.vercel` 也保留。

再次执行 `npm run dev` / `npm run build` 会重新生成 `.next`，这是正常行为。若要继续制作视频，可在 `output/chengmi-demo-video` 中执行 `npm ci` 恢复该子工程依赖。

## Git 与 GitHub

清理分支为 `codex/project-cleanup`。默认分支 `main` 的推送会触发正式部署，因此源码清理通过 PR 提交。

核对每个分支头均为 `main` 的祖先后，清理以下远端旧分支，保留提交历史与已合并 PR：

- `codex/admin-place-workflow`
- `codex/fix-place-favorites-consistency`（PR #2）
- `codex/onboarding-local-setup`（PR #1）
- `codex/ui-polish`

本地已合入的 `codex/admin-place-workflow`、`codex/ui-polish`、`pr-2` 同步清理。保留 `codex/admin-usage-dashboard`：它不满足直接祖先关系，虽 `git cherry` 显示补丁已有等价提交，本轮不强制删除。

检查时 GitHub 没有开放 PR、Release 或 Actions artifact（构建附件）。保留仍供 `main` 使用的 npm 安装缓存和 Actions 运行记录。

## 运行与验证

在项目根目录使用 Windows PowerShell：

```powershell
npm test
npx tsc --noEmit --incremental false
npm run lint
npm run i18n:check
npm run build
npm run dev
```

页面地址见开发服务终端，通常为 `http://localhost:3000/zh-CN`。本轮未新增依赖，也未操作远端数据库。

本轮已通过 ESLint、TypeScript、三语言 287 个文案 key 检查和 production build（生产构建）。独立只读审查未发现遗漏调用方或无关依赖变更。

首次并发验证时全量测试通过 665/666 项，容量夹具的子进程在 7 秒上限内未完成；该项单独复测通过。保留原断言和超时配置，随后使用单个 worker 重新执行全量测试，以减少资源竞争。

最终 `npm test -- --maxWorkers=1`：**105 个测试文件、666 项测试全部通过**，退出码为 0。普通开发仍可运行默认的 `npm test`；若再次遇到容量夹具超时，应先排查机器负载和该夹具的初始化耗时，不应仅放宽断言。
