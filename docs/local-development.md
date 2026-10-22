# 城觅 Chengmi：新成员本地启动与验证

仓库为 `Aiden1810/macau-student-map`，也称 CityU_Food。先跑通本地环境，再小步修改。下面默认使用 Windows PowerShell；运行命令时应位于有 `package.json` 的仓库根目录。

## 1. 先确认版本与工作区

已有仓库先检查，不要重新克隆覆盖，不要丢弃未提交修改：

```powershell
Get-Location
git status --short --branch
git branch --show-current
git remote -v
git fetch origin
git branch -avv
git log -8 --oneline --decorate
```

先阅读适用的 `AGENTS.md`。`git fetch` 更新远端引用，不会切换当前分支或覆盖工作区；切分支前仍需确认本地修改与负责人分工。

首次克隆使用：

```powershell
git clone https://github.com/Aiden1810/macau-student-map.git
Set-Location macau-student-map
git branch -avv
git log -8 --oneline --decorate
```

2026-10-22 首次熟悉时，`origin/main` 与 `origin/codex/ui-polish` 都指向 `c81c478`；后续执行本任务时，main 已前进至 `d875d41`，本分支已同步其 Node 运行时和 CI 更新。这些是检查快照，不是长期约定；以后应重新核实，不能默认 main 永远最新，也不要为复现交接说明直接退回历史提交。

确认负责人指定的最新基础分支后，建立自己的 `codex/` 分支。下面只适用于负责人仍指定 `codex/ui-polish`、工作区干净且本地分支名尚未使用的情况：

```powershell
git switch -c codex/my-local-task origin/codex/ui-polish
```

不要随意推送 main；`.github/workflows/ci-deploy.yml` 对 main 的推送包含正式部署。发布文档可能记录组合快照，不能据此推断当前源码与线上完全一致。

## 2. 安装锁定依赖

```powershell
node --version
npm --version
```

当前项目通过 `.nvmrc` 和 `package.json` 声明团队运行版本为 Node.js 24.x，本轮实际验证版本为 24.19.0。按该约定安装，不要把“24 上验证通过”解释成所有依赖的最低要求都为 24。

依赖声明应单独核实：当前锁文件中的 `ai@7.0.143` 和 `@ai-sdk/deepseek@3.0.67` 要求 Node >=22，`jsdom@29.1.1` 支持的版本范围为 `^20.19.0 || ^22.13.0 || >=24.0.0`。因此 Node 20 不满足完整依赖集；仅据这些声明也不能保证整个项目在 Node 22 上通过。负责人已在 main 将 CI 和 doctor 对齐 Node 24，本任务保留该更新，不升级依赖或改动部署流程。

干净的新克隆使用：

```powershell
npm ci
```

`npm ci` 按 `package-lock.json` 安装，会替换已有 `node_modules`。已有环境先确认依赖和本地改动，不要为了处理安装错误擅自升级包或删除锁文件。

## 3. 创建配置，保留已有文件

```powershell
if (-not (Test-Path .env.local)) {
  Copy-Item .env.example .env.local
}
```

打开本地 `.env.local`，将示例占位值替换为负责人认可的独立开发环境配置。复制模板不代表配置完成。已有文件不要覆盖，也不要把内容贴到日志、截图或 Git。

| 变量 | 用途与缺失影响 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 开发 Supabase 地址；与下面的 key 一起用于地点、登录、收藏、评价和投稿等功能。缺失时当前首页会抛错。 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 对应项目的公开匿名／publishable key；不能使用 service_role key 替代。 |
| `NEXT_PUBLIC_AMAP_WEB_KEY` | 高德 JS SDK key；缺失时不能验证地图、POI 搜索和真实路线。需符合高德控制台的开发来源限制。 |
| `NEXT_PUBLIC_AMAP_SECURITY_CODE` | 仅当高德控制台要求安全密钥时配置。 |
| `DEEPSEEK_API_KEY` | 仅服务端使用；缺失时 AI 接口返回未配置，无法验证真实模型识别。不要添加 NEXT_PUBLIC_ 前缀。 |
| `DEEPSEEK_MODEL` | 可选，当前代码默认 deepseek-flash；模型可用性须在实际配置的服务中确认。 |

`NEXT_PUBLIC_` 变量会进入浏览器代码。环境文件已被 Git 忽略；不要使用 `git add -f` 提交它。只报告变量“已配置／缺失／仍为占位值”，不要输出值。修改配置后重启开发服务。

普通本地熟悉不需要生产用量采集令牌 `API_USAGE_INGEST_TOKEN`。没有独立数据库、账号或服务配置时，记录阻塞范围，不能用生产写入或付费批量调用补验收。

## 4. 执行检查，再启动页面

依次执行并分别记录退出结果；前一项失败时，不要把后续成功当作全部通过：

```powershell
npm run doctor
npm test
npx tsc --noEmit
npm run lint
npm run i18n:check
npm run build
npm run dev
```

