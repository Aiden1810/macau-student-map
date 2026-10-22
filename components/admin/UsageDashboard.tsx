'use client';
import {useState} from 'react';
import type {UsageMetric, UsageReport} from '@/lib/admin/dashboard-stats';
import type {TrafficRange} from '@/lib/admin/traffic';
import {
  RANGE_NOTES,
  ReportBars,
  STATS_BUTTON,
  StatsCard,
  StatsRange,
  statsTime,
  useAdminReport,
} from './DashboardStatsPanels';
const FEATURE_NAMES: Record<string, string> = {
  'assistant.compare': '选店比较助手',
  'assistant.chat': '对话助手',
  'places.list': '店铺列表',
  'shops.list': '历史店铺列表',
};
const money = (value: number) =>
  value > 0 && value < 0.000001 ? value.toExponential(3) : value.toFixed(6);
const fee = (row: UsageMetric | undefined) =>
  row?.costLow !== null && row?.costLow !== undefined && row.costHigh !== null
    ? `${money(row.costLow)}–${money(row.costHigh)} USD`
    : '暂无计价记录';
const success = (row: UsageMetric | undefined) =>
  row?.calls ? `${((row.succeeded / row.calls) * 100).toFixed(1)}%` : '—';
export default function UsageDashboard() {
  const [range, setRange] = useState<TrafficRange>('7d');
  const {data, loading, error, refresh} = useAdminReport<UsageReport>(
    '/api/admin/usage',
    range,
  );
  const http = data?.summary.find((row) => row.kind === 'http'),
    ai = data?.summary.find((row) => row.kind === 'ai');
  const enabled = data?.collection.enabled && data.serverConfigured;
  return (
    <section aria-label="API 用量与运行" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">API 用量与运行</h2>
          <p className="mt-2 text-sm text-muted">
            查看助手消耗与关键接口运行情况，按已保存的服务端记录统计。
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={refresh}
          className={STATS_BUTTON}
        >
          刷新统计
        </button>
      </div>
      <StatsRange range={range} onChange={setRange} />
      <p className="text-xs text-muted">
        {RANGE_NOTES[range]}；时间为澳门时间。
      </p>
      {loading && (
        <p role="status" className="text-sm text-muted">
          正在读取用量统计…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800"
        >
          用量统计读取失败，请刷新重试。
        </p>
      )}
      {data && (
        <>
          <div
            className={`rounded-xl border p-4 text-sm leading-relaxed ${enabled ? 'border-line bg-white text-muted' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
          >
            <p>
              {enabled
                ? `采集启用：${statsTime(data.collection.startedAt)} · 最近记录：${statsTime(data.collection.lastEventAt)}`
                : '采集尚未启用，当前不能据此判断实际调用量。'}
            </p>
            <p className="mt-1">
              仅覆盖正式站点的两个助手入口、店铺列表与历史店铺列表接口。AI
              调用和网站接口请求分别计数，均不代表用户人数。
            </p>
            {enabled && data.collection.lastEventAt === null && (
              <p className="mt-1">
                尚未采集到记录；启用前的历史调用不会自动补回。
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              label="网站接口请求"
              value={enabled ? (http?.calls ?? 0) : null}
              note={`HTTP 成功率 ${success(http)}；不代表 AI 一定产生可用结果`}
            />
            <StatsCard
              label="实际 AI 调用"
              value={enabled ? (ai?.calls ?? 0) : null}
              note={`成功率 ${success(ai)}；用量未知 ${ai?.unknownUsage ?? 0} 次`}
            />
            <StatsCard
              label="已知输入 Token"
              value={enabled ? (ai?.inputTokens ?? 0) : null}
              note={`已知输出 Token：${ai?.outputTokens ?? 0}；缺失部分未计入`}
            />
            <StatsCard
              label="费用参考区间"
              value={fee(ai)}
              note={`已计价 ${ai?.pricedCalls ?? 0} / ${ai?.calls ?? 0} 次；非服务商账单`}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              label="AI 失败 / 超时"
              value={
                enabled ? `${ai?.failed ?? 0} / ${ai?.timeouts ?? 0}` : null
              }
              note={`取消 ${ai?.cancelled ?? 0} 次 · 供应商限流 ${ai?.limited ?? 0} 次`}
            />
            <StatsCard
              label="网站接口错误"
              value={enabled ? (http?.failed ?? 0) : null}
              note={`请求拦截 ${http?.rejected ?? 0} 次 · 限流 ${http?.limited ?? 0} 次 · 未配置 ${http?.unconfigured ?? 0} 次`}
            />
            <StatsCard
              label="AI 平均响应"
              value={ai ? `${ai.meanMs} ms` : null}
              note={
                ai
                  ? `P95：${ai.p95Ms} ms；95% 调用不超过该耗时`
                  : '暂无 AI 调用记录'
              }
            />
            <StatsCard
              label="网站接口平均响应"
              value={http ? `${http.meanMs} ms` : null}
              note={http ? `P95：${http.p95Ms} ms` : '暂无接口调用记录'}
            />
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <h3 className="font-semibold text-ink">调用趋势</h3>
            <ReportBars
              points={data.timeline.map((p) => ({...p, count: p.http}))}
              label="网站接口请求趋势"
            />
            <p className="mt-3 text-xs text-muted">
              上图为网站接口请求；AI
              是其中实际发生的外部模型调用，请勿将两者相加作为用户操作次数。
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <h3 className="font-semibold text-ink">按功能和模型查看</h3>
            {data.breakdown.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                当前范围暂无已保存的调用记录。
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {data.breakdown.map((row) => (
                  <article
                    key={`${row.kind}:${row.feature}:${row.model}`}
                    className="rounded-xl border border-line p-4"
                  >
                    <p className="break-words font-medium text-ink">
                      {FEATURE_NAMES[row.feature] ?? row.feature} ·{' '}
                      {row.kind === 'ai' ? `AI / ${row.model}` : '网站接口'}
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      {row.calls} 次 · 成功 {row.succeeded} · 失败 {row.failed}{' '}
                      · 超时 {row.timeouts} · 限流 {row.limited} · 平均{' '}
                      {row.meanMs} ms
                    </p>
                    {row.kind === 'ai' && (
                      <p className="mt-2 break-words text-xs text-muted">
                        输入 {row.inputTokens} / 输出 {row.outputTokens} Token ·
                        用量未知 {row.unknownUsage} 次 · {fee(row)}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl bg-canvas p-4 text-xs leading-relaxed text-muted">
            <p>
              费用参考{' '}
              <a
                href="https://api-docs.deepseek.com/quick_start/pricing/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                DeepSeek 官方峰谷价格
              </a>
              ，核对日期 2026-10-22，以 USD
              展示；缓存用量缺失时扩大区间，未知模型或 Token
              不完整时不估价。价格可能调整，最终扣费以账单为准。
            </p>
            <p className="mt-2">
              不保存聊天正文、邮箱或位置。采集失败可能造成漏记；尚不包含浏览器高德调用、套餐余额或本地／预览环境。查询最多近
              30 天，采集时按日清理 45 天前记录。
            </p>
            <p className="mt-2">统计更新于 {statsTime(data.updatedAt)}</p>
          </div>
        </>
      )}
    </section>
  );
}
