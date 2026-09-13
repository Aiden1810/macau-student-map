# 管理员新增与跨城 POI 搜索修复

## 根因与修复

- 线上 `shops` 表撤销了 `authenticated` 的 INSERT，管理员表单仍使用该表。新增迁移仅补 INSERT grant 和 profiles 身份校验的管理员 RLS policy，不开放普通用户或匿名写入。
- 未评分的新店 payload 原来发送 `total_sum: null`，违反线上 NOT NULL。现发送 0，`rating` 保持 null、`rating_count` 保持 0。
- 高德实际上同时查询澳门和珠海，但澳门结果全部排前，且 SDK 实测未返回 cityname，地址不能明确区分城市。现在可以切换搜索范围，混合结果交错展示，无行政字段时补城市前缀。
- 无结果城市独立尝试带城市名的搜索；NO_DATA 按无结果处理，真正的服务错误仍显示错误。

## 本地验收

启动现有本地开发服务后，在用户投稿和管理员新增界面分别执行：

1. 输入“理发”，默认结果前几条应同时出现澳门、珠海地址。
2. 切换“仅珠海”，结果只展示珠海检索返回的分店；再切回“仅澳门”。
3. 选择分店，检查名字、地址、POI ID、经纬度；未确认分店前不要提交。
4. 权限迁移应用前，管理员新增仍会被线上数据库拒绝，这是预期的未发布状态。
5. 迁移应用后，再由管理员提交一条确认真实的新店，检查前台展示和管理员列表。

## 数据库验证和发布边界

- 新迁移：`supabase/migrations/20260913033944_restore_admin_shop_insert.sql`。
- 回归脚本：`supabase/tests/manual/admin_shop_insert.rollback.sql`。无需 pgTAP，要求项目已有管理员；仅读取其 ID 设置事务内身份，不修改用户权限。
- 脚本检查管理员 insert-returning、伪造 user_metadata 的普通用户不能新增、匿名用户不能新增，全部测试数据回滚。
- 尚未应用线上迁移。仅部署前端不能修复表权限；需要另外确认应用数据库迁移。
- 本轮不重构 canonical/legacy 双表，不改用户投稿审核流程，不处理其他 Advisor 技术债。

## 本轮验证记录（2026-09-13）

- 228 个单元测试通过；Lint、TypeScript、i18n（240 keys）和 diff 空白检查通过。
- 本地投稿界面实测“理发”返回澳门和珠海交错结果；管理员复用同一个搜索组件。
- 用户投稿提交时会按坐标补 canonical region：珠海主城区为 `zhuhai`，横琴为 `hengqin`。
- 线上只读查询确认 authenticated INSERT=false，且旧表仅有 SELECT/UPDATE/DELETE 管理员策略。
- 线上回滚脚本与 Advisor 检查尝试遇到 Supabase CLI TransportError，未执行成功，不能标记为通过。
- 未提交、推送、部署，也未应用线上权限迁移。管理员实际新增、管理员/普通用户/匿名用户权限回归仍待连接恢复并完成迁移验证。
