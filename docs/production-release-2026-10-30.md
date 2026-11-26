# 2026-10-30 发布记录：统一地点与投稿可靠性

> 状态：**已部署并完成公开线上验收**。GitHub main 合并提交为 `e990e0958ac8f11245cf7f3714553152a90f056d`，对应代码提交 `d6b329126bb3a588aadbb02c2219edab944b2ce5`。

用户已授权检查、修复并上线。发布范围为地点数据统一，以及同一工作区内已经完成且有关联的地图、投稿互锁、账号隔离、请求大小和媒体权限修复；不创建小程序、不更改项目品牌。

## 发布前检查

- 从 package-lock.json 重新 `npm ci`，693 项测试通过；TypeScript、lint、多语言 287 个键、正式构建通过。
- `npm audit --audit-level=low`：0 vulnerabilities。
- 两轮独立代码复核无剩余发布阻断问题；媒体策略另有 7 文件、49 项定向测试通过。
- 生成的 tsconfig / next-env 构建变动已恢复，不纳入发布。
- 基础分支为 origin/main `94d9c7670bbc87e7d9dfa30c337be28c4d26416a`，发布前已 fetch 核对。

## 数据库

- `retire_legacy_place_paths` 已于前一轮执行；远端版本 `20261029164622`。56 条地点保持 10 已发布、46 草稿，旧 shops 为空。
- `harden_submission_media_permissions` 已执行，远端版本 `20261030025244`；执行前后仍为 56 地点、12 投稿、30 媒体记录、3 个私有图片对象。
- 已保存原媒体策略回退 SQL 至忽略目录 `output/release-media-permissions-rollback.sql`，没有执行回退。
- 现有管理员转存、预览、清理策略保留。私有历史附件路径与归属校验未发现不匹配。

## 发布方式及回退点

通过工作分支推送 PR，等待现有 GitHub Actions 的 lint/test/i18n/audit/build 检查通过，再合并 main。生产部署由现有 CI 的 deploy-vercel 任务执行；不绕过检查直接发布当前工作目录。

发布前的 Ready 生产版本：`dpl_2djqYTAdFNCPcjUEvkAiED32U17M`，地址 `https://macau-student-ciqx6662c-aiden1810s-projects.vercel.app`。正式域名包括 `https://macau-student-map.vercel.app` 和 `https://www.aiden-macau-map.top`。

如新应用出现发布回归，优先回退应用到该生产版本；数据库保留空旧表的 SELECT，因此兼容旧版详情回退流程。不要为了回退应用删除新事件或商户资料。

## 发布后验收

以对应 main 提交的 GitHub Actions 完成和 Vercel Ready 为准，随后检查正式域名首页、地图、搜索、真实地点详情、旧 HTTP 兼容接口、草稿 404 和匿名管理员接口 401。

账号切换、上传竞争和权限边界有自动化测试；没有真实管理员登录会话，因此完整 Storage HTTP 上传→审核→转存及后台登录操作仍是人工验收边界。没有把模拟测试描述成真实账号端到端验收。

## 实际发布结果

- [PR #4](https://github.com/Aiden1810/macau-student-map/pull/4) 的检查与 Vercel 预览通过后，已合并到 main。
- [正式 CI + Deploy](https://github.com/Aiden1810/macau-student-map/actions/runs/40994631018) 的 lint-and-build、deploy-vercel 均成功。
- 最终生产部署为 `dpl_4mr3ciL4BzLBjczaQmWqFXbekN2v`，状态 Ready，构建地址 `https://macau-student-r75labppd-aiden1810s-projects.vercel.app`；2026-10-30 澳门时间约 11:00 完成。
- `https://www.aiden-macau-map.top`、`https://aiden-macau-map.top`、`https://macau-student-map.vercel.app` 已指向最终生产部署。
- 正式域名实测：`/api/places` 200/10 条；兼容 `/api/shops` 200/10 条；公开地点详情 200；真实草稿详情 404；匿名管理员接口 401。
- 真实浏览器验证：首页显示 10 个地点，搜索“穆味王”得到 1 个地点，公开详情显示对应名称、人均、地址和用户评价区域；首页/搜索控制台 0 errors，请求只使用统一地点接口。
- 发布后数据库仍为 56 地点（10 published、46 draft）、12 投稿、30 媒体、3 个私有对象；旧表为空且客户端写入关闭，媒体归属保护触发器存在。
- 当前本地代码树与合并后的 main 一致；保留原有小程序规划文档的未提交工作。此发布结果补记为本地文档更新，不再次触发一次仅修改文档的生产构建。

截图和验收日志保存在忽略目录 `output/release-*`。依赖安装只出现原有 ESLint 版本弃用提示，测试中的 AI SDK JSON schema 兼容提示不等于真实付费 AI 请求验证。
