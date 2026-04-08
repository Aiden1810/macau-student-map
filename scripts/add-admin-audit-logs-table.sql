-- 管理后台操作审计日志表（轻量级）
-- 记录管理员关键动作：approve / reject / delete / create / edit

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null,
  action text not null,
  target_shop_id uuid null,
  note text null,
  metadata jsonb null,
  created_at timestamptz not null default now(),
  constraint admin_audit_logs_action_check
    check (action in ('approve', 'reject', 'delete', 'create', 'edit'))
);

create index if not exists idx_admin_audit_logs_created_at
  on public.admin_audit_logs (created_at desc);

create index if not exists idx_admin_audit_logs_action_created_at
  on public.admin_audit_logs (action, created_at desc);

create index if not exists idx_admin_audit_logs_target_shop_id
  on public.admin_audit_logs (target_shop_id);

alter table public.admin_audit_logs enable row level security;

-- 仅管理员可读
DROP POLICY IF EXISTS "admin_audit_logs_select_admin" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_select_admin"
  ON public.admin_audit_logs
  FOR select
  TO authenticated
  USING (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

-- 仅管理员可写
DROP POLICY IF EXISTS "admin_audit_logs_insert_admin" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_insert_admin"
  ON public.admin_audit_logs
  FOR insert
  TO authenticated
  WITH CHECK (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
