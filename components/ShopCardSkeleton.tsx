export default function ShopCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100/90 bg-white/95 p-4 shadow-md animate-pulse">
      <div className="mb-3 overflow-hidden rounded-xl border border-slate-100">
        <div className="h-40 w-full bg-slate-200" />
      </div>

      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="h-6 w-3/4 rounded-md bg-slate-200" />
          <div className="mt-2 h-4 w-5/6 rounded-md bg-slate-200" />
        </div>
        <div className="h-6 w-14 shrink-0 rounded-md bg-slate-200" />
      </div>

      <div className="mb-3 h-7 w-28 rounded-md bg-slate-200" />

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="h-6 w-14 rounded-md bg-slate-200" />
        <div className="h-6 w-20 rounded-md bg-slate-200" />
        <div className="h-6 w-16 rounded-md bg-slate-200" />
      </div>

      <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
        <div className="mb-2 h-3 w-20 rounded bg-slate-200" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-slate-200" />
          <div className="h-4 w-11/12 rounded bg-slate-200" />
          <div className="h-4 w-2/3 rounded bg-slate-200" />
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-slate-50 pt-3">
        <div className="h-4 w-24 rounded-md bg-slate-200" />
        <div className="h-4 w-20 rounded-md bg-slate-200" />
      </div>
    </div>
  );
}
