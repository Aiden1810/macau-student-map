-- Draft-only data import; no schema changes and no user impersonation.
-- Source: docs/data/takeaway-research-2026-10-17.json.
-- Dry-run with ROLLBACK first. COMMIT is used only for the actual import.
begin;
select pg_advisory_xact_lock(hashtext('takeaway-research-2026-10-17'));
do $import$
declare
  v_batch jsonb := $batch${"batchId":"takeaway-research-2026-10-17","reportedDate":"2026-10-17","sourceType":"user_supplied_ai_research","verification":"用户转交的AI报告，不等于本次独立核验。原报告未附可追溯的链接、截图或坐标。","reportedTotal":43,"providedRows":13,"reportedRemaining":29,"universalIssues":["缺少可溯源的原始链接/截图","所有坐标及图片均未提供，不猜测、不抓取图片","实际配送范围、费用及当前营业状态均待确认","未核实配送至澳门或任何学校"],"independentSources":[{"url":"https://www.china-greentea.com.cn/store-layout","supports":"绿茶餐厅南屏华发商都门店名称与珠海大道8号华发商都A馆3层地址；不证明配送或人均价格","checkedDate":"2026-10-17"}],"rows":[{"key":1,"name":"拌四方·南昌拌粉瓦罐汤（横琴保利店）","address":"珠海市香洲区横琴港澳大道琴朗路88号南塔保利国际广场","price":26,"tags":["chinese-cuisine","fast-food","delivery"],"keywords":["南昌拌粉","瓦罐汤","保利广场","粉面"],"priceClaim":"26元，报告称平台标注人均","platforms":["美团"],"dishes":["南昌拌粉","瓦罐汤"],"hours":"09:00–23:30","claims":"报告称正常营业、横琴片区配送","sources":["报告称高德地图POI，未附链接"],"issues":["09:00–23:30不等于全天营业，未添加该标签"],"region":"hengqin","currency":"CNY","status":"draft","longitude":null,"latitude":null},{"key":2,"name":"虾皇天下（横琴店）","address":"珠海市香洲区横琴华融琴海湾购物中心三楼305","price":71,"tags":["chinese-cuisine","barbecue","delivery","late-night"],"keywords":["小龙虾","炒鸡","牛蛙","海鲜"],"priceClaim":"71元，报告称平台标注人均","platforms":["主流外卖平台（未明确）"],"dishes":["小龙虾","炒鸡","牛蛙"],"hours":"17:00–次日01:00","claims":"报告称正常营业、横琴片区配送","sources":["报告称高德地图POI、2026-09-07学生投稿，未附链接"],"issues":["外卖名虾临天下与虾皇天下是否同店待核实，未确认为别名","公开目录有不同楼层候选，需核对具体POI"],"region":"hengqin","currency":"CNY","status":"draft","longitude":null,"latitude":null},{"key":3,"name":"穆味王·私房牛肉面（华发悦天地店）","address":"珠海市香洲区横琴镇小横琴社区濠江路968号华发悦天地","price":28,"tags":["chinese-cuisine","fast-food","delivery"],"keywords":["牛肉面","青海炒饭","华发悦天地","牛肉炒拉面","面食"],"priceClaim":"28元，报告称平台标注人均","platforms":["美团","淘宝闪购"],"dishes":["牛肉炒拉面","青海炒饭"],"hours":"08:00–22:00","claims":"报告称正常营业、横琴片区配送","sources":["报告称高德地图POI，未附链接"],"issues":["早餐供应未提供菜单证据，未添加该标签"],"region":"hengqin","currency":"CNY","status":"draft","longitude":null,"latitude":null},{"key":4,"name":"左四吹麻辣香锅（励骏庞都店）","address":"珠海市香洲区横琴励骏庞都广场B1楼B003-3号商铺","price":36,"tags":["chinese-cuisine","hot-pot","fast-food","delivery","late-night"],"keywords":["麻辣香锅","冒烤鸭","励骏庞都"],"priceClaim":"36元，报告称平台标注人均","platforms":["美团","淘宝闪购"],"dishes":["麻辣香锅","冒烤鸭"],"hours":"10:00–24:00","claims":"报告称正常营业、横琴片区配送","sources":["报告称高德地图POI，未附链接"],"issues":[],"region":"hengqin","currency":"CNY","status":"draft","longitude":null,"latitude":null},{"key":5,"name":"巴黎贝甜（珠海横琴华发商都店）","nameEn":"Paris Baguette","address":"珠海市香洲区横琴新区琴海路981号横琴华发商都","price":30,"tags":["bread","dessert","cake","delivery"],"keywords":["巴黎贝甜","面包","蛋糕","横琴华发商都","传统奶酪面包"],"priceClaim":"30元，报告称平台标注人均","platforms":["美团闪购"],"dishes":["传统奶酪面包","生日蛋糕"],"hours":"08:00–22:00","claims":"报告称正常营业、横琴片区配送","sources":["报告称高德地图POI，未附链接"],"issues":["与南屏华发商都区分，精确门店名称及POI待核实"],"region":"hengqin","currency":"CNY","status":"draft","longitude":null,"latitude":null},{"key":6,"name":"王春春鸡汤饭（珠海励骏庞都广场店）","address":"珠海市香洲区横琴琴政路励骏庞都B1层B004号","price":26,"tags":["chinese-cuisine","fast-food","delivery"],"keywords":["鸡汤饭","励骏庞都"],"priceClaim":"26元，报告称平台标注人均","platforms":["美团"],"dishes":["招牌鸡汤饭"],"hours":"10:00–22:00","claims":"报告称正常营业、横琴片区配送","sources":["报告称高德地图POI，未附链接"],"issues":[],"region":"hengqin","currency":"CNY","status":"draft","longitude":null,"latitude":null},{"key":7,"name":"二师兄猪脚饭（保利国际广场店）","address":"珠海市香洲区横琴港澳大道琴朗路88号南塔保利国际广场","price":25,"tags":["chinese-cuisine","fast-food","delivery"],"keywords":["猪脚饭","烧腊饭","炖汤","保利广场","烧腊"],"priceClaim":"25元，报告称平台标注人均","platforms":["美团"],"dishes":["猪脚饭","烧腊","炖汤"],"hours":"10:00–21:00","claims":"报告称正常营业、横琴片区配送","sources":["报告称高德地图POI，未附链接"],"issues":["只按保利店建立草稿，不合并或新建未确认的励骏店"],"region":"hengqin","currency":"CNY","status":"draft","longitude":null,"latitude":null},{"key":8,"name":"汉江里·韩国炸鸡（横琴中央汇店）","address":"珠海市香洲区横琴香江路10号A-133号商铺","price":null,"tags":["korean-cuisine","fried-chicken","fast-food","delivery"],"keywords":["韩国炸鸡","汉江里","炸鸡套餐","全翅炸鸡"],"priceClaim":"估算35元，报告称团购/订单折算，未附菜单及计算过程","platforms":["美团","京东外卖"],"dishes":["短根炸鸡（原文，名称待核实）","全翅炸鸡"],"hours":null,"claims":"报告称地址/工商已确认、正常营业、横琴片区配送","sources":["报告称2026-09-04工商注册信息，未附链接"],"issues":["估算35元缺少过程，未写入单个人均字段","工商登记不足以证明当前营业状态"],"region":"hengqin","currency":"CNY","status":"draft","longitude":null,"latitude":null},{"key":9,"name":"潮汕牛肉粿条汤","address":"珠海市香洲区横琴镇石山村4号103商铺","price":29,"tags":["chinese-cuisine","fast-food","delivery","late-night"],"keywords":["牛肉粿条","潮汕汤粉","鲜牛肉汤粉面"],"priceClaim":"29元，报告称平台标注人均","platforms":["美团闪购"],"dishes":["鲜牛肉汤粉面"],"hours":"24小时营业（报告所述，待来源核实）","claims":"报告称正常营业、横琴片区配送","sources":["报告称高德地图POI，未附链接"],"issues":["店名较通用，需要精确POI核对具体商户"],"region":"hengqin","currency":"CNY","status":"draft","longitude":null,"latitude":null},{"key":10,"name":"京无双北京烤鸭（横琴店）","address":"珠海市横琴（详细地址待确认）","price":null,"tags":["chinese-cuisine","fast-food","delivery"],"keywords":["北京烤鸭","椒盐鸭架","京无双"],"priceClaim":"估算33元，报告称订单折算，未附计算过程","platforms":["美团闪购"],"dishes":["精品烤鸭","椒盐鸭架"],"hours":null,"claims":"报告称正常营业、商家自配送10公里内约30分钟","sources":["报告称2026-09-03抖音商家信息，未附链接"],"issues":["详细地址及POI不明","33元为未提供过程的估算，未写入单个人均字段","10公里及30分钟是来源中的宣传/条件，不能作实时送达保证"],"region":"hengqin","currency":"CNY","status":"draft","longitude":null,"latitude":null},{"key":11,"name":"东北盒饭帝国（十字门店）","address":"珠海市香洲区银湾路与通航一路交叉口东北60米","price":14,"tags":["chinese-cuisine","fast-food","delivery"],"keywords":["东北盒饭","十字门外卖","盒饭套餐"],"priceClaim":"14元，报告称平台标注人均","platforms":["美团闪购"],"dishes":["盒饭套餐"],"hours":null,"claims":"报告称正常营业、十字门片区配送","sources":["报告称高德地图POI，未附链接"],"issues":["高性价比属于主观评价，未添加标准标签"],"region":"zhuhai","currency":"CNY","status":"draft","longitude":null,"latitude":null},{"key":12,"name":"绿茶餐厅（珠海南屏华发商都店）","nameEn":"Green Tea Restaurant","address":"珠海市香洲区南屏珠海大道8号华发商都A馆3层","price":null,"tags":["chinese-cuisine","delivery"],"keywords":["绿茶餐厅","南屏华发商都","中式简餐","面包诱惑","绿茶烤鸡"],"priceClaim":"60–80元区间，未擅自取中间值","platforms":["美团"],"dishes":["面包诱惑","绿茶烤鸡"],"hours":"10:00–22:00（报告所述，待来源核实）","claims":"报告称正常营业、南屏/十字门片区配送","sources":["报告称高德地图POI，未附链接"],"issues":["官方目录确认的是南屏分店，不视作十字门分店","人均区间未写入单个人均字段，待选择代表值"],"region":"zhuhai","currency":"CNY","status":"draft","longitude":null,"latitude":null},{"key":13,"name":"濠轩阁（拱北总店）","address":"珠海市香洲区粤华路152号新市花园2栋底层","price":null,"tags":["chinese-cuisine","hot-pot","late-night"],"keywords":["生蚝鸡煲","珠海火锅","濠轩阁","五指毛桃","生蚝"],"priceClaim":"58–103元为多分店混合区间，不能当作拱北总店人均","platforms":[],"dishes":["五指毛桃生蚝鸡煲","生蚝"],"hours":"11:00–次日01:00/02:00（多分店混合，待核实）","claims":"报告称正常营业、香洲主城区配送但平台待确认","sources":["报告称高德地图POI、本地美食攻略，未附链接"],"issues":["仅整理拱北总店，不按多分店描述额外创建记录","未确认早茶服务，未添加相关关键词","外卖平台未知，未添加可外卖标签","价格和营业时间均需核实本分店"],"region":"zhuhai","currency":"CNY","status":"draft","longitude":null,"latitude":null}]}$batch$::jsonb;
  v_row jsonb;
  v_input jsonb;
  v_tag_ids jsonb;
  v_id uuid;
  v_matches uuid[];
  v_inserted integer := 0;
  v_skipped integer := 0;
