# 城觅手机界面更新（2026-10-18）

## 目标与范围

采用用户选定的第一张深松绿配色，沿用已确认的融合布局。主色 `#245b49`、深色入口 `#193d32`、页面底色 `#f8f9f5`、正文 `#293a31`。价格使用深色文字，不使用促销式红色。

本轮在现有项目上修改展示层，没有新增依赖、修改店铺资料、图片记录、价格、坐标或执行部署。原有 AI API、路线查询、目录读取和管理员操作保持原有实现。

## 文件与职责

| 文件 | 修改原因 |
| --- | --- |
| `tailwind.config.ts`、`app/globals.css` | 集中颜色、中文字体回退及减少动态效果支持 |
| `app/[locale]/page.tsx`、`components/Header.tsx` | 手机浮动搜索、头像菜单、顶部分类；顶部尺寸变化时更新抽屉可用高度 |
| `components/MobileCategoryNav.tsx`（新增） | 独立管理手机分类的显示，沿用现有分类和回调 |
| `components/ShopList.tsx` | 不透明底部抽屉、搜索和分类时展开、固定独立地图按钮；保留桌面列表并限制其滚动区域 |
| `components/MobilePlaceCard.tsx`（新增） | 清楚显示店名、分店、人均、区域和评价状态，分开链接与收藏/定位按钮 |
| `components/PlaceCover.tsx`（新增） | 缺图和加载失败时使用 Lucide 店铺图标，继续显示有效原图 |
| `components/ShopCard.tsx` | 修正桌面长标题挤压评分标签的问题 |
| `components/QuickFilters.tsx`、`SecondaryFilters.tsx` | 统一筛选样式，避免手机重复收藏和数量信息 |
| `components/MapPlaceholder.tsx`、`lib/amap/place-marker.ts` | 深松绿图钉和地图控件；无评价不显示零分；手机选中时只突出图钉，避免详情弹卡和抽屉相互遮挡 |
| `app/[locale]/shop/[id]/page.tsx` | 返回/收藏、分店层级、价格、地址、评价和固定导航底栏；保留取数、鉴权及图片管理逻辑 |
| `components/MobileImageSlider.tsx`、`PlaceNavigationActions.tsx` | 缩小缺图区域、图片失败占位、移动导航底栏及原有复制失败回退 |
| `components/assistant/` 下的展示组件 | 与首页统一主题；聊天请求与会话状态逻辑未修改 |
| `messages/zh-CN.json`、`zh-MO.json`、`en.json` | 补齐新增界面文案，保持同一翻译键集合 |
| `app/layout.tsx`、`app/manifest.ts`、`components/PlaceTypeBadge.tsx` | 统一城觅品牌与颜色；允许用户正常缩放页面 |

## 与设计图的有意差异

- 地图使用真实高德底图，不采用生成图中的示意地理位置；不更改地图业务范围或默认店铺排序。
- 保留全部现有分类，以横向滚动呈现，不新增“更多”菜单。
- 店铺数据与排序沿用实际目录，示意图中的店铺不一定排在第一页。
- 详情底栏沿用现有的“复制地址”和“用高德导航”，不新增另一套定位接口。
- 有真实店铺照片时显示照片，不统一替换为示意占位；完整标签仍可在详情查看。

## 运行和验证

开发模式：`npm run dev -- --port 56544`。

生产预览：先关闭该项目占用 56544 的旧服务，然后运行 `npm run build` 和 `npm run start -- --port 56544`。不要同时启动两个同端口服务，也不要在运行中的生产服务目录上覆盖构建后继续使用旧进程。

检查命令：

```powershell
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run i18n:check
npm run build
```

人工检查：手机 320/360/390px 宽度、桌面 1360px；分类与搜索、展开/收起、无结果恢复、长店名、缺图/坏图、定位、详情复制地址和导航链接、AI 面板开关及草稿保留。真实手机键盘、安全区域和系统浏览器差异仍建议在真机补测。截图在 `output/mobile-ui-verification-2026-10-18/`，视觉核对记录在根目录 `design-qa.md`。

## 后续可改进

确认本轮界面后，再按真机反馈微调字号、抽屉高度和筛选密度。桌面页面以兼容与排版修正为主，没有按手机稿重新设计。
