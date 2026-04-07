-- 1. Adds price_per_person to estimate average cost (numeric, optional)
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS price_per_person numeric;

-- 2. Adds region for geographical filtering without map zoom
-- Expected values: '澳门半岛', '氹仔岛', '路环岛', '香洲区', '横琴区', '其它'
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS region text;

-- 3. Adds signature_dish for quick recommendations
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS signature_dish text;

-- 4. Adds sharp_review for quick 1-sentence catchy reviews
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS sharp_review text;

-- Example UPDATE if needed for legacy data:
-- UPDATE public.shops SET region = '氹仔岛' WHERE address LIKE '%氹仔%';
-- UPDATE public.shops SET region = '澳门半岛' WHERE address LIKE '%半岛%' OR address LIKE '%南湾%';
-- UPDATE public.shops SET region = '横琴区' WHERE address LIKE '%横琴%';
