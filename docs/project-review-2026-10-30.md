# 项目检查与修复记录（2026-10-30）

> 后续集成更新：地点统一任务已完成并通过最终 693 项测试；用户现已授权上线，本报告内修复纳入集成发布，媒体权限迁移已应用。下面保留本轮完成时的历史边界，当前发布状态见 [2026-10-30 发布记录](production-release-2026-10-30.md)。

## 范围与执行计划

目标：在现有 Next.js / Supabase 结构上修复有证据的功能和安全问题，不增加新业务功能或依赖。

1. 检查项目和运行基线，保留已有未提交的规划文档。
2. 针对上传/提交竞争、账号切换、地图加载与搜索异常、请求体大小限制、媒体权限边界，先写失败回归测试，再做最小修改。
3. 复查差异，运行全套测试、类型检查、lint、翻译检查及生产构建，并在浏览器检查公开页面。
4. 分别记录本地通过与尚未验证的外部服务；数据库 migration 迁移仅写入仓库，不直接应用到远端。

## 修改前基线

- Node.js 24.14.1。
- `npm test`：106 个测试文件、667 个测试通过。
- `npx tsc --noEmit`、`npm run lint`、`npm run i18n:check` 通过。
- `npm run doctor`：15 项通过，只确认配置存在和格式，不证明密钥有效。
- 本地浏览器首页能显示地图及 10 个地点。

## 确认的问题与修复

| 问题 | 原来的影响 | 本轮处理 |
| --- | --- | --- |
| 地图聚合数据格式错误 | “全部”分类有列表，却没有普通地图点位 | 按高德 JS API 2.0 传入含 `lnglat` 的数据，通过 `renderMarker` 设置样式、点击及悬停事件 |
| SDK 加载失败被永久记住 | 网络恢复后重新搜索仍拿到同一个失败 Promise | 地图和地点搜索共用加载器；失败/超时清理脚本、监听器及缓存，允许后续调用重试 |
| 地点搜索没有超时 | SDK 不回调时界面一直显示搜索中 | 12 秒后结束等待，成功或失败时清理计时器，忽略过期回调 |
| 选中地点早于地图加载完成 | 慢网下点击“查看位置”后没有标记，也不移动地图 | 选中效果同时依赖 `mapReady`，加载完成后补上定位 |
| 投稿操作存在竞争 | 图片上传时提交/取消，可能重复建草稿、产生版本冲突或上传失败 | 图片处理、提交和草稿删除互斥；提交期间禁用编辑；顶部投稿入口也不能中断进行中的操作 |
| “我的投稿”没有响应换号 | 页面保留旧账号的投稿、审核备注；旧请求可能覆盖新账号结果 | 监听账号变化，立即清空旧内容，中止旧请求并忽略迟到响应 |
| 请求大小检查太晚 | 无 `Content-Length` 或声明失实时，完整读入大请求后才返回 413 | 按流累计真实字节，超限即取消读取；保持分块中文 UTF-8 正确解码，读流失败返回受控错误 |
| 投稿媒体的数据库限制不完整 | 可以绕过界面，改挂图片到其他稿件、修改文件身份，或在提交后替换/删除文件 | 新迁移收紧元数据与 Storage 写入到本人草稿，固定附件身份；转移服务另行验证投稿者和私有路径，拒绝转移或删除身份不符的历史附件 |

