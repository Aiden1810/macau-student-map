# 2026-10-18 正式发布记录

## 已发布内容

手机界面绿色主题、搜索分类与店铺卡片、店铺详情样式、AI 聊天浮窗、真实需求解析和路线比较、距离格式、本地历史对话。

正式入口：

- https://aiden-macau-map.top/zh-CN （跳转 www）
- https://macau-student-map.vercel.app/zh-CN

## 发布身份与来源

- Vercel 项目：`macau-student-map`，团队：`aiden1810s-projects`。
- 项目 ID：`prj_Hpu3ocNgDefJ7ATF2juPvL45J30l`。
- 新部署：`dpl_B7Q1fXn1e8jqd8qYfqwY5Bmd1aKC`，生产环境，最终状态 `READY`。
- 部署地址：https://macau-student-53ebq6qoo-aiden1810s-projects.vercel.app
- 发布前部署：`dpl_6NqQZYjYxVj1HYCKuXoZUeXSsPCG`，地址 https://macau-student-m3cxur0ob-aiden1810s-projects.vercel.app 。
- 本次从 `codex/admin-place-workflow` 的本地未提交代码生成独立发布副本；基线提交 `ccb72f4`，没有冒充新的 Git 提交，也没有推送或合并分支。
- 副本183个文件、1,104,072字节；来源 SHA-256：`24eb798c72f730378fcf59664299b2b0ffb46f4d7e2425253c0804b7b805e4d7`。完整清单在被 Git 忽略的 `output/production-release-2026-10-18/source-manifest.json`。
- 副本只含应用代码、配置与公开资源；不含 `.env*`、本地依赖、构建输出、数据导入文档和 SQL。发布前检查副本不含真实 DeepSeek Key。

## 配置与过程

保留线上高德和 Supabase 环境变量，新增生产环境 `DEEPSEEK_API_KEY`（敏感变量）及 `DEEPSEEK_MODEL=deepseek-flash`。Key 通过进程标准输入写入 Vercel，不进入命令参数、发布副本或本文档；本地 `.env.local` 内容未更改。

先用 `--prod --skip-domain` 构建，验证同一部署首页、AI 配置和真实 AI 请求，再用 `vercel promote` 将正式域名切换到已测部署。未执行数据库迁移、导入、资料修改或密钥轮换。

## 验证证据

- 本地：51个测试文件、317项测试通过；lint、TypeScript、三语言258键检查通过。
- Vercel：Next.js 15.5.28 远程生产构建、lint 和类型检查通过，状态 `READY`。
- 新部署首页 `/zh-CN`、配置接口 `/api/assistant`、真实 `/api/assistant/chat` 均返回 HTTP 200。
- 配置接口确认 `available: true`。真实问题成功解析两家门店、两个人、人均30元及粉面偏好；候选由线上已发布目录返回，价格分别28元与25元。
- 推广后再次确认 `.vercel.app` 和自定义域名均指向新部署；正式配置接口仍返回 HTTP 200。
- 浏览器确认正式站点显示8家店铺及高德地图，390×844视口可打开新版AI浮窗，历史页可显示本轮输入的验收草稿。截图：`output/production-release-2026-10-18/production-mobile-history.png`。
- 浏览器工具读取线上页面较慢，初期默认30秒等待曾超时；调整工具等待后取得实际页面与截图，没有将其误判为服务端故障。
- 发布后检查运行日志，1条被平台归入 error 的记录正文为 AI SDK Warning System 提示，对应请求 HTTP 200；本轮未观察到应用请求失败。没有声称持续监控或真机验收已完成。

## 回退与后续

如确认新版本存在严重问题，可在项目目录执行：

```powershell
vercel rollback https://macau-student-m3cxur0ob-aiden1810s-projects.vercel.app --scope aiden1810s-projects
```

本记录只提供回退命令，未执行回退。回退会影响自动生产域名分配，后续发布需确认并重新 promote。

当前代码仍未提交 GitHub。下次从 Git 自动部署前，先整理并提交这批已发布代码，避免旧仓库内容重新覆盖线上版本。历史只存当前浏览器及域名，本地预览、正式自定义域名与 Vercel 域名的历史不会互相同步。
