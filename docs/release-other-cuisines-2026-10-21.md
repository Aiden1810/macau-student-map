# 其他菜系发布记录

日期：2026-10-21（香港时间）。用户已授权检查通过后直接提交、推送并部署。

## 范围和目标

- 其他菜系入口及印度菜、东南亚菜、暂未细分选项，统一投稿、后台、店铺展示、筛选与搜索。
- 仓库 `Aiden1810/macau-student-map`，分支 `codex/admin-place-workflow`；沿用上次生产发布方式，不改动 main。
- Vercel 项目 `macau-student-map`，项目 ID `prj_Hpu3ocNgDefJ7ATF2juPvL45J30l`，Node.js 24。
- 正式站点 `https://www.aiden-macau-map.top/zh-CN`。
- 数据库增量迁移 `20261020163349_other_cuisines` 已安装，不重复执行。
- 保留原有小程序规划文档及临时文件，不纳入本次提交。

## 发布前检查

86 个测试文件、529 项测试通过，ESLint、TypeScript、三语言 277 个文案 key 检查、本地 production build 和 `git diff --check` 均通过。

使用已提交源码的干净导出副本创建生产暂存部署，不复制本地环境文件；验证暂存地址后再提升为正式版本。不会通过创建虚构的线上店铺验收。

## 发布结果

**已上线。**

- 发布源码：`a25e133bad3a2833f7c6f4fea118ae872672a620`，已推送 `codex/admin-place-workflow`。
- Vercel deployment：`dpl_3GfxH4TGjb4zQu3BTHVbuvMuWFzE`，状态 `READY`，target 为 `production`。
- 构建地址：`https://macau-student-40q8y6r43-aiden1810s-projects.vercel.app`。
- 正式地址：`https://www.aiden-macau-map.top/zh-CN`；备用地址 `https://macau-student-map.vercel.app/zh-CN`。两个域名的 inspect 均指向上述部署。
- 部署 metadata 的 `releaseCommit`、`releaseBranch` 与发布提交和分支一致。源码由该提交的 Git archive 导出，未混入 `.env.local`、小程序规划和临时文件。
- 先以 `--prod --skip-domain` 构建，暂存检查通过后使用 `vercel promote` 切换域名。切换前正式部署为 `dpl_HWivqJSEuuWRyiYrUuUxaFg8Yx6o`。
- 通过当前已认证的 Vercel CLI 完成发布；连接器 API 的 403 没有通过调整权限或保护设置处理。

## 线上验证

- 暂存版本：简体、繁体、英文首页及公开地点、旧店铺接口均为 200；未登录访问地点管理和平台工作台接口均为 401。
- 正式版本：以上检查重复通过，并确认一个真实已发布地点的详情页及公开评价接口返回 200。
- 公开地点接口正常读取 6 个地点，未新增演示店铺，也未使用真实账号创建投稿或执行审核。
- 浏览器真实访问正式域名，手机 390×844 显示“其他菜系”分组及印度菜、东南亚菜选项，选择印度菜后刷新仍保留筛选。手机与 1280×900 桌面没有横向溢出，控制台 0 errors、2 条既有 warnings。
- 指定部署近 15 分钟、最多 20 条 5xx 日志查询未返回记录；仅代表发布时的有限检查。
- 响应与检查摘要保存于 Git 忽略目录 `output/release-other-cuisines-2026-10-21/`。

完整登录投稿、编辑、审核发布仍由组件/API/隔离 PostgreSQL 测试覆盖，本轮不宣称完成了真实账号整条写入流程的人工验收。后续增加具体菜系时继续维护同一套分类定义和迁移。
