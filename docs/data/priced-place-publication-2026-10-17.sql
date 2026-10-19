begin;
select id from public.places where id in ('10bcfd27-6705-486d-8309-3fd2d645b3d7'::uuid,'1fc962ba-031f-4ff0-98c2-214886526692'::uuid,'537fb38d-6e1a-42d3-adce-0bcdd76f5bf2'::uuid,'5d983848-345d-4989-bbb1-be19f74dd6fc'::uuid,'6fee7513-7474-4ce1-98bb-742502a252dd'::uuid,'752a1db8-9a76-49c6-8fc4-cacb7492d169'::uuid,'a3955b90-68aa-4e4c-ba86-8dafe5091184'::uuid,'a44b46b8-2d96-434f-a70f-83cf6e1cba9b'::uuid,'a7c14799-84de-442a-86cb-7bc80cd5462b'::uuid,'cf0965d6-f4fe-4f37-94ad-ade7d64fbe27'::uuid,'e2181a16-0be3-41dd-a4c2-a1a96acd4523'::uuid,'e5343163-2799-4501-b5d4-ce0c9d10161b'::uuid,'e819efbe-0d6c-4f9a-81de-433696b9c427'::uuid) order by id for update;
create temporary table priced_publish_before on commit drop as
 select id,name,status,published_at,price_per_person,longitude,latitude
 from public.places where id in ('10bcfd27-6705-486d-8309-3fd2d645b3d7'::uuid,'1fc962ba-031f-4ff0-98c2-214886526692'::uuid,'537fb38d-6e1a-42d3-adce-0bcdd76f5bf2'::uuid,'5d983848-345d-4989-bbb1-be19f74dd6fc'::uuid,'6fee7513-7474-4ce1-98bb-742502a252dd'::uuid,'752a1db8-9a76-49c6-8fc4-cacb7492d169'::uuid,'a3955b90-68aa-4e4c-ba86-8dafe5091184'::uuid,'a44b46b8-2d96-434f-a70f-83cf6e1cba9b'::uuid,'a7c14799-84de-442a-86cb-7bc80cd5462b'::uuid,'cf0965d6-f4fe-4f37-94ad-ade7d64fbe27'::uuid,'e2181a16-0be3-41dd-a4c2-a1a96acd4523'::uuid,'e5343163-2799-4501-b5d4-ce0c9d10161b'::uuid,'e819efbe-0d6c-4f9a-81de-433696b9c427'::uuid) and status='draft' and price_per_person is not null;
with changed as (
 update public.places p set status='published',published_at=coalesce(p.published_at,now())
 from priced_publish_before b where p.id=b.id and p.status='draft' and p.price_per_person is not null
 returning p.id,p.name,p.price_per_person,p.longitude,p.latitude,p.published_at
), logged as (
 insert into public.admin_audit_logs(actor_id,entity_type,entity_id,action,note,metadata)
 select null,'place',c.id::text,'place.publish_batch','按用户最新要求，发布所有已填写人均消费的草稿店铺',
 jsonb_build_object('batch','priced-place-publication-2026-10-17','operator','codex_supabase_mcp','criterion','draft and price_per_person is not null','before',to_jsonb(b),'after_status','published','after_published_at',c.published_at,'map_note','坐标缺失时仅展示列表，不创建虚假地图定位')
 from changed c join priced_publish_before b on b.id=c.id returning id
)
select (select count(*) from logged) as audit_entries,coalesce(jsonb_agg(to_jsonb(c) order by c.name),'[]'::jsonb) as published from changed c;
commit;
