# 城觅 P1 复核与隔离验收

审查基线为 `46461b8f3060607e0486d341ba307538e9777335`。分支上的持久化保护保持关闭。没有访问生产数据库或发起真实高德请求。

## POI 数据许可

- 技术上可以按 POI ID 查询并建立 UUID 映射。搜索文档描述接口能力和 200 条上限。 [高德 POI 搜索 2.0](https://lbs.amap.com/api/webservice/guide/api-advanced/newpoisearch)
- 公开协议第 3.5 节允许通过官方开放功能展示服务结果，第 4.12、7.3 节限制数据存储、缓存和超范围使用。公开文档未确认城觅可长期保存 POI ID、保留旧 ID 或将它们与收藏和推荐关联。开通 API 或拿到配额不能单独证明此项授权。 [开放平台服务协议](https://lbs.amap.com/pages/terms/) · [技术服务使用许可](https://lbs.amap.com/pages/authorization/)
- 正式启用前，需要确认授权覆盖应用和环境、POI ID 和换号别名、收藏及推荐关联用途、保留期限，以及续期或撤销时的处理。确认后才配置 `AMAP_ALLOW_POI_ID_PERSISTENCE=true`，维护人员手动调用关联 RPC 也遵循同一条件。
- 授权未明确时继续即时查询，收藏和推荐可关联城觅自有商家 UUID。另一个可评估的方案是采用明确授予持久化权利的数据源。将高德 ID 散列或加密仍涉及持久关联，本次保持原业务模型。

## 新建本地隔离 Supabase

需要 Docker 或 Podman 和空闲的本地默认端口。在仓库根目录运行以下 PowerShell 命令。临时目录中的空 `shops` 基线补齐旧迁移的前置条件。线上迁移文件保持原样。

```powershell
$fixtureRoot = Join-Path $env:TEMP ("chengmi-p1-" + [guid]::NewGuid().ToString("N"))
$fixtureSupabase = Join-Path $fixtureRoot "supabase"
$fixtureMigrations = Join-Path $fixtureSupabase "migrations"
New-Item -ItemType Directory -Path $fixtureMigrations | Out-Null
(Get-Content -Raw supabase/config.toml).Replace('project_id = "CityU_Food"', 'project_id = "chengmi-p1-acceptance"') |
  Set-Content -Encoding utf8 (Join-Path $fixtureSupabase "config.toml")
Copy-Item supabase/seed.sql $fixtureSupabase
Copy-Item supabase/migrations/*.sql $fixtureMigrations
Copy-Item supabase/fixtures/legacy-baseline.sql (Join-Path $fixtureMigrations "20260830000000_legacy_baseline.sql")
$localStart = & npx supabase start --workdir $fixtureRoot 2>&1
if ($LASTEXITCODE -ne 0) { throw "Supabase local start failed. Inspect the captured output privately." }
```

将本地应用配置写入 `.env.local`。CLI 输出可能包含本地凭据，验收记录仅保存状态和统计。两个普通账号与一个管理员账号均在隔离 Auth 内创建。管理员角色仅在隔离数据库的 `public.profiles` 中赋予。

## 验收顺序

1. 保持高德写入关闭。打开 `/zh-CN/discover`，查看动态商家提示和自有商家的正常操作。已有动态收藏应可取消。
2. 对 seed 中的城觅自有餐厅使用真实 Auth 和 Storage。提交带 JPEG、PNG 或 WebP 的推荐，检查待审时匿名用户与其他账号无法读取正文和图片。管理员应能预览。批准后公开，拒绝或撤回后重新请求同一图片地址应收到 404。退出管理员账号后关闭原预览。
3. 使用独立授权的高德 Web 服务 Key 和 JS Key，测试澳门与广州的城市、店名、商圈、街道、1／3／5 公里、拖动区域和翻页。记录同名分店、重复结果、权限拒绝、超时、限额和空结果。学生推荐模式的空文案只描述已加载结果。
4. 确认 POI 持久化许可后，在隔离环境验证动态收藏、重新登录恢复、不同账号隔离、取消收藏、历史地点关联与 POI 换号。用两条独立数据库连接验证并发写入，检查历史表和媒体引用。

## 本轮验证范围

- PGlite 加载了完整仓库迁移链及空旧版基线，并用历史商家、评价、收藏、图片和多个角色验证 P1 增量迁移。Auth 与 Storage 服务由测试夹具模拟，单进程 SQL 测试不能证明跨连接并发。
- 本地 Supabase 启动已尝试。CLI 报告缺少 Docker 和 Podman，本地 API 未监听。已连接的 Supabase 账号未找到可用的隔离分支。真实 Supabase Auth、Storage、PostgREST 和数据库多连接测试未执行。
- 工作树没有独立高德测试配置和已确认的 POI 持久化许可。真实高德 REST、JS 代理上游请求和真机定位未执行。浏览器使用手工构造的数据，仅验证真实页面交互。

### 2026-11-23 实际运行结果

| 检查 | 结果 |
| --- | --- |
| 全量 Vitest | 118 个文件、739 项通过 |
| P1 定向回归 | 5 个文件、44 项通过 |
| ESLint、TypeScript、三语文案、生产构建 | 通过 |
| 构建后的客户端凭据检查 | 通过，未检出三种模拟服务端凭据 |
| Chromium 模拟手机模式，360 × 732 | 两个场景通过。地图场景发出 12 个模拟请求。收藏场景验证已有收藏刷新、失败保留状态及取消后刷新 |
| 真实 Supabase 和真实高德 | 未执行 |
