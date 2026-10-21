import type {AdminAccount} from '@/lib/admin/accounts';

export default function AccountAttribution({label, account}: {label: string; account?: AdminAccount | null}) {
  return <p className="mt-2 break-all text-xs text-muted">
    {label}：{!account ? '来源未记录' : account.email || `邮箱不可用（账号 ${account.id}）`}
  </p>;
}
