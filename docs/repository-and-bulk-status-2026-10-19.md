# 代码归档与管理员批量上下线

日期：2026-10-19。沿用现有项目结构，没有重新组织目录或加入第三方依赖。

## 代码归档

- 已上线版本整理为提交 `942e493`，推送至 GitHub 的 `codex/admin-place-workflow` 分支。
- 仓库：https://github.com/Aiden1810/macau-student-map/tree/codex/admin-place-workflow
- 保存应用代码、现有导入文档、SQL、测试与验收说明；没有清理或覆盖之前的工作。
- `.env.local`、`.vercel`、依赖目录、构建产物、临时输出仍被Git忽略。归档前检查336个仓库文件，未发现当前私有环境变量值或凭据格式内容。
- 未合并main，也没有因本轮整理而切换正式网站。

## 批量功能

入口：管理员后台 → 店铺资料。

1. 搜索名称或按发布状态筛选。
2. 勾选店铺，或“全选当前筛选”；超过50家时明确显示“选择筛选结果前50家”。每批最多50家。
3. 点击“批量上线”或“批量下线”，核对确认框内的店名和数量。
4. 确认后显示每家店铺的结果：操作成功、已是目标状态无需修改、失败或结果待确认。

改变搜索或状态筛选会清空选择，避免误操作隐藏店铺。执行时锁定操作按钮，防止连续点击重复请求。完成后重新读取真实状态；仍符合筛选的失败项保留勾选。

下线只是改为 `archived`，保留店铺资料和图片；重新上线改为 `published`。没有批量删除或批量修改价格、标签的功能。这里继续只维护新地点资料，旧版店铺仍使用原入口。

## 数据与权限

- 新API：`POST /api/admin/places/bulk-status`，只接受目标状态、店铺编号及读取时的精确 `updatedAt`。
- API和数据库两层管理员权限检查；直接调用数据库函数的普通用户也不能修改状态。
- 每家店独立事务；一家资料不符合要求，不会撤销其它已成功店铺。
- 数据库锁定店铺行后核对 `updated_at`；已被修改的记录提示刷新。重试时已是目标状态会跳过，避免重复操作和重复审计。
- 上线继续复用已有资料断言，检查类型、标签和地图位置等。首次发布时间只在首次上线时补入，重新上线不会重置。
- 状态更新和审计记录在同一事务内完成；只改发布状态及相应系统时间，不重写店名、地址、价格、标签、图片。
- 高权限实现放在非公开的 `private` schema，公开RPC仅为 `SECURITY INVOKER` 包装；私有实现仍检查管理员身份。

## 修改文件

| 文件 | 作用 |
| --- | --- |
| `components/admin/PlacesManager.tsx` | 勾选、批量入口、处理状态、自动刷新 |
| `components/admin/BulkPlaceStatusDialog.tsx` | 列出店名与数量的确认框 |
| `components/admin/BulkPlaceStatusResult.tsx` | 每家操作结果与失败原因 |
| `lib/admin/bulk-place-selection.ts` | 可见选择范围、数量上限与结果统计 |
| `lib/admin/bulk-place-status.ts` | 请求校验、逐项RPC执行、错误提示 |
| `app/api/admin/places/bulk-status/route.ts` | 管理员API入口 |
| `lib/admin/place-editor.ts`、`lib/admin/place-data.ts` | 读取精确修改时间，供并发检查使用 |
| `supabase/migrations/20261019081749_admin_place_status_only.sql` | 状态专用函数与权限 |
| `supabase/tests/manual/admin_place_status_only.rollback.sql` | 真实数据库角色、状态与资料保留的回滚校验 |
| `tests/lib/api/bulk-place-status.test.ts` | 权限、边界、部分失败和未知结果等测试 |
| `tests/lib/admin/bulk-selection.test.ts`、`bulk-place-dialog.test.tsx` | 隐藏选择、确认和结果提示测试 |

## 本轮验证

- 396项自动测试、lint、TypeScript、三语言文案检查及生产构建通过。
- 用户已单独授权安装函数并做事务回滚验证；远端版本为 `20261019081749`，本地迁移文件已同步版本号。
- 真实数据库验证：管理员操作、普通用户及匿名拒绝、旧修改时间拒绝、无坐标不能上线、重试幂等、首次发布时间保留、资料不变、操作审计均通过。
- 测试全部回滚：真实店铺49家，前后完整记录摘要均为 `ed80f5f7e726a1f809f7a22065a83242`；审计记录均141条，临时店铺剩余0条。
- 安全检查没有新增提示。原有6个公开管理员函数的认证调用提示、5个旧表无策略信息，以及已有的密码泄漏保护配置提示未在本轮修改。参考：[函数调用提示](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)、[密码保护说明](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。
- 代码审查后修正手机卡片布局：编辑按钮在手机上另起一行，给店名和地址保留空间；结果面板逐店列出全部结果。
- 浏览器确认未登录无法访问后台。本地没有管理员会话，用户选择稍后自行验收登录后的勾选、确认和实际界面；没有伪造浏览器登录。

## 运行和验收

本地预览已重新构建并重启：http://localhost:56544/zh-CN/admin 。本轮批量功能尚未发布到正式网站，数据库函数已安装。

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run i18n:check
npm run build
# 自行重启时先确认56544端口没有其它预览实例
npm run start -- --port 56544
```

建议先不提交任何操作，只检查以下界面：

1. 登录管理员，进入“店铺资料”，勾选两家，核对选中数量。
2. 点“批量下线”，核对店名后点“取消”，确认没有改变状态。
3. 更换搜索或状态筛选，确认选中数量归零。
4. 手机宽度下检查勾选区域、店名、编辑按钮和确认框没有遮挡。

确实需要改变状态时，再选择明确要处理的店铺并确认，查看每家结果。网络错误不能视为操作失败，先刷新核对实际状态再重试。
