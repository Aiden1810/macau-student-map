# 美食筛选与简洁价格正式发布（2026-10-19）

用户明确要求“上线”，本轮已发布并切换正式域名。

## 正式入口与范围

- 正式网站：https://www.aiden-macau-map.top/zh-CN
- 美食分类：https://www.aiden-macau-map.top/zh-CN?category=food
- 备用域名：https://macau-student-map.vercel.app/zh-CN

包含“饭店”改“美食”、烧烤／烤肉及粉面烧腊和咖啡饮品甜品分类、真实30元内及近7天筛选、推荐规则说明，以及卡片简洁价格“人均 ¥31”。保留上一版AI浮窗与历史、抽屉收起、收藏提示、后台和反馈功能。未修改店铺资料、价格、标签归属、坐标，也未执行数据库迁移。

## 部署来源

- Vercel 项目：`aiden1810s-projects/macau-student-map`。
- 项目 ID：`prj_Hpu3ocNgDefJ7ATF2juPvL45J30l`。
- 新部署：`dpl_ECYaTFugDzuNdDgjuXZodnzrpBdn`，生产环境，状态 READY。
- 部署地址：https://macau-student-g7jlm2w46-aiden1810s-projects.vercel.app
- 发布前部署：`dpl_5QPgBoXdC49Pi4KBNhP9eRRZ9VJ4`，地址 https://macau-student-pl3xkcpy5-aiden1810s-projects.vercel.app 。
- 来源分支：`codex/admin-place-workflow`；Git 基线 `ccb72f44f332693f5af976f628a57f5a67fa81df`，含现有未提交工作。
- 独立发布副本183个文件、1,105,431字节；源清单 SHA-256：`f6f1aa32dbf89a1d1a58e075e927569e98cba64e180edb1beec28c50c0f30770`。
- 清单及验证证据：`output/production-release-2026-10-19-food-filters/`（Git忽略目录）。
- 发布副本逐文件对比工作区并检查私有密钥；不含 `.env*`、SQL、导入文档、测试、日志和本地依赖。仅写入必要的Vercel项目标识，没有复制本地保护凭据。

## 验证结果

1. 本地379项测试（59个文件）、lint、TypeScript和三语言275键检查通过。此前本地生产构建通过，本轮Vercel远程构建再次通过编译、lint和类型检查。
2. 使用 `deploy --prod --skip-domain`，在READY后检查待发布版本；通过后才执行 `promote`，无重新构建。
3. 切换前、切换后分别检查8个入口：首页、联系我们、后台、店铺数据、AI配置均200；未登录反馈提交、管理员收件箱、处理反馈均401 / UNAUTHORIZED。
4. 店铺接口实际返回已有 `publishedAt`，AI配置 available=true。没有额外向AI发送付费测试请求，也没有创建反馈或店铺测试数据。
5. 核对本次部署的前端页面及共享JS文件，确认四个新筛选值和新价格格式存在；JS中的人民币符号被编译为 `\xa5`，按编译形式验证。
6. promote后分别inspect自定义域名和备用域名，均指向本次新部署。
7. 正式网站浏览器确认“美食”和“人均 ¥30”等实际文案；390×844手机截图保存为 `output/production-release-2026-10-19-food-filters/production-mobile.png`。
8. 本次部署近15分钟、最多20条5xx日志查询返回0条；这只是发布时检查，不代表持续监控。

线上浏览器操作较慢，页面初次读取约55秒，截图约22秒；没有将工具等待当作应用故障。

## 后续与回退

本次没有创建、推送或合并Git提交，GitHub仍未同步这批已发布代码。下次从Git自动发布前，应同步当前代码，避免旧代码重新覆盖线上。

如需回退到本轮发布前版本，可使用下列命令；仅记录，未执行：

```powershell
vercel rollback https://macau-student-pl3xkcpy5-aiden1810s-projects.vercel.app --scope aiden1810s-projects
```

回退不会修改数据库。回退后再次发布时，需重新确认并promote正式域名。
