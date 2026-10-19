# 美食分类与推荐筛选调整（2026-10-19）

本轮在现有绿色界面上小步修改，完成本地验收后已于2026-10-19按用户指示正式发布，详见 `docs/production-release-2026-10-19-food-filters.md`。代码仍未提交Git；未修改数据库店铺资料或标签归属。价格文案后续同步改为“人均 ¥31”。

## 用户可见变化

- “饭店”统一改为“美食”。
- 美食下拉面板显示“烧烤／烤肉”，补充粉面、烧腊，以及已有的咖啡、奶茶、果茶、面包烘焙、甜品、蛋糕。
- 粉面、烧腊只匹配已记录的具体分类或人工标签，不根据店名推断，也不会将所有中餐或快餐店归到这两类。没有匹配店铺时显示现有空结果提示。
- 推荐区“高性价比”改为“人均30元内”：仅美食店铺，人均人民币价格大于0且不超过30；未知价格不计入。
- “本周新上”改为“近7天收录”：按真实首次发布时间 `places.published_at` 判断连续168小时，不代表新开业。缺失时间、未来时间、超过7天均不计入，不使用创建或编辑时间补位。
- 新增可展开的“推荐依据”：至少5条评价，真实均分达到4.8为封神之作；达到4.3、低于4.8为强烈推荐。显示分数仍保留一位小数，筛选使用未四舍五入的均分。
- 推荐“全部”为以上条件的并集。低价或新收录不代表高评分。
- 保留旧推荐链接兼容；中文、繁体中文、英文同步调整。

## 主要文件

- 界面：`components/SecondaryFilters.tsx`、`messages/*.json`、`lib/domain/place-types.ts`、`lib/domain/taxonomy.ts`。
- 筛选规则：`lib/search/filter-options.ts`、`food-filters.ts`、`recommendation-filters.ts`、`url-state.ts`、`lib/ranking/confidence.ts`。
- 数据接入：`app/[locale]/page.tsx`、`app/api/places/route.ts`、`lib/mappers/canonical-shop.ts`、`lib/mappers/shop.ts`、`lib/data/canonical-places.ts`、`types/shop.ts`。只读取已有发布时间字段，保留原始人工标签供不同显示语言筛选。
- 回归测试：`tests/components/filter-options.test.ts`、`tests/lib/search/{food-filters,recommendation-filters,url-state}.test.ts`、`tests/lib/mappers/canonical-shop.test.ts`、`tests/lib/data/canonical-places.test.ts`。

## 运行与验证

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run i18n:check
npm run build
# 启动前检查56544端口，避免重复启动
npm run start -- --port 56544
```

已通过379项测试（59个测试文件）、lint、TypeScript、三语言文案检查和生产构建。本地生产预览已重启，地址 `http://localhost:56544/zh-CN?category=food`。

浏览器已验证390像素手机布局、320像素窄屏，以及粉面、烧腊、甜品、咖啡空结果、30元筛选、近7天筛选、规则展开、英文粉面筛选、旧高性价比链接迁移。筛选数量随实际公开店铺数据变化，不使用固定或虚构结果。

## 验收重点与后续

1. 手机点击“美食”，展开“分类”，向下滚动查看咖啡饮品、甜品烘焙。
2. 点击“推荐”，分别试“人均30元内”“近7天收录”，展开“推荐依据”。
3. 如某店缺少具体分类，后续由管理员人工确认并补标签。本轮不自动批量标注，也不新增复杂排名算法。
