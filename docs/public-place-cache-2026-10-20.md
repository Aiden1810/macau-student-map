# 公开店铺列表缓存（2026-10-20）

## 这一步解决什么

多个用户反复读取 `/api/places` 时，可以复用服务端的公开列表，减少重复数据库查询。页面样式和接口的 JSON 数据格式保持原样。

只缓存匿名查询得到的 `published` 地点及公开图片、标签、评分等列表数据。没有把登录状态、收藏、管理员资料或请求编号放进共享缓存。每次响应仍有新的 requestId，并设置 `Cache-Control: no-store`，避免浏览器或 CDN 再存一份无法主动清理的响应。

## 更新规则

- 采用现有 Next.js 15 的 `unstable_cache`，约 30 秒后触发重新验证。时间到后的首个请求可能先收到旧结果，同时后台重新查询；因此不能理解成严格的“最多延迟 30 秒”。
- 管理员保存、批量上下架、图片上传/删除/重试、投稿发布/合并后，清理公开列表的 cache tag，后续读取重新查询。
- 用户评价发布、修改、删除，以及管理员审核评价后，也清理列表，避免评分继续使用旧结果。
- 发生部分成功或操作结果无法确认时，仍尝试清理缓存。清理失败会记录固定错误信息，保留原操作结果，等待定时重新验证。
- 缺失表结构和查询异常通过 throw 离开缓存函数，不会把错误或降级空列表存成成功结果。已有成功缓存的后台刷新失败时，框架可能继续返回旧数据。
- 两个旧投稿审核接口增加异常捕获：发布已提交、图片处理随后抛错时，返回可核对的 500 响应，让 Next.js 执行排队的缓存失效。

## 文件

- `lib/data/public-places.ts`：公开查询、映射及共享缓存。
- `lib/data/public-places-cache.ts`：缓存时间、标签和写操作后的失效处理。
- `app/api/places/route.ts`：保留响应格式、请求编号和错误降级。
- `lib/admin/api.ts`：新增经过管理员鉴权后执行的地点路由包装，读取请求不清缓存。
- `app/api/admin/places/` 下五个路由：保存、批量状态和图片操作接入包装。
- `app/api/admin/submissions/[id]/approve/route.ts`、`merge/route.ts`、`publish/route.ts`：发布和合并的缓存失效。
- `lib/reviews/handlers.ts`：评价增改删与审核的缓存失效。
- `tests/lib/api/public-places-cache.test.ts`、`submission-cache-failure.test.ts`：缓存边界、鉴权、评分刷新和异常回归检查。

## 验证与运行

在项目目录 PowerShell 中执行：

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run i18n:check
npm.cmd run dev
```

新增 11 项回归检查。完整测试共 492 项通过；TypeScript、ESLint 和翻译检查通过。

另外在 `output/cache-verification/` 中创建隔离副本，排除全部环境文件，只连接本地 PGlite 模拟数据库，并以 `next build` / `next start` 运行真正的产品接口。临时探测路由只存在于隔离副本，未加入产品源码。

已验证的实际行为：

1. 预热后连续读取 10 次列表，新增数据库查询 0 次，10 个 requestId 均不同。
2. 清理后 50 条缓存更新为 60 条；重新命中缓存后再清理，更新为 70 条。
3. 后续步骤失败并返回 422 时，旧列表仍被清理。
4. 执行真实的本地评价 SQL 函数后，列表读到评分 4、评价数 1。
5. 等待约 30 秒并完成后台重新验证后，读到模拟数据库的新列表。

以上是功能验证，不是线上并发容量保证。没有访问或修改真实店铺。

## 范围和下一步

- 首页目前还会直接查询旧版 `shops`；这条通道没有缓存，所以整页的数据库请求不会全部消失。
- 本次没有改分页、详情接口、图片压缩、服务器地区或数据库结构，没有增加依赖。
- 已打开的页面不会因为清除服务端缓存而自动刷新，需要再次请求列表。
- 通过 Supabase Dashboard、脚本或旧版写入通道直接改数据，不会触发这些接口的 tag 清理，将依靠定时重新验证。
- 冷缓存和后台重新验证时仍需查询数据库，短时间并发也可能触发多次查询。
- 自托管多个独立实例时，需要另行配置共享缓存与失效协调；不能把单机验证直接当成多机保证。
- 后续可单独整理旧版店铺读取通道，再评估分页和图片加载。

尚未部署，也没有执行远端迁移、提交或推送。本轮之前已有的后台修改继续保留。

参考：[Next.js 15 缓存查询](https://nextjs.org/docs/15/app/api-reference/functions/unstable_cache)、[按标签清理缓存](https://nextjs.org/docs/15/app/api-reference/functions/revalidateTag)。
