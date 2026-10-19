# 城觅 AI 聊天助手：接入与验收

## 使用方式

打开首页，桌面点击顶部“AI助手”，手机点击地图左下方的“AI助手”，在悬浮聊天窗口里直接发店名和问题。手机列表展开时先点击底部“查看地图”即可看到助手入口。不需要离开店铺列表和地图，也不需要预先勾选店铺。例如：

> 从保利国际广场出发，到二师兄猪脚饭和穆味王分别打车、公交、步行多久？

AI解析店名和起点；已上线目录的唯一门店可以直接识别。同名门店或地图搜索结果会在回复里显示门店名和真实地址供确认；起点也在回复里确认。说“从我这里出发”时，点击“使用当前位置”才会请求定位，也可以搜索起点。用户明确要求重新定位时会重新确认，不沿用旧位置。

确认后，回复为每家店显示三种方式的实际高德路线时间、路线长度、公交线路/步行距离，以及对应方式的导航链接。没有返回路线的方式单独提示，不用AI估算数字。

距离统一按易读单位显示：不足1公里显示整数米，1～10公里保留最多1位小数，10公里以上取整公里。例如348米、1.6公里、16公里；公交方案中的附带步行距离也使用此规则。地图原始数据与导航坐标不变。

就餐推荐仍可直接询问：

> 穆味王和二师兄猪脚饭，我们四个人，人均40元，想吃粉面，推荐哪家？
>
> 改成两个人，人均30元。

追问沿用已确认门店、出发地以及最近6条用户问题。点“新对话”先保存旧对话及草稿，再开启独立上下文；点“停止回答”取消当前结果写入。点“收起聊天”或按Esc只隐藏浮窗，草稿、对话和正在处理的回答仍会保留，重新打开即可继续。Enter发送，Shift+Enter换行，中文输入法确认候选字不会误发送。

标题栏的历史图标打开“历史对话”：按第一条问题自动生成标题，可以继续或删除对话。记录仅保存在当前浏览器（最多20段，每段保留最近80条消息），刷新或离开首页后仍可恢复最近一段和各自草稿。恢复后标注“历史回答”，重新提问会读取最新资料；路线只保留带查询时间的文字摘要，精确出发地坐标不持久化，需要重新确认。浏览器禁止保存、记录损坏或空间不足时会提示，聊天仍可继续。当前版本没有登录账号同步；清除浏览器数据会移除记录。具体边界见 [本地历史对话说明](assistant-history-2026-10-18.md)。

桌面为右下角局部浮窗，背景地图和筛选仍可操作；手机为底部面板，展开时由原生dialog管理焦点和背景交互。组件首次打开才加载，收起时不卸载。旧的 `/{locale}/assistant` 地址会跳回首页并自动打开浮窗。

## API Key 与本地启动

项目根目录 `.env.local`：

```dotenv
DEEPSEEK_API_KEY=你自己的DeepSeek官方APIKey
DEEPSEEK_MODEL=deepseek-flash
```

