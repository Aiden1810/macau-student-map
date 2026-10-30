# 地点数据统一：实施与发布记录

日期：2026-10-30（澳门时间）。用户明确授权处理新旧地点结构并存问题。本次不创建小程序、不更改品牌名、不删除旧数据库表。

> 后续发布进度见 [2026-10-30 集成发布记录](production-release-2026-10-30.md)。以下“尚未部署”描述的是本轮本地验证结束时的状态。

## 现状核实

通过本地环境配置确认连接 Macau-Student-Map 项目后，执行只读核对：

| 项目 | 执行前 |
| --- | --- |
| shops | 0 |
| places | 56（10 已发布、46 草稿） |
| places.legacy_shop_id 非空 | 0 |
| favorites / reviews / shop_action_events | 均为 0 |

所以本次不是搬运两批商户，而是退役已经没有数据的旧访问路径。地点 ID、内容、发布状态、图片、收藏与评价均保留。

## 代码修改

- 首页只请求 `/api/places`，不再同时读取、合并 shops。初始失败明确显示错误；静默刷新失败保留上一份完整列表。
- 详情只请求 `/api/places/[id]`，公开状态由服务端校验，不再先直接查旧表。管理员的图片维护统一进入现有 PlaceEditor。
- 后台所有地点维护集中到既有 PlacesManager / PlaceEditor；删除旧表的新增、修改、删除、批量字段补全和 Realtime 订阅。
- 保留工作台、投稿、评价、反馈、用户、用量、搜索分析和地点使用统计；统计的地点改读统一地点接口，评价改读 reviews。
- `/api/shops` 只保留旧 HTTP 响应格式作为兼容适配，实际仍读取 places 和同一份公共缓存，避免已打开的旧版页面丢失图片、价格和优惠。
- 移除未再使用的 AdminImageManager、legacy-shops/public-legacy-shops、双源合并模块及仅测试这些已删除逻辑的用例；相关业务行为由新回归测试覆盖。

`Shop` 类型、`/shop/[id]` URL 和 `favorites.shop_id` 等历史命名保留，它们现在是现有界面/API 的字段名称，不代表继续访问 shops 表。`legacy_image_urls` 是 places 内现存图片地址字段，同样不是第二套地点存储。

## 数据库配套

迁移：`supabase/migrations/20261029163254_retire_legacy_place_paths.sql`（文件名由 Supabase CLI 生成）。

1. 在同一事务中锁定 shops 与 places，检查 shops 为空且没有未处理的历史地点关联；不符合就报错并整笔回滚。
2. 操作事件的 `shop_id` 外键改为关联 places，保持字段名和原有记录。
3. 撤销旧 shops 对普通客户端的新增、修改、删除等写权限，防止新资料再次进入旧表。
4. 保留 shops 的原 SELECT 权限，兼容当前仍在运行或回退后的旧版详情查询；service_role / 数据库所有者的恢复能力不变。

没有执行其他任务尚未发布的媒体权限迁移。测试环境若仍有旧数据，不应强行删除后执行本迁移，而应先制定保留所有字段及历史关系的数据迁移。

### 迁移前结构快照及回退

执行前事件外键为 `shop_action_events_shop_id_fkey`，指向 shops(id) ON DELETE CASCADE。shops 权限：anon 仅 SELECT；authenticated 有 SELECT/INSERT/UPDATE/DELETE。

回退应用代码可继续读取空旧表，并经原有详情回退读取 places。通常不需要回退数据库；新的事件外键可以兼容旧客户端记录真实地点操作。

如确需回退数据库，先确认迁移后是否已经产生新地点事件；不可把无法关联旧表的事件删除来强行回退。以下 SQL 只应由管理员在确认目标环境后执行，本文件并未自动执行回退：

```sql
begin;
lock table public.shops, public.shop_action_events in share row exclusive mode;
do $$ begin
  if exists (select 1 from public.shop_action_events e
    where not exists (select 1 from public.shops s where s.id=e.shop_id)) then
    raise exception 'Canonical action events exist; keep the new foreign key';
  end if;
end $$;
alter table public.shop_action_events drop constraint shop_action_events_place_id_fkey;
alter table public.shop_action_events add constraint shop_action_events_shop_id_fkey
  foreign key (shop_id) references public.shops(id) on delete cascade;
grant insert, update, delete on public.shops to authenticated;
commit;
```

## 验证记录

- 变更前基线：111 文件、706 测试通过。
- 已观察首页双源、详情旧入口、后台旧来源、旧响应字段兼容及数据库守卫测试在修复前失败。
- 本轮最终测试：112 文件、693 测试通过。数量减少源于退役重复兼容函数及旧编辑器专用测试，并新增单一来源、状态筛选、旧客户端兼容和数据库事务测试。
- TypeScript、ESLint、多语言 287 个键检查通过。
- 正式构建通过；使用独立构建目录，构建生成的 tsconfig/next-env 改动已恢复到执行前状态。
- 数据库迁移已成功执行，远端记录版本为 `20261029164622`，名称 `retire_legacy_place_paths`。本地文件名由 CLI 生成，与连接器记录时间不同，不应因此重置数据库或修复其他迁移历史。
- 执行后地点仍为 56（10 已发布、46 草稿），shops 0；收藏/评价/事件仍为 0。确认旧表 SELECT 保留，客户端 INSERT/UPDATE/DELETE 均不可用，事件外键已指向 places。
- 本地正式构建连接真实数据库：地点列表 200/10 条，详情 200，旧 HTTP 接口 200 且图片/价格字段一致，草稿详情 404，匿名管理员接口 401。
- Playwright 实测：首页显示 10 个地点，搜索“穆味王”得到 1 个地点；详情显示对应资料。浏览器请求只使用 /api/places 及其详情/评价接口，没有旧 shops 读取；首页控制台 0 errors。
- 独立审查发现并修复了统计状态选项与旧客户端字段兼容问题，针对性测试先失败再通过，复核无本轮交付阻断项。
- 本地预览为 `http://localhost:56588/zh-CN`；新代码尚未推送或正式部署。数据库迁移已兼容线上旧版详情回退流程。

## 本地运行与人工验收

```powershell
Set-Location 'D:\项目\CityU_Food'
npm run dev
```

打开 `http://localhost:3000/zh-CN`，验证：

1. 首页、搜索和详情能看到同一地点；下架/草稿地点不能通过公开详情读取。
2. 管理员通过后台的“店铺资料”新增、编辑、管理图片、上下线；首页不再保留直写旧表的审核/删除按钮。
3. 详情管理员入口打开统一资料编辑器，保存后刷新显示最新资料。
4. “更多工具”的地点统计能切换已上线/草稿/已下架，统计失败有反馈。
5. 账号收藏、用户评价和投稿继续使用既有功能。

本轮没有管理员登录凭证，不能把组件测试当作真实账号后台端到端验收。发布前应按以上步骤做登录验收。