访问 `http://localhost:3000/zh-CN`。检查终端实际端口；若 3000 已被占用，Next.js 可能改用其他端口，不要误验另一个正在运行的服务。验证完成后在终端按 Ctrl+C 停止。

| 检查 | 能证明什么，不能证明什么 |
| --- | --- |
| `doctor` | 检查部分文件、配置存在与格式；拒绝模板中的占位值及 YOUR_... 形式的 key，接受云端和本地回环 Supabase 地址，单独报告 DeepSeek 是否填写；不连接外部服务，也不验证 key 的有效性。AI key 留空不会阻断基础检查。 |
| `npm test` | 包含模拟接口／模型响应和独立 PGlite 数据库测试；通过不代表真实服务或整条账号写入流程通过。一个容量夹具测试需要临时监听 127.0.0.1 端口。 |
| 类型、lint、翻译契约 | 检查类型、代码规范和文案 key 对齐；不检查译文质量或外部服务。 |
| `npm run build` | 验证可构建；动态首页仍可能在首次访问时因配置缺失失败。 |
| 浏览器访问 | 需确认实际界面能显示、数据能读取；HTTP 200 本身也不能证明全部交互正常。 |

开发服务运行时不要同时向同一个 `.next` 目录构建；先停止服务再构建，避免产物互相干扰。

常见现象：

- 终端提示找不到 node/npm：先安装或启用团队认可的 Node 版本，再打开终端核对 PATH。
- 首页 500 或浏览器显示客户端异常，日志出现 `Missing Supabase env vars`：缺少 Supabase 配置，不能据此判断业务逻辑错误。
- `/api/assistant` GET 返回 `available: false`：未配置 DeepSeek；这只是可用性检查，不会发起模型请求。
- `doctor` 全通过但列表、地图不可用：检查是否使用了实际开发配置，并核对独立服务配置、权限和浏览器错误；格式通过不等于服务授权或连通性通过，不要公开密钥。
- 测试因 EPERM 无法监听端口：先确认执行环境是否限制本机监听，记录环境限制，再在允许的本地环境重跑，不要直接修改断言。

## 5. 数据库测试边界

`npm test` 中的 PGlite 测试创建独立的进程内数据库。本轮已核对相关测试实现后执行；没有连接远端数据库。

`supabase/tests/` 的 CLI 数据库测试是另一层验证，需要 Docker 和独立本地 Supabase。开始前必须确认目标、端口、环境变量和已有本地数据；当前任务若没有批准初始化／重置本地数据库，先记录未验证。不要把 README 中的 `db reset --local` 当作普通启动步骤，它会删除并重建目标本地数据库。不要运行远端迁移、远端重置或操作生产数据。

## 6. 读代码的顺序

先理解“界面 → API → 业务与权限 → 数据库”，再读细节：

| 流程 | 入口与下一层 |
| --- | --- |
| 首页地图、搜索 | `app/[locale]/page.tsx` → `components/MapPlaceholder.tsx`、`components/ShopList.tsx` → `lib/search/`、`lib/services/search-places.ts`。 |
| 地点读取与兼容 | `/api/shops`、`/api/places` → `lib/data/public-legacy-shops.ts`、`public-places.ts` → 两种 mapper → `lib/data/canonical-places.ts`。 |
| AI 对话、选店、路线 | `components/assistant/usePlaceChat.ts` → `/api/assistant/chat` → `lib/api/place-chat-route.ts`、`lib/assistant/chat-model.ts`；浏览器经 `lib/amap/route-comparison.ts` 查询路线，`lib/assistant/decision.ts` 计算推荐。旧 `/api/assistant` POST 仍保留。 |
| 投稿与审核 | `components/ContributionForm.tsx` → `/api/submissions`、`/[id]/submit`；`components/admin/SubmissionQueue.tsx` → `/api/admin/submissions` → 权限检查和数据库审核函数。 |
| 评价、收藏 | `components/reviews/`、`lib/hooks/useFavorites.ts` → 对应 API／Supabase，并受数据库权限限制。 |

新旧地点数据都转换为界面使用的 `Shop`。当前合并逻辑按相同 ID 去重，保留旧展示字段，首次发布时间、位置说明、评分、评价数与推荐标签取自新模型；并非所有字段都由新模型覆盖。收藏关联与旧店删除副本的迁移要求见[一致性修复说明](place-consistency-migration.md)。AI 目录读取的是最多 200 个已发布 `places`，不能默认它与首页的新旧合并列表完全相同。首页可在背景筛选时保留桌面 AI 浮窗，但筛选结果没有直接作为聊天候选列表传入。

AI 解析需求，数据库提供已发布店铺事实，高德提供路线；不要把模型输出当作价格或交通耗时的事实来源。详见 [AI 助手接入说明](place-assistant-setup.md)。

每次交付分别写清“代码存在”“本地验证通过”“线上已验证”，附本轮版本、命令和限制。规划文件、历史截图、旧测试计数与发布记录都只能作为背景。