不要添加 `NEXT_PUBLIC_` 前缀或把真实Key写入文档。该文件已被Git忽略。模型与官方协议：[模型列表](https://api-docs.deepseek.com/api/list-models/)、[JSON输出](https://api-docs.deepseek.com/guides/json_mode/)。现有 `NEXT_PUBLIC_AMAP_WEB_KEY`、`NEXT_PUBLIC_AMAP_SECURITY_CODE` 继续使用，不需要换成REST Key。

Windows PowerShell：

```powershell
npm install
npm run dev -- --port 56544
```

端口已有服务时先关闭原服务。修改Key后需重启。访问：

- `http://localhost:56544/zh-CN`
- `http://localhost:56544/zh-MO`
- `http://localhost:56544/en`

没有Key时会在聊天中说明尚未接入，不伪造AI回答。2026-10-18已在Vercel配置生产环境的DeepSeek服务端变量，并正式发布手机界面、AI浮窗及本地历史对话；未修改店铺数据。线上地址、验证及回退方法见 [正式发布记录](production-release-2026-10-18.md)。

## 数据与实现边界

- `/api/assistant/chat` 每条消息只调用一次DeepSeek，提取最多4个店名、起点操作和人数/预算/交通偏好。输入最多6条问题，每条1200字符，请求体20KB，模型截止20秒、无自动重试。复用进程内8次/分钟/IP限流；它不能替代多实例共享限流。
- 服务端通过匿名Supabase权限重新读取最多200个已发布地点。名称匹配不把食物标签当作店名；分店以ID区分。确认过的同名门店在追问时按ID保留，同时采用最新目录资料；已下架地点不会用旧目录记录继续推荐。
- 目录之外的门店可以经高德POI搜索、人工确认后比较路线。独立POI保留独立ID与真实地址，默认价格/业态未知；只有完整店名和完整地址都匹配才关联目录事实。没有可靠价格和分类时，不把外部POI当作满足预算的餐厅。
- 目录餐厅缺坐标仍可按已知价格参与就餐推荐。查询路线需要补定位时只确认本次聊天使用的地图地点，不写回店铺坐标。不会把其他分店的价格套用到地图搜索结果。
- 浏览器复用高德JS SDK的Driving/Transfer/Walking。最多同时查询2个目的地，每个目的地3种方式；加载和各查询分别有截止时间。时间使用供应商返回秒数，显示时向上取整为分钟；长度使用真实路线米数，不是直线距离。步行接口和导航模式依据[官方步行示例](https://developer.amap.com/demo/javascript-api-v2/example/walking-route/walk-custom)与[URI导航文档](https://developer.amap.com/api/uri-api/guide/travel/route)。
- DeepSeek只解析需求；门店事实来自服务端目录/确认过的POI，路线来自地图，推荐规则和回答中的数字由代码计算。聊天页面根据这些资料组装结果，不能用于支付或安全决策。精确定位坐标不自动传给DeepSeek，模型接收起点名称、公开候选名称/地址和用户发出的消息。
- 目的城市不明确时跳过公交并说明；跨境路线覆盖可能不全。打车使用驾车预计行程，不含叫车、过关或用餐等待。多人只用于参考餐费计算，座位、套餐和营业状况仍需向商户确认。人民币预算不与澳门元自动换算。
- 保留旧 `/api/assistant` POST 接口以兼容前一版调用；新聊天页面使用新的单次识别流程。

## 主要文件

| 文件 | 作用 |
| --- | --- |
| `components/assistant/PlaceAssistant.tsx` | 聊天布局、消息、底部输入框、快捷提问 |
| `components/assistant/FloatingPlaceAssistant.tsx`、`components/Header.tsx`、`app/[locale]/page.tsx` | 首页开关、懒加载浮窗、保留会话、手机模态/桌面非模态交互 |
| `app/[locale]/assistant/page.tsx` | 旧助手链接跳回首页并打开浮窗 |
| `components/assistant/usePlaceChat.ts`、`chat-types.ts` | 对话上下文、确认流程、取消和过期结果处理 |
| `components/assistant/ConversationHistory.tsx`、`lib/assistant/conversation-history.ts` | 历史列表、版本化本地存储、草稿恢复和历史路线摘要 |
| `components/assistant/ChatOriginPicker.tsx` | 回复内搜索起点/主动定位 |
| `components/assistant/RouteComparisonTable.tsx` | 回复内三种交通方式、分钟、米数和导航 |
| `lib/assistant/format-distance.ts`、`lib/assistant/copy.ts` | 米/公里自动换算、距离取整和三语言单位文案 |
| `lib/assistant/chat.ts`、`chat-model.ts`、`chat-copy.ts` | 店名匹配、DeepSeek结构化识别和三语言文案 |
| `lib/amap/chat-search.ts`、`route-comparison.ts` | 地图搜索、门店关联、三方式路线 |
| `lib/api/place-chat-route.ts`、`app/api/assistant/chat/route.ts` | 新聊天API |
| `lib/assistant/contracts.ts`、`decision.ts`、`answer.ts` | 复用的领域约束、推荐规则与事实回答 |
| `lib/api/place-assistant-route.ts` | 复用的已发布资料读取和限流 |

本轮没有新增依赖；沿用 `ai@7.0.143` 和 `@ai-sdk/deepseek@3.0.67`。

## 验证

```powershell
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

人工验收重点：直接发多家店名；同名分店确认；当前定位授权/明确改起点；三方式分钟和米数；修改人数/预算；地图失败、未知店名、未知价格；回答中途停止或新建对话后，旧结果不能覆盖新对话。

### 2026-10-18 聊天功能初版验证（移入首页之前）

- 50个测试文件、300项测试通过；ESLint、TypeScript与正式构建通过，独立代码审查和修复复核通过。
- 三个语言页面均HTTP 200，包含聊天输入框，不再显示旧的选择表单；浏览器静态JS中没有服务端DeepSeek配置。
- 使用真实Key，在页面直接输入保利国际广场起点与二师兄、穆味王两店，确认起点后，穆味王返回打车约7分钟/2756米、公交约27分钟/3616米、步行约23分钟/1662米。二师兄公交无路线时独立说明，步行正常返回。数字仅为当时查询结果。
- 连续追问4人/人均40元、2人/人均30元，保留店名、起点和粉面偏好，总餐费112元/56元。明确“改用当前位置”后等待用户点击定位，不复用旧起点；验证时没有请求真实物理位置。
- 请求中点“新对话”后清空消息。1280px桌面和390px手机布局已查看，390px下页面宽度未超出视口；临时视口设置在验收后恢复。
- 截图位于 `output/assistant-verification/chat-routes-desktop.png` 和 `chat-mobile.png`。该次验收时本地生产预览使用56544端口，尚未上线；后续已于2026-10-18正式发布，见上方发布记录。

### 首页浮窗验收

- 代码检查、TypeScript与正式构建通过；三个语言的首页均HTTP 200，旧助手地址返回307到对应首页的打开浮窗参数。
- 桌面1360px视口中浮窗为右下520px宽、740px高的非模态窗口；展开时可在背景搜索店铺。输入“穆味王”后收起/重新展开，搜索条件与聊天草稿均保留；验证后恢复了空搜索。
- 用真实Key发送4人/人均40元/粉面推荐后立即收起，重新打开仍收到穆味王、参考总餐费112元的回答；收起不等于停止请求。Esc和“收起聊天”均关闭面板并恢复首页操作。
- 手机390×844视口中，面板从底部展开、宽度不超出屏幕；原生dialog隔离背景焦点，收起后恢复背景滚动。已验证打开状态下切换桌面/手机尺寸保留会话。
- 主页地图与浮窗共用现有高德SDK，浮窗内继续确认保利国际广场起点并成功返回打车、公交、步行三种结果，公里/米格式正常。聊天滚动只发生在浮窗内部。
- 截图：`output/assistant-verification/floating-assistant-desktop.png`、`floating-assistant-mobile.png`。本轮没有新增依赖、修改Key、修改店铺记录或部署。
