export default function ShopCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 animate-pulse">
      <div className="flex justify-between items-start mb-2">
        <div className="h-6 w-32 rounded-md bg-slate-200" />
        <div className="h-6 w-16 rounded-md bg-slate-200" />
      </div>

      <div className="h-7 w-24 rounded-md bg-slate-200 mb-3" />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="h-6 w-14 rounded-md bg-slate-200" />
        <div className="h-6 w-20 rounded-md bg-slate-200" />
        <div className="h-6 w-16 rounded-md bg-slate-200" />
      </div>

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50">
        <div className="h-4 w-20 rounded-md bg-slate-200" />
        <div className="h-4 w-16 rounded-md bg-slate-200" />
      </div>
    </div>
  );
}