begin
  if jsonb_array_length(v_batch->'rows') <> 13 then raise exception 'Expected exactly 13 supplied rows'; end if;
  for v_row in select value from jsonb_array_elements(v_batch->'rows') loop
    if v_row->>'status' <> 'draft' or v_row->>'longitude' is not null or v_row->>'latitude' is not null then
      raise exception 'Import must contain drafts with no guessed coordinates';
    end if;
    select jsonb_agg(t.id order by x.ordinality) into v_tag_ids
      from jsonb_array_elements_text(v_row->'tags') with ordinality x(slug,ordinality)
      join public.tags t on t.slug=x.slug and t.is_active;
    if jsonb_array_length(v_tag_ids) is distinct from jsonb_array_length(v_row->'tags') then
      raise exception 'Unknown or inactive tag for %',v_row->>'name';
    end if;
    v_input:=jsonb_build_object(
      'name',v_row->>'name','nameEn',v_row->'nameEn','address',v_row->>'address',
      'categorySlug','food','region',v_row->>'region','longitude',null,'latitude',null,
      'pricePerPerson',v_row->'price','tagIds',v_tag_ids,'searchKeywords',v_row->'keywords','status','draft');
    perform private.assert_place_editor_input(v_input);

    -- Match prior batch rows even after editorial changes. Also skip an existing
    -- normalized name; ambiguity stops the whole transaction instead of overwriting.
    select array_agg(distinct p.id) into v_matches from public.places p
      where regexp_replace(translate(p.name,'（）','()'),'\s+','','g')
        =regexp_replace(translate(v_row->>'name','（）','()'),'\s+','','g')
      or exists(select 1 from public.admin_audit_logs a
        where a.entity_type='place' and a.entity_id=p.id::text
        and a.action='place.import_draft'
        and a.metadata->>'batch_id'=v_batch->>'batchId'
        and a.metadata->>'row_key'=v_row->>'key');
    if coalesce(cardinality(v_matches),0)>1 then raise exception 'Ambiguous duplicate for %',v_row->>'name'; end if;
    if coalesce(cardinality(v_matches),0)=1 then
      v_skipped:=v_skipped+1;
      continue;
    end if;
    insert into public.places(name,name_en,address,category_slug,region,longitude,latitude,
      price_per_person,status,published_at,created_by,search_keywords_manual)
    values(v_input->>'name',v_input->>'nameEn',v_input->>'address','food',v_input->>'region',
      null,null,(v_input->>'pricePerPerson')::numeric,'draft',null,null,
      array(select jsonb_array_elements_text(v_input->'searchKeywords')))
    returning id into v_id;
    insert into public.place_tags(place_id,tag_id)
      select v_id,value::uuid from jsonb_array_elements_text(v_tag_ids);
    insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,note,metadata)
      values(null,'place.import_draft','place',v_id::text,
        '用户提供AI资料导入为待核实草稿；未发布，未模拟管理员身份。',
        jsonb_build_object('batch_id',v_batch->>'batchId','row_key',v_row->>'key',
          'operator','supabase_mcp','source_type',v_batch->>'sourceType',
          'reported_date',v_batch->>'reportedDate','verification',v_batch->>'verification',
          'universal_issues',v_batch->'universalIssues','original',v_row,
          'independent_sources',case when v_row->>'key'='12' then v_batch->'independentSources' else '[]'::jsonb end,
          'after',v_input));
    v_inserted:=v_inserted+1;
  end loop;
  if v_inserted+v_skipped<>13 then raise exception 'Incomplete import'; end if;
end
$import$;
select jsonb_build_object(
  'batch_rows',(select count(*) from public.admin_audit_logs where action='place.import_draft' and metadata->>'batch_id'='takeaway-research-2026-10-17'),
  'drafts',(select count(*) from public.places where status='draft'),
  'published',(select count(*) from public.places where status='published'),
  'places',(select count(*) from public.places),
  'invalid_batch_rows',(select count(*) from public.places p join public.admin_audit_logs a on a.entity_id=p.id::text
    where a.action='place.import_draft' and a.metadata->>'batch_id'='takeaway-research-2026-10-17'
    and (p.status<>'draft' or p.longitude is not null or p.latitude is not null or p.published_at is not null))
) as import_result;
rollback;

