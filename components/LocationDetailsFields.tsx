import type {LocationDetails} from '@/lib/domain/location-details';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-700';

export default function LocationDetailsFields({value, onChange, showSource = false, showBusinessForm = true, required = false, approximateOnly = false}: {
  value: LocationDetails; onChange: (value: LocationDetails) => void; showSource?: boolean; showBusinessForm?: boolean; required?: boolean; approximateOnly?: boolean;
}) {
  return <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <legend className="px-1 text-sm font-semibold text-slate-800">位置与经营信息</legend>
    {showSource && <label className="block"><span className="mb-1 block text-sm">位置录入方式</span>
      <select value={value.source} onChange={event => onChange({...value, source: event.target.value as LocationDetails['source']})} className={INPUT}>
        <option value="unknown">待确认</option><option value="map">地图店铺</option><option value="manual">手动地点（地图搜不到）</option>
      </select></label>}
    <label className="block"><span className="mb-1 block text-sm">位置描述{required && value.source === 'manual' ? ' *' : '（可选）'}</span>
      <textarea rows={2} maxLength={500} required={required && value.source === 'manual'} value={value.description ?? ''}
        onChange={event => onChange({...value, description: event.target.value || null})} placeholder="到附近后怎么找？例如：酒吧门口右侧，靠近红色招牌" className={INPUT} /></label>
    <label className="block"><span className="mb-1 block text-sm">参考地标（可选）</span>
      <input maxLength={120} value={value.landmark ?? ''} onChange={event => onChange({...value, landmark: event.target.value || null})} placeholder="例如：某酒吧、某栋楼或公交站" className={INPUT} /></label>
    <div className="grid gap-3 sm:grid-cols-2">
      {showBusinessForm && <label><span className="mb-1 block text-sm">经营形式</span><select value={value.businessForm} onChange={event => onChange({...value, businessForm: event.target.value as LocationDetails['businessForm']})} className={INPUT}>
        <option value="unknown">不确定／未填写</option><option value="store">店铺</option><option value="stall">小摊</option></select></label>}
      <label><span className="mb-1 block text-sm">位置准确程度</span><select value={approximateOnly ? 'approximate' : value.accuracy} disabled={approximateOnly}
        onChange={event => onChange({...value, accuracy: event.target.value as LocationDetails['accuracy']})} className={INPUT}>
        <option value="unknown">待确认</option><option value="exact">准确位置（知道具体在哪）</option><option value="approximate">大致位置（只确定附近）</option></select></label>
      <label><span className="mb-1 block text-sm">位置是否固定</span><select value={value.mobility} onChange={event => onChange({...value, mobility: event.target.value as LocationDetails['mobility']})} className={INPUT}>
        <option value="unknown">不确定／未填写</option><option value="fixed">通常在同一位置</option><option value="variable">位置可能变化</option></select></label>
    </div>
    {approximateOnly && <p className="text-xs text-amber-800">当前使用附近地标的坐标，仅代表大致位置。知道摊位具体位置后，请在地图重新标点。</p>}
    <label className="block"><span className="mb-1 block text-sm">营业／出摊时间（可选）</span><input maxLength={200} value={value.hours ?? ''}
      onChange={event => onChange({...value, hours: event.target.value || null})} placeholder="例如：通常晚上出摊，雨天不确定；不知道可以留空" className={INPUT} /></label>
    <p className="text-xs leading-5 text-slate-500">请按已知情况填写。出摊时间仅供参考，不表示当前正在营业；照片建议拍到摊位及周围环境。</p>
  </fieldset>;
}
