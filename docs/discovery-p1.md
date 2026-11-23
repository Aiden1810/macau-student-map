
# 城觅 P1 动态商家地图

从首页的指南针按钮进入，或打开 `/zh-CN/discover`。原首页、手工投稿、历史商家详情和普通评价继续使用原有入口。

## 在 Windows 本地运行

在 P1 工作目录使用 PowerShell。

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run doctor
npm run dev
```

在 `.env.local` 填入独立开发环境的 Supabase 配置。新建迁移位于
[20261123120000_discovery_recommendations.sql](../supabase/migrations/20261123120000_discovery_recommendations.sql)。
在隔离 Supabase 测试项目或已启动的本地 Supabase 中应用现有迁移和该迁移。对于已启动且确认是本地的实例，运行 `npx supabase migration up --local`。确认站点与迁移使用同一个测试数据库。

- 地图使用 `NEXT_PUBLIC_AMAP_WEB_KEY`。高德 JS Key 要求安全密钥时，把 `NEXT_PUBLIC_AMAP_USE_SECURITY_PROXY` 设为 `true`，仅在服务端填写 `AMAP_JS_SECURITY_CODE`。原 `NEXT_PUBLIC_AMAP_SECURITY_CODE` 已停用。曾由旧构建公开的密钥应在高德控制台轮换后再用于代理。
- 动态搜索、地点 ID 查询和街道解析使用服务端 `AMAP_WEB_SERVICE_KEY`。核对 Key 类型、允许的调用来源、澳门和目标城市覆盖、搜索 2.0 与地理编码权限，以及账号 QPS 和日配额。境外覆盖需按高德官方说明确认，客户端没有固定城市限制。 [POI 搜索 2.0](https://lbs.amap.com/api/webservice/guide/api-advanced/newpoisearch) · [境外地点搜索](https://lbs.amap.com/api/web-service/guide/searchs) · [JS 安全代理](https://lbs.amap.com/api/maps-javascript-api/guide/abc/jscode)
- `SUPABASE_SERVICE_ROLE_KEY` 仅用于服务端验证后的推荐及收藏写入和私有图片签名。`AMAP_ALLOW_POI_ID_PERSISTENCE` 默认关闭，获得相应授权后才在目标环境启用。数据库仅保存业务所需的 POI ID 和 UUID 关联。高德名称、地址和坐标随查询读取，响应为 `no-store`。 [高德开放平台服务协议](https://lbs.amap.com/pages/terms/)
- 服务端有单实例并发和分钟限额。公开环境应按测试结果在站点入口设置多实例共享限流，覆盖 `/api/discovery/search` 和 `/_AMapService/`，并在高德控制台监控真实配额和预算。 [高德错误码与限额](https://lbs.amap.com/api/webservice/guide/tools/info)

## 数据兼容与维护

- 搜索只读取高德和平台目录。按 POI ID 与显式 UUID 映射去重。名称相同的商家各自保留。迁移没有回填、重建或删除原商家、收藏、评分、评价和图片。新增关联对已有地点使用 `ON DELETE RESTRICT`，管理端继续归档地点。已归档的关联地点不会出现在新地图或推荐公开接口。
- 维护人员确认实体一致后，可在授权环境中调用 `associate_verified_discovery_poi(p_poi, p_place, p_previous)`。首次关联填入当前 POI 和历史 `places.id`。供应商换 ID 时填新旧 POI，可省略历史地点 UUID。该事务保留旧 ID 作为别名，迁移该地点的外部收藏到既有收藏表，并保留已有收藏时间。新旧 ID 已经属于两个独立业务身份时会拒绝合并。没有可靠 ID 时继续使用历史详情，待人工核验后再关联。
- 学生推荐由登录用户提交，管理员在原后台的评价入口审核。批准且未撤回的内容才参与新标识、详情和推荐筛选。审核中的图片保存在私有桶。公开图片按访问权限签发短期链接，撤回前已签发的链接可能在短时有效期内仍可用。学生身份目前沿用平台账号体系，无额外在校验证。
- 上传后中断可能留下未关联的私有图片。维护时只检查 `student-recommendation-media` 中超过保留期限且没有 `student_recommendations.image_path` 引用的对象。经确认后由 Storage API 清理，保留原有图片及所有已关联对象。

## 人工验收

1. 在测试环境分别搜索澳门和另一个城市，例如广州。区别城市、店名和街道附近三种交互。验证同名分店、翻页、快速连续搜索、无结果、超时和限额提示。
2. 在真实手机上授权定位，测试 1/3/5 km。拒绝授权后使用城市搜索。拖动和缩放后点击「搜索此区域」。检查列表与地图双向选择、推荐标记、导航和列表滚动。
3. 新账号收藏一个动态商家并刷新，在「我的收藏」中打开并取消。再使用未绑定高德 ID 的历史商家验证原详情、收藏、评价和图片。
4. 匿名用户打开详情，确认可读公开推荐及图片。登录后提交两条推荐，其中一条附图。待审时检查匿名不可见，后台批准后确认模式和详情同步。隐藏或由作者撤回后再次检查。
5. 记录真实高德请求的状态、耗时和适用的速率限制。学生推荐模式按已加载的搜索结果过滤，高德最多返回 200 条，超出供应商返回范围的推荐可用更小区域或更准确的关键字查找。 [POI 搜索上限](https://lbs.amap.com/api/webservice/guide/api-advanced/newpoisearch)

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run i18n:check
npm run build
```