高德接口依据：[官方 MarkerCluster 参考](https://lbs.amap.com/api/maps-javascript-api/reference/amap-marker/markercluster)、[JS API 2.0 点聚合教程](https://lbs.amap.com/api/javascript-api-v2/guide/amap-massmarker/marker-cluster)。单点样式和点击还通过本地真实 SDK 页面验证。

## 修改文件

业务代码沿用原来的“界面 → API → 服务 → 数据库权限”结构：

- `app/[locale]/page.tsx`：顶部投稿入口的进行中保护。
- `app/[locale]/my-submissions/page.tsx`：账号隔离和旧请求保护。
- `components/ContributionForm.tsx`：表单操作互锁，通知父页面当前忙碌状态。
- `components/MapPlaceholder.tsx`：正确的聚合数据、共用加载器、延迟选中处理。
- `lib/amap/place-search.ts`：SDK 失败恢复、加载和搜索超时。
- `lib/api/request.ts`：有字节上限的 JSON 流读取。
- `lib/services/media.ts`：发布图片前核对投稿者和对象路径。
- `supabase/migrations/20261029162434_harden_submission_media_permissions.sql`：媒体元数据和文件权限；文件名由 Supabase CLI 根据系统 UTC 时间生成。

新增或扩展回归测试：

- `tests/components/contribution-concurrency.test.tsx`
- `tests/components/my-submissions-account.test.tsx`
- `tests/components/map-delayed-selection.test.tsx`
- `tests/lib/amap/sdk-recovery.test.ts`
- `tests/lib/storage/submission-media-permissions.test.ts`
- `tests/lib/api/request.test.ts`
- `tests/lib/services/media-transfer.test.ts`
- `tests/lib/data/discovery-page-refresh.test.tsx`

没有增加第三方库。原有 `docs/product-backlog.md`、`docs/wechat-miniapp-roadmap.md` 和微信小程序计划的未提交内容没有改动。

## 运行与复核

在项目根目录使用 Windows PowerShell：

```powershell
npm run dev
```

打开 `http://localhost:3000/zh-CN`；若 3000 已占用，按终端实际端口访问。依赖和配置沿用已有环境。

```powershell
npm test
npx tsc --noEmit --incremental false
npm run lint
npm run i18n:check
npm run build
```

开发服务运行时，本轮通过 `$env:CITYU_BUILD_DIR = 'output/review-build'` 将构建放进独立的、被 Git 忽略的目录；构建自动改写的 TypeScript 配置会恢复，不作为业务修改提交。普通复核应先停止开发服务，再执行 `npm run build`。

手工重点检查：

1. 首页能显示聚合点；点击列表“查看位置”能定位，点击普通标记能切换选中店铺。
2. 搜索“牛肉面”能得到相应地点，清空后恢复完整列表。
3. 用独立测试账号，在慢网下上传图片；压缩、上传、提交期间无法重复提交或取消，失败后可重试。
4. 在“我的投稿”停留时从另一标签页退出或换号，应清除前一个账号内容。

## 验证边界与下一步

- 本轮修复快照的 `npm test`：111 个测试文件、706 个测试通过（修改前 667 个，新增 39 个回归用例）；`npm run lint`、`npm run i18n:check` 和生产构建通过，构建也完成了类型检查。详细日志保存在被 Git 忽略的 `output/review-final-*.log`。
- 随后检测到另一聊天“制定微信小程序迁移计划”正在同一目录执行地点数据统一（见 `docs/superpowers/plans/2026-10-30-unify-place-data.md`），并以本轮 706 个通过用例为基线。额外 `tsc` 先遇到新测试与 `loadShopDetail` 签名未对齐；之后该链路继续改动，最新一次检查在改写中的首页遇到 `pageNotice` / `setPageNotice` 未定义，共六个 TS2304 错误（`output/review-concurrent-types.log`）。本轮没有覆盖或撤销这些并行改动，不能把修复快照的通过结果视为当前不断变化工作区的最终验收；最终检查由数据统一任务收尾。
- 浏览器已验证公开数据读取、搜索、聚合标记和选中联动。账号切换、慢网竞争、SDK 异常通过本地模拟测试验证，没有通过真实账号写入去验证。
- 权限测试使用独立 PGlite PostgreSQL 数据库和真实策略 SQL，覆盖正常草稿操作、越权修改、提交后的冻结及管理员清理；没有运行 Docker Supabase 的完整 Storage HTTP 集成测试。
- 新 migration **尚未应用到远端数据库**。线上权限缺口要在核对迁移顺序、备份和独立环境验证后应用迁移才会关闭。本轮没有发布线上应用、修改远端数据库或调用付费 AI 模型。
- 原有测试会输出部分预期的错误分支日志，以及 DeepSeek JSON schema 兼容模式警告；这些不能等同于真实 AI 接口验收。
- 并行审查完成了主要问题定位；最终独立复查代理因额度限制未完成，主代理接手差异复查与最终本地验证。
- 后续优先事项：完成正在进行的 `shops` / `places` 数据统一后重跑整体检查；补充真实账号和完整上传审核的端到端测试；核对店名标为“暂停营业”的现有条目；再考虑将较大的首页按职责拆分。
- 桌面和移动端目前各自挂载投稿表单，跨断点改变窗口大小时表单状态仍相互独立。应在后续小范围任务中合并为单一表单实例并验证切屏保留草稿；本轮保留了原布局。
- 检查期间出现的 `supabase/migrations/20261029163254_retire_legacy_place_paths.sql` 属于上述数据统一工作，不是本轮生成的修复迁移，未修改、未删除、未纳入本轮交付。
