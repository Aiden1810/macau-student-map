import { assistantCopy } from "./copy";
export function chatCopy(locale: string) {
  const t = (cn: string, mo: string, en: string) =>
    locale === "en" ? en : locale === "zh-MO" ? mo : cn;
  return {
    ...assistantCopy(locale),
    title: t("城觅 AI", "城覓 AI", "Chengmi AI"),
    newChat: t("新对话", "新對話", "New chat"),
    historyTitle: t("历史对话", "歷史對話", "Chat history"),
    historyEmpty: t("还没有历史对话", "還沒有歷史對話", "No conversations yet"),
    historyLocal: t("仅保存在当前浏览器，最多保留20段对话。清除浏览器数据后会移除。", "僅儲存在目前瀏覽器，最多保留20段對話。清除瀏覽器資料後會移除。", "Saved in this browser only, up to 20 chats. Clearing browser data removes them."),
    deleteChat: t("删除对话", "刪除對話", "Delete chat"),
    historyNotice: t("正在查看历史记录。继续提问会重新读取店铺资料和路线，出发地需要重新确认。", "正在查看歷史記錄。繼續提問會重新讀取店舖資料及路線，出發地需要重新確認。", "Viewing a saved chat. Follow-ups refresh place facts and routes; please confirm your origin again."),
    historyAnswer: t("历史回答", "歷史回答", "Saved answer"),
    historyInterrupted: t("上次回答未完成。可以重新发送问题继续。", "上次回答未完成。可以重新傳送問題繼續。", "The previous response was interrupted. Send the question again to continue."),
    historyConfirmation: t("上次确认尚未完成，请重新发送问题以继续确认。", "上次確認尚未完成，請重新傳送問題以繼續確認。", "Confirmation was not completed. Send your question again to confirm the details."),
    historyUnavailable: t("浏览器暂时无法保存历史，当前对话仍可使用；刷新后可能丢失。", "瀏覽器暫時無法儲存歷史，目前對話仍可使用；重新整理後可能遺失。", "This browser cannot save history right now. You can keep chatting, but a refresh may lose it."),
    historyDraft: t("草稿", "草稿", "Draft"),
    close: t("关闭", "關閉", "Close"),
    minimize: t("收起聊天", "收起聊天", "Minimise chat"),
    session: t("当前对话", "目前對話", "Current conversation"),
    helper: t("出行与选店助手", "出行與選店助手", "Travel & dining assistant"),
    welcome: t(
      "想去哪，聊聊就好。",
      "想去哪，聊聊就好。",
      "Where to? Let’s talk.",
    ),
    welcomeHint: t(
      "直接告诉我店名和出发地，我来比较打车、公交和步行。",
      "直接告訴我店名和出發地，我來比較打車、巴士和步行。",
      "Tell me the places and your starting point. I’ll compare taxi, transit and walking.",
    ),
    messagePlaceholder: t(
      "输入店名和问题，例如：从保利广场到二师兄、穆味王分别要多久？",
      "輸入店名和問題，例如：從保利廣場到二師兄、穆味王分別要多久？",
      "Type place names and a question. Where are you starting from?",
    ),
    inputLabel: t("给城觅 AI 发消息", "給城覓 AI 發訊息", "Message Chengmi AI"),
    sendLabel: t("发送消息", "傳送訊息", "Send message"),
    stop: t("停止回答", "停止回答", "Stop response"),
    stopped: t(
      "已停止，可以继续发送消息。",
      "已停止，可以繼續傳送訊息。",
      "Stopped. You can send another message.",
    ),
    configured: t(
      "DeepSeek · 已配置",
      "DeepSeek · 已設定",
      "DeepSeek · configured",
    ),
    notConfigured: t("尚未接入", "尚未接入", "Not configured"),
    typing: t(
      "正在理解你的问题…",
      "正在理解你的問題…",
      "Understanding your question…",
    ),
    finding: t(
      "正在查找具体门店和出发地…",
      "正在尋找具體門店及出發地…",
      "Finding branches and your starting point…",
    ),
    routing: t(
      "正在查询打车、公交和步行路线…",
      "正在查詢打車、巴士和步行路線…",
      "Checking taxi, transit and walking routes…",
    ),
    askNames: t(
      "把想比较的店名告诉我吧，一次可以比较最多4家。也可以一起说出发地、人数和预算。",
      "把想比較的店名告訴我吧，一次可以比較最多4家。也可以一起說出發地、人數和預算。",
      "Tell me up to 4 place names. You can include an origin, group size and budget.",
    ),
    helpReply: t(
      "我可以比较几家店的打车、公交、步行时间和距离，也可以结合人数、预算和想吃的东西推荐一家。直接发店名就可以。",
      "我可以比較幾家店的打車、巴士、步行時間和距離，也可以結合人數、預算及想吃的東西推薦一家。直接傳送店名就可以。",
      "I can compare taxi, transit and walking journeys, or help choose a place for your group and budget. Just type the place names.",
    ),
    confirmPlace: t(
      "请确认这家店的具体门店：",
      "請確認這家店的具體門店：",
      "Please confirm the exact branch:",
    ),
    notFound: t(
      "暂时没有找到这家店。请补充完整店名、所在城市或分店名称后再发给我。",
      "暫時未找到這家店。請補充完整店名、所在城市或分店名稱後再傳給我。",
      "I couldn’t find that place. Send its full name, city or branch.",
    ),
    originQuestion: t(
      "从哪里出发？可以使用当前位置，或者搜索并确认一个地点。",
      "從哪裏出發？可以使用目前位置，或者搜尋並確認一個地點。",
      "Where are you starting from? Use your current location or confirm a place below.",
    ),
    originConfirm: t(
      "请确认你说的出发地点：",
      "請確認你說的出發地點：",
      "Please confirm your starting point:",
    ),
    originButton: t("设置出发地", "設定出發地", "Set origin"),
    originFrom: t("从", "從", "From"),
    routeIntro: t(
      "我查到了下面的路线，三种出行方式分别列在每家店下面。",
      "我查到以下路線，三種出行方式分別列在每家店下面。",
      "Here are the routes, with three travel modes for each place.",
    ),
    routesFailed: t(
      "地图暂时没有返回路线，请稍后重试；我不会用猜测的时间代替。",
      "地圖暫時未返回路線，請稍後重試；我不會用猜測時間代替。",
      "The map service did not return routes. Please retry; I won’t invent travel times.",
    ),
    mapPlace: t(
      "高德地点 · 人均待确认",
      "高德地點 · 人均待確認",
      "AMap place · price unknown",
    ),
    sendHint: t(
      "Enter 发送，Shift + Enter 换行",
      "Enter 傳送，Shift + Enter 換行",
      "Enter to send · Shift + Enter for a new line",
    ),
    footer: t(
      "路线来自高德；实际路况、候车和过关时间可能变化。",
      "路線來自高德；實際路況、候車和過關時間可能變化。",
      "Routes by AMap. Traffic, waiting and border times may vary.",
    ),
    exampleTravel: t(
      "从保利国际广场出发，到二师兄猪脚饭和穆味王分别打车、公交、步行多久？",
      "從保利國際廣場出發，到二師兄豬腳飯和穆味王分別打車、巴士、步行多久？",
      "From Poly International Plaza, compare taxi, transit and walking to 二师兄猪脚饭 and 穆味王.",
    ),
    exampleFood: t(
      "穆味王和二师兄猪脚饭，我们四个人，人均40元，想吃粉面，推荐哪家？",
      "穆味王和二師兄豬腳飯，我們四個人，人均40元，想吃粉麵，推薦哪家？",
      "Compare 穆味王 and 二师兄猪脚饭: four people, CNY40 each, wanting noodles. Which would you choose?",
    ),
    exampleTravelTitle: t("比较怎么去", "比較怎樣去", "Compare journeys"),
    exampleFoodTitle: t("一起选家店", "一起選家店", "Choose a place"),
  };
}
export type ChatCopy = ReturnType<typeof chatCopy>;
