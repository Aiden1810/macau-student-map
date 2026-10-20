# 旧版店铺读取与图片加载优化（2026-10-20）

## 已完成

接续 `public-place-cache-2026-10-20.md`，把首页另一条旧版 `shops` 读取通道接入服务端缓存，并减少移动图片轮播初始挂载的图片数量。保留原有店铺数据、翻译、搜索、筛选、管理员流程和页面布局。

普通访客（包括普通登录用户）的首页读取流程现在是：

```text
首页 ── /api/shops ── 匿名 verified 旧店铺缓存 ── Supabase
     └─ /api/places ─ 匿名 published 地点缓存 ── Supabase
```

两个请求并行执行，仍在浏览器按当前语言映射和合并。管理员的旧店铺列表保留原有直接查询，可以读取有权限管理的待审核资料；这些数据不进入共享缓存。收藏和其他用户资料也不进入此缓存。

## 缓存更新

- 旧版列表和地点列表使用不同缓存键，共用清理标签；评价改变评分或管理员改店铺时可一起清理。
- 延续约 30 秒重新验证的策略，过期后首个请求可能先读旧结果，由后台重新查询，不是严格的“最多延迟 30 秒”。
- 浏览器和 CDN 不另存 API 响应；requestId 每次重新生成。
- 查询异常不保存为成功列表；旧版读取失败时继续保留原有的地点列表降级逻辑。
- 浏览器完成旧版写入后，调用新增的 `/api/admin/shops/refresh-cache`；服务器重新验证管理员身份后才清缓存。
- 首页审核/删除、后台审核/删除/编辑/批量补全、图片管理上传/移除共 8 个写入点已接入通知。
- 通知失败不会把已经保存的数据报告为保存失败，改由定时重新验证更新。数据库外部脚本和 Dashboard 的直接修改也依靠定时更新。

## 图片

- `ShopCard` 增加响应式 `sizes`，向浏览器说明列表卡片所需的图片宽度，让它选择合适的 Next.js 图片版本。
- `MobileImageSlider` 只挂载当前及相邻图片，保留全部滑动位置与原有 lightbox 索引。五张图片初始挂载两张，滑到中间通常挂载三张。
- 图片数组变化后重新建立轮播状态，回到第一张并清除上一组失败记录。
- 为未挂载图片的按钮补充三语可访问名称。
- 现有上传组件已经压缩图片，本轮没有重复改动压缩逻辑，也没有覆盖已有图片文件。

挂载图片数量减少不等于实测流量按比例下降；浏览器缓存、视口、设备像素比以及桌面图库都会影响实际下载量。

## 文件

- 新增 `app/api/shops/route.ts`、`lib/data/public-legacy-shops.ts`：公开旧店铺读取与缓存。
- 新增 `lib/data/legacy-shops.ts`：区分普通访客和管理员读取，以及浏览器写入后的缓存通知。
- 新增 `app/api/admin/shops/refresh-cache/route.ts`、`lib/api/shop-cache-refresh.ts`：经过管理员验证的缓存清理入口。
- 修改 `app/[locale]/page.tsx`：接入读取函数，审核/删除后通知缓存。
- 修改 `app/[locale]/admin/page.tsx`、`components/AdminImageManager.tsx`：旧版写入后通知缓存。
- 修改 `components/ShopCard.tsx`、`components/MobileImageSlider.tsx`：缩略图尺寸和轮播按需挂载。
- 修改 `messages/zh-CN.json`、`zh-MO.json`、`en.json`：新增 `ShopDetail.viewImage`。
- 新增 `tests/lib/api/legacy-shop-list.test.ts`、`tests/lib/data/mobile-slider-loading.test.tsx`：8 项针对性检查。

## 验证

在 PowerShell 项目目录执行：

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run i18n:check
```

本地预览可用 `npm.cmd run dev`，打开终端显示的地址。检查首页三种语言、普通用户列表和管理员列表、手机详情左右滑动、点击图片打开大图。

另在忽略目录 `output/cache-verification/2026-10-20T09-34-26-636Z/` 中做了真实 Next.js 正式构建与请求验证：未复制任何环境文件，Supabase 数据访问全部指向隔离的本地服务。旧版表接口用合成资料验证缓存和权限，其他已有地点接口沿用本地 PGlite 适配器。

结果：旧版列表预热后连续读取 10 次，新增后端数据请求 0 次，10 个 requestId 不同。清缓存接口对匿名请求返回 401、普通用户返回 403、管理员返回 200；重复清理能再次读取更新资料；清理也覆盖原地点列表。

轮播检查使用 jsdom 和真实 Next.js Image 组件验证挂载、滑动索引、lightbox 索引和图库切换；没有据此声称实测浏览器网络流量或图片字节节省比例。

## 后续

首页仍保留旧版 Realtime 实时订阅；缓存不会减少这些连接。下一步可单独判断哪些页面确实需要实时更新，再处理连接数、分页和真实使用监测。缓存不能直接换算成线上可承载人数。

本次没有新增依赖、数据库迁移、部署、提交或推送，没有修改真实店铺和人工资料。

参考：[Next.js 15 Image](https://nextjs.org/docs/15/app/api-reference/components/image)。
