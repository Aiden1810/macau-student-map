# 后台与站内反馈正式发布记录

## 结果与入口

用户已明确授权将所有已实现改动上线。本轮已发布并切换正式域名：

- 正式网站：https://www.aiden-macau-map.top/zh-CN
- 用户反馈：https://www.aiden-macau-map.top/zh-CN/contact
- 管理后台：https://www.aiden-macau-map.top/zh-CN/admin
- 备用域名：https://macau-student-map.vercel.app/zh-CN

包含绿色手机界面、AI 浮窗与历史、抽屉完全收起／恢复、收藏成功与失败提示、后台新布局与流量概况，以及站内反馈提交和管理员收件箱。批量上线／下线仍只是待办，没有实现或执行。

## 部署身份与来源

- 项目：`aiden1810s-projects/macau-student-map`，ID `prj_Hpu3ocNgDefJ7ATF2juPvL45J30l`。
- 新部署：`dpl_5QPgBoXdC49Pi4KBNhP9eRRZ9VJ4`，生产环境，状态 `READY`。
- 部署地址：https://macau-student-pl3xkcpy5-aiden1810s-projects.vercel.app
- 发布前生产部署：`dpl_B7Q1fXn1e8jqd8qYfqwY5Bmd1aKC`，地址 https://macau-student-53ebq6qoo-aiden1810s-projects.vercel.app 。
- 来源：`codex/admin-place-workflow` 当前工作区，Git 基线 `ccb72f44f332693f5af976f628a57f5a67fa81df`，包含未提交代码。没有创建、推送或合并 Git 提交。
- 独立应用副本清单为 181 个文件、1,096,244 字节，SHA-256 为 `9bf72189e39daf90f6808e4480c5cb4356418ef3637fd5a95061debc4949fe16`。
- 清单：`output/production-release-2026-10-18-admin-feedback/source-manifest.json`。副本逐文件与工作区核对，并扫描私有密钥；不含 `.env*`、SQL、文档、测试、日志和本地依赖。
- `.vercel/project.json` 在副本中仅写入项目 ID、组织 ID 和名称，未复制本地保护凭据。

## 验证与切换

1. 本地 57 个测试文件、364 项测试通过；lint、TypeScript、三语言 265 键检查通过。
2. `vercel deploy --prod --skip-domain` 远程生产构建、lint、类型检查通过，确认状态 READY 后才切换正式域名。
3. 切换前和切换后均验证：首页、联系我们、后台页面与 AI 配置接口返回 200；反馈提交、后台读取和处理接口在未登录时均返回 401 / UNAUTHORIZED。
4. 联系页面返回实际新版“提交给管理员”界面；AI 配置 available=true。真实 AI 请求返回 200 / mode=ai，识别出穆味王与二师兄两组已发布门店候选。
5. `vercel promote` 后，分别 inspect 自定义域名与备用域名，均指向本次新部署。
6. 浏览器确认正式网站显示 8 个当前分类地点；390×844 手机视口可完全收起店铺抽屉，显示完整地图和恢复列表按钮。截图：`output/production-release-2026-10-18-admin-feedback/production-mobile.png`。
7. 线上浏览器读取较慢，组合点击与截图曾超时；重新读取页面后取得实际截图，确认抽屉已成功收起，没有将工具超时当作网站失败。
8. 查询本次部署近 15 分钟最多 20 条 5xx 请求日志，返回 0 条。这是发布时的有限检查，不代表持续监控。

接口证据保存在同一 output 目录的 `staged-checks.json`、`production-checks.json` 和 `staged-chat.json`，均被 Git 忽略。

## 数据库、密钥与验收边界

- 沿用现有生产环境变量，本轮没有改动、输出或重新上传密钥，本地 `.env.local` 保持原样。
- 站内反馈表已在上一轮经用户单独授权创建，版本 `20261018153506`，真实角色权限和事务回滚测试通过；本次发布没有再次执行迁移或修改店铺事实。
- 当前浏览器未登录管理员，未伪造登录，也未向正式反馈收件箱填充测试投诉。登录后的“提交反馈 → 按编号核对 → 标记已处理”仍可由项目所有者进行实际账号验收。
- 当前已发布代码仍未提交 GitHub。下一次 Git 自动部署前需同步这批代码，避免旧仓库版本覆盖正式站点。

## 回退

如果需要回到本次发布前版本，可在项目目录运行以下命令；这里仅记录，未执行：

```powershell
vercel rollback https://macau-student-53ebq6qoo-aiden1810s-projects.vercel.app --scope aiden1810s-projects
```

回退不删除反馈表；回退后旧界面没有站内反馈入口。回退会影响自动生产别名分配，后续发布需重新确认并 promote。
