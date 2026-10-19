type Locale = "zh-CN" | "zh-MO" | "en";
export function assistantCopy(locale: string) {
  const text = (cn: string, mo: string, en: string) =>
    locale === "en" ? en : locale === "zh-MO" ? mo : cn;
  return {
    locale: (["zh-CN", "zh-MO", "en"].includes(locale)
      ? locale
      : "zh-CN") as Locale,
    title: text("AI 选店助手", "AI 選店助手", "Your place decision assistant"),
    nav: text("AI 助手", "AI 助手", "AI chat"),
    subtitle: text(
      "比较怎么去，再决定去哪家。",
      "比較怎樣去，再決定去哪家。",
      "Compare the journey. Choose your next stop.",
    ),
    back: text("返回地图", "返回地圖", "Back to the map"),
    select: text(
      "01 · 选择想比较的店铺",
      "01 · 選擇想比較的店舖",
      "01 · Choose your places",
    ),
    selectHint: text(
      "选择 1–4 家；同名店请核对分店和地址。",
      "選擇 1–4 家；同名店請核對分店和地址。",
      "Choose 1–4 places. Check the branch and address.",
    ),
    search: text(
      "搜索店名、餐饮类型",
      "搜尋店名、餐飲類型",
      "Search places or cuisines",
    ),
    noResults: text(
      "没有匹配的已上线店铺",
      "沒有匹配的已上線店舖",
      "No matching published places",
    ),
    priceUnknown: text("人均待确认", "人均待確認", "Price unknown"),
    addressUnknown: text("地址待补充", "地址待補充", "Address pending"),
    coordinatesMissing: text(
      "缺少坐标，暂不能查路线",
      "缺少座標，暫不能查路線",
      "Coordinates missing; routes unavailable",
    ),
    selected: text("已选", "已選", "Selected"),
    remove: text("移除", "移除", "Remove"),
    origin: text(
      "02 · 从哪里出发",
      "02 · 從哪裏出發",
      "02 · Where are you starting?",
    ),
    originHint: text(
      "请选择具体地点；修改店铺或出发地会清除旧结果。",
      "請選擇具體地點；修改店舖或出發地會清除舊結果。",
      "Confirm a specific origin. Changing places or origin clears old results.",
    ),
    originSearch: text(
      "搜索出发地点",
      "搜尋出發地點",
      "Search your starting point",
    ),
    originPlaceholder: text(
      "例如：澳门城市大学，再选择具体校区或校门",
      "例如：澳門城市大學，再選擇具體校區或校門",
      "Search a campus, gate, or another specific location",
    ),
    searching: text("正在查询高德…", "正在查詢高德…", "Searching AMap…"),
    emptyPoi: text(
      "暂无匹配，请换一个更具体的名称",
      "暫無匹配，請換一個更具體的名稱",
      "No matches. Try a more specific name.",
    ),
    poiFailed: text(
      "地图搜索失败，请重试",
      "地圖搜尋失敗，請重試",
      "Map search failed. Please retry.",
    ),
    unnamed: text("未命名地点", "未命名地點", "Unnamed place"),
    poiId: text("地点编号", "地點編號", "Place ID"),
    locate: text("使用当前位置", "使用目前位置", "Use my current location"),
    locating: text("正在定位…", "正在定位…", "Locating…"),
    locationError: text(
      "未能确认当前位置，请搜索出发地点，或检查定位权限。",
      "未能確認目前位置，請搜尋出發地點，或檢查定位權限。",
      "Could not confirm your location. Search an origin or check location permissions.",
    ),
    currentLocation: text("当前位置", "目前位置", "Current location"),
    compare: text(
      "比较打车和公交时间",
      "比較打車和巴士時間",
      "Compare taxi and public transit",
    ),
    comparing: text(
      "正在查询真实路线…",
      "正在查詢實際路線…",
      "Checking live routes…",
    ),
    routes: text("路线比较", "路線比較", "Journey comparison"),
    place: text("店铺", "店舖", "Place"),
    price: text(
      "人均参考（人民币）",
      "人均參考（人民幣）",
      "Reference price (CNY/person)",
    ),
    taxi: text("打车行程", "打車行程", "Taxi journey"),
    transit: text("公交 / 巴士", "公交 / 巴士", "Public transit"),
    walking: text("步行", "步行", "Walking"),
    minutes: text("分钟", "分鐘", "min"),
    walk: text("步行约", "步行約", "Walk about"),
    metres: text("米", "米", "m"),
    kilometres: text("公里", "公里", "km"),
    navigate: text("查看路线", "查看路線", "Open route"),
    no_route: text(
      "高德未返回可用路线",
      "高德未返回可用路線",
      "No available route returned",
    ),
    timeout: text("查询超时，可重试", "查詢逾時，可重試", "Timed out; retry"),
    unknown_city: text(
      "目的城市待确认，暂不能查公交",
      "目的城市待確認，暫不能查巴士",
      "Destination city unknown; transit unavailable",
    ),
    error: text(
      "路线服务暂不可用",
      "路線服務暫不可用",
      "Route service unavailable",
    ),
    missing_coordinates: text(
      "店铺缺少坐标",
      "店舖缺少座標",
      "Place has no coordinates",
    ),
    notQueried: text("待查询", "待查詢", "Not queried"),
    routeError: text(
      "暂时无法查询路线，请重试；仍可按价格和品类比较。",
      "暫時無法查詢路線，請重試；仍可按價格和品類比較。",
      "Routes are unavailable. You can still compare known prices and cuisines.",
    ),
    routeNote: text(
      "高德路线预估，出发时间为查询时刻；打车按驾车行程估计，不含候车、过关或用餐时间。跨境路线和公交覆盖可能不完整。",
      "高德路線預估，出發時間為查詢時刻；打車按駕車行程估計，不含候車、過關或用餐時間。跨境路線和巴士覆蓋可能不完整。",
      "AMap estimates at query time. Taxi times use driving routes and exclude pickup, border clearance and dining. Cross-border and transit coverage may be incomplete.",
    ),
    updated: text("查询时间", "查詢時間", "Queried at"),
    chat: text(
      "03 · 让 AI 帮你选",
      "03 · 讓 AI 幫你選",
      "03 · Ask for a recommendation",
    ),
    chatHint: text(
      "告诉我人数、想吃什么、人均预算，以及更在意价格还是路程。",
      "告訴我人數、想吃甚麼、人均預算，以及更在意價格還是路程。",
      "Tell me your group size, food preferences, budget per person, and whether price or travel time matters more.",
    ),
    question: text("输入你的问题", "輸入你的問題", "Your question"),
    placeholder: text(
      "我们四个人，想吃粉面，人均40元以内，哪家更合适？",
      "我們四個人，想吃粉麵，人均40元以內，哪家更合適？",
      "Four of us want noodles, within CNY 40 per person. Which place fits best?",
    ),
    travelPrompt: text(
      "这几家店分别打车和坐公交需要多久？",
      "這幾家店分別打車和坐巴士需要多久？",
      "How long does it take to reach each place by taxi and transit?",
    ),
    recommendPrompt: text(
      "我们四个人，人均40元以内，更推荐哪家？",
      "我們四個人，人均40元以內，更推薦哪家？",
      "We are four people, within CNY 40 each. Which place would you recommend?",
    ),
    send: text("发送问题", "傳送問題", "Ask assistant"),
    thinking: text("正在分析…", "正在分析…", "Comparing…"),
    reset: text("清空对话", "清空對話", "Clear conversation"),
    unconfigured: text(
      "AI 尚未接入，路线比较可以先使用。",
      "AI 尚未接入，路線比較可以先使用。",
      "AI is not connected yet. Route comparison is available independently.",
    ),
    checking: text(
      "正在检查 AI 状态…",
      "正在檢查 AI 狀態…",
      "Checking AI availability…",
    ),
    ready: text("DeepSeek 已接入", "DeepSeek 已接入", "DeepSeek connected"),
    requestError: text(
      "AI 暂未完成分析，请重试；已有路线结果会保留。",
      "AI 暫未完成分析，請重試；已有路線結果會保留。",
      "Analysis failed. Please retry; existing route results are preserved.",
    ),
    rateLimit: text(
      "请求较频繁，请稍后再试。",
      "請求較頻繁，請稍後再試。",
      "Too many requests. Please try again shortly.",
    ),
    loading: text("正在读取店铺…", "正在讀取店舖…", "Loading places…"),
    loadError: text(
      "店铺加载失败，请重试。",
      "店舖載入失敗，請重試。",
      "Places could not be loaded. Please retry.",
    ),
    retry: text("重试", "重試", "Retry"),
    choosePlaces: text(
      "请先选择至少一家店铺。",
      "請先選擇至少一家店舖。",
      "Select at least one place first.",
    ),
    chooseOrigin: text(
      "请先确认出发地，再查询交通时间。",
      "請先確認出發地，再查詢交通時間。",
      "Confirm your origin before comparing travel times.",
    ),
    recommend: text("更推荐", "更推薦", "Recommended"),
    noMatch: text(
      "当前候选中，没有可确认同时满足预算和品类要求的店铺。可以调整条件或更换候选；价格未知不会视为符合预算。",
      "目前候選中，沒有可確認同時滿足預算和品類要求的店舖。可以調整條件或更換候選；價格未知不會視為符合預算。",
      "None of the selected places can be confirmed to meet both your budget and food preferences. Adjust the criteria or candidates. Unknown prices do not count as within budget.",
    ),
    currency: text(
      "平台人均参考使用人民币。请给出人民币预算，我不会自行猜测汇率。",
      "平台人均參考使用人民幣。請提供人民幣預算，我不會自行猜測匯率。",
      "Prices are recorded in CNY. Please provide a CNY budget; I will not guess an exchange rate.",
    ),
    partySize: text(
      "这是整餐总预算吗？请补充人数，才能换算为人均预算。",
      "這是整餐總預算嗎？請補充人數，才能換算為人均預算。",
      "For a total budget, please provide your group size so it can be converted to a per-person budget.",
    ),
    missingRoutes: text(
      "还没有足够的可用路线，暂不能判断哪家到达最快。请确认出发地并重新查询。",
      "還沒有足夠的可用路線，暫不能判斷哪家到達最快。請確認出發地並重新查詢。",
      "There are not enough available routes to choose the fastest destination. Confirm the origin and retry.",
    ),
    travelAnswer: text(
      "各家打车和公交的高德查询结果见路线表。没有返回路线的项目不能估算时间。",
      "各家打車和巴士的高德查詢結果見路線表。沒有返回路線的項目不能估算時間。",
      "The route table shows the returned taxi and transit estimates. Missing routes cannot be assigned an estimated time.",
    ),
    clarify: text(
      "请围绕所选店铺询问交通时间或用餐推荐。提到新的店铺或出发地时，请先在上方选择具体地点。",
      "請圍繞所選店舖詢問交通時間或用餐推薦。提到新的店舖或出發地時，請先在上方選擇具體地點。",
      "Ask about travel times or choosing among the selected places. Select any new place or origin above before comparing it.",
    ),
    partial: text(
      "部分路线缺失，交通结论只覆盖已查到的路线。",
      "部分路線缺失，交通結論只涵蓋已查到的路線。",
      "Some routes are missing; travel conclusions cover only the available routes.",
    ),
    reference: text("人均参考", "人均參考", "Reference per person"),
    groupTotal: text(
      "全组参考餐费",
      "全組參考餐費",
      "Reference food total for the group",
    ),
    budget: text("人均预算", "人均預算", "Budget per person"),
    food: text("想吃", "想吃", "Food preference"),
    people: text("人数", "人數", "Group size"),
    cheapest: text(
      "优先比较了已知价格。",
      "優先比較了已知價格。",
      "Known prices were prioritised.",
    ),
    fastest: text(
      "优先比较了所选出行方式的可用行程时间。",
      "優先比較了所選出行方式的可用行程時間。",
      "Available travel times for your chosen transport were prioritised.",
    ),
    balanced: text(
      "在符合已知预算、品类条件的候选中，综合参考价格和可用路线选择。",
      "在符合已知預算、品類條件的候選中，綜合參考價格和可用路線選擇。",
      "The choice balances reference prices and available routes among candidates meeting the known budget and food criteria.",
    ),
    caveat: text(
      "餐费为参考，不含交通费；座位、营业时间、等位和多人套餐适用性尚未确认。过敏或饮食禁忌请向商家核实。",
      "餐費為參考，不含交通費；座位、營業時間、輪候和多人套餐適用性尚未確認。過敏或飲食禁忌請向商家核實。",
      "Food totals are indicative and exclude transport. Seats, opening hours, queues and group-menu suitability are unconfirmed. Confirm allergies or dietary restrictions with the venue.",
    ),
  };
}
export type AssistantCopy = ReturnType<typeof assistantCopy>;
