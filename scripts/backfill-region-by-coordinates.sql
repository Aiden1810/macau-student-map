-- Backfill missing shops.region from longitude/latitude
-- Safe: updates only rows with region IS NULL and valid coordinates in Macau/Zhuhai range

UPDATE shops
SET region = CASE
  -- 澳门半岛
  WHEN longitude BETWEEN 113.52 AND 113.57 AND latitude BETWEEN 22.18 AND 22.23 THEN '澳门半岛'
  -- 氹仔岛
  WHEN longitude BETWEEN 113.55 AND 113.59 AND latitude BETWEEN 22.14 AND 22.17 THEN '氹仔岛'
  -- 路环岛
  WHEN longitude BETWEEN 113.55 AND 113.61 AND latitude BETWEEN 22.10 AND 22.14 THEN '路环岛'
  -- 横琴区
  WHEN longitude BETWEEN 113.50 AND 113.62 AND latitude BETWEEN 22.08 AND 22.16 THEN '横琴区'
  -- 香洲区（珠海主城区）
  WHEN longitude BETWEEN 113.48 AND 113.63 AND latitude BETWEEN 22.20 AND 22.33 THEN '香洲区'
  -- 其它（澳门/珠海大范围兜底）
  WHEN longitude BETWEEN 113.00 AND 114.20 AND latitude BETWEEN 21.80 AND 22.60 THEN '其它'
  ELSE NULL
END
WHERE region IS NULL
  AND longitude IS NOT NULL
  AND latitude IS NOT NULL;

-- quick check counts
SELECT COALESCE(region, '未填写') AS region, COUNT(*) AS cnt
FROM shops
GROUP BY region
ORDER BY cnt DESC;
