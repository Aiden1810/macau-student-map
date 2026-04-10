-- seed-shops-from-video-notes.sql
-- 来源：用户提供的 12 条探店投稿
-- 目的：将店铺基础信息与可筛选字段写入 shops
-- 特性：可重复执行（按 name 去重）

-- 先做店名标准化，避免因历史别名产生重复
update public.shops
set name = '秋涧'
where name = '秋涧日本料理';

with seed(name, address, category, shop_type, rating_label, tags, features, review_text, student_discount, status) as (
  values
    (
      '秋涧',
      '澳门（地图待补充详细地址）',
      'food',
      '正餐',
      '封神之作',
      array['日韩料理','西餐 / 简餐'],
      array['📸 拍照出片'],
      '作者高频回访店。汁煎牛仔骨分量足且入味；火炙帆立贝寿司与和牛寿司香气强；盐烤黑虎虾Q弹，烤三文鱼鳍脂香明显，整体稳定优秀。',
      null,
      'verified'
    ),
    (
      'mondays struggle',
      '澳门（地图待补充详细地址）',
      'drink',
      '饮品甜点',
      '强烈推荐',
      array['咖啡','高性价比'],
      array['💻 适合赶Due'],
      '咖啡风味选择多，标准杯约 25 MOP，性价比高；店内有烘焙赛相关奖项展示，适合学生日常复购。',
      null,
      'verified'
    ),
    (
      '一见葡挞',
      '澳门（地图待补充详细地址）',
      'food',
      '快餐小吃',
      '还行吧',
      array['葡挞 / 烘焙','炸物 / 小食'],
      array['🍜 一人食友好'],
      '小食整体偏常规；葡挞偏甜且香气不足；黑椒鸡扒蛋包表现亮眼，面包与鸡排组合有惊喜。',
      null,
      'verified'
    ),
    (
      '珠澳小厨',
      '澳门（用户提供地址，地图暂无官方收录）',
      'food',
      '快餐小吃',
      '强烈推荐',
      array['粉面 / 粥店','高性价比'],
      array['🍜 一人食友好'],
      '家常小店风格，石磨肠粉搭配辣椒酱表现好，属于稳定日常型选择。',
      null,
      'verified'
    ),
    (
      'IES爱意式（星皓广场店）',
      '星皓广场（地图待补充详细地址）',
      'vibe',
      '正餐',
      '封神之作',
      array['💕 约会 / 生日','📸 拍照出片'],
      array['🍻 聚餐 / 团建'],
      '炸物拼盘分量巨大，其中鱿鱼圈和鳕鱼条口碑突出；鲜虾意面奶香与香料层次好，整体适合聚餐拍照。',
      null,
      'verified'
    ),
    (
      'Indian Garden Restaurant',
      '澳门（地图待补充详细地址）',
      'food',
      '正餐',
      '强烈推荐',
      array['东南亚菜','西餐 / 简餐'],
      array['📸 拍照出片'],
      '装修精致，入店有免费小食与酱料；牛仔骨和黑虎虾分量与香料风味表现在线。',
      null,
      'verified'
    ),
    (
      'Dino汉堡',
      '澳门（地图待补充详细地址）',
      'food',
      '快餐小吃',
      '强烈推荐',
      array['汉堡 / 炸鸡','隐藏好店'],
      array['🍜 一人食友好'],
      '作者少数认可的网红汉堡店，食材新鲜、面包香软、整体完成度高。',
      null,
      'verified'
    ),
    (
      'UFUFU Coffee（星皓广场店）',
      '星皓广场（地图待补充详细地址）',
      'drink',
      '饮品甜点',
      '还行吧',
      array['咖啡','西式甜品'],
      array['🍻 聚餐 / 团建'],
      '蛋黄酱炸大虾和西冷牛排可选，建议搭配海盐优化口感；更适合朋友聚餐与甜品补给。',
      null,
      'verified'
    ),
    (
      '新潮咖啡美食',
      '澳门（地图待补充详细地址）',
      'deal',
      '快餐小吃',
      '强烈推荐',
      array['学生证折扣','高性价比'],
      array['🍜 一人食友好'],
      '中午人气高的性价比店，蛋包饭加鸡球与无骨鸡翅分量充足、口感稳定。',
      '学生友好价位',
      'verified'
    ),
    (
      '百里鲜烧腊茶餐厅',
      '澳门（地图待补充详细地址）',
      'food',
      '正餐',
      '还行吧',
      array['茶餐厅 / 冰室','烧腊 / 快餐'],
      array['🍜 一人食友好'],
      '烧鹅腿表现优于海鲜叻沙面，适合想吃烧味的场景。',
      null,
      'verified'
    ),
    (
      '千笹日本料理',
      '澳门（地图待补充详细地址）',
      'food',
      '正餐',
      '封神之作',
      array['日韩料理','📸 拍照出片'],
      array['🍻 聚餐 / 团建'],
      '刺身新鲜度高；鹅肝玉子饭与牛舌表现突出，属于作者高评价日料店。',
      null,
      'verified'
    ),
    (
      'Common Table',
      '澳门（地图待补充详细地址）',
      'vibe',
      '正餐',
      '强烈推荐',
      array['💻 适合赶Due','🍻 聚餐 / 团建'],
      array['📸 拍照出片'],
      '空间较大且安静，虾滑蛋黑面包与牛排整体完成度好，适合慢节奏用餐。',
      null,
      'verified'
    )
), prepared as (
  select
    name,
    address,
    null::numeric as longitude,
    null::numeric as latitude,
    category,
    tags,
    features,
    shop_type,
    rating_label,
    array[]::text[] as image_urls,
    review_text,
    student_discount,
    status,
    case
      when rating_label = '封神之作' then 5.0
      when rating_label = '强烈推荐' then 4.0
      when rating_label = '还行吧' then 3.0
      when rating_label = '建议避雷' then 1.0
      else null
    end as rating,
    case
      when rating_label = '封神之作' then 5.0
      when rating_label = '强烈推荐' then 4.0
      when rating_label = '还行吧' then 3.0
      when rating_label = '建议避雷' then 1.0
      else 0
    end as total_sum,
    1 as rating_count,
    1 as review_count
  from seed
)
insert into public.shops (
  name,
  address,
  longitude,
  latitude,
  category,
  tags,
  features,
  shop_type,
  rating_label,
  image_urls,
  review_text,
  student_discount,
  status,
  rating,
  total_sum,
  rating_count,
  review_count
)
select
  p.name,
  p.address,
  p.longitude,
  p.latitude,
  p.category,
  p.tags,
  p.features,
  p.shop_type,
  p.rating_label,
  p.image_urls,
  p.review_text,
  p.student_discount,
  p.status,
  p.rating,
  p.total_sum,
  p.rating_count,
  p.review_count
from prepared p
where not exists (
  select 1 from public.shops s where s.name = p.name
);

-- 建议执行后再跑：scripts/data-health-check.sql