"use client";
import { Car, Bus, Footprints, ArrowUpRight } from "lucide-react";
import { buildRouteNavigationUrl } from "@/lib/amap/route-comparison";
import type {
  AssistantOrigin,
  AssistantPlace,
  RouteSnapshot,
} from "@/lib/assistant/contracts";
import type { AssistantCopy } from "@/lib/assistant/copy";
import { formatRouteDistance } from "@/lib/assistant/format-distance";

export default function RouteComparisonTable({
  places,
  routes,
  origin,
  copy,
}: {
  places: AssistantPlace[];
  routes: RouteSnapshot[];
  origin: AssistantOrigin | null;
  copy: AssistantCopy;
}) {
  const modes = [
    { key: "taxi", icon: Car },
    { key: "transit", icon: Bus },
    { key: "walking", icon: Footprints },
  ] as const;
  // Compare the returned seconds, before rounding the displayed minutes.
  const fastest = Object.fromEntries(modes.map(({key}) => {
    const seconds = places.flatMap(place => {
      const choice = routes.find(route => route.placeId === place.id)?.[key];
      return choice?.status === 'ok' && Number.isFinite(choice.durationSeconds) && choice.durationSeconds >= 0
        ? [choice.durationSeconds] : [];
    });
    return [key, seconds.length ? Math.min(...seconds) : null];
  }));
  return (
    <section aria-label={copy.routes} className="mt-4 space-y-3">
      {places.map((place) => {
        const result = routes.find((r) => r.placeId === place.id);
        return (
          <article
            key={place.id}
            className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white"
          >
            <div className="border-b border-stone-100 px-4 py-3">
              <h3 className="break-words font-semibold text-stone-900">{place.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {place.address || copy.addressUnknown}
              </p>
            </div>
            <div className="grid grid-cols-1 divide-y divide-stone-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {modes.map(({ key, icon: Icon }) => {
                const choice = result?.[key];
                return (
                  <div key={key} className="min-w-0 break-words px-4 py-3">
                    <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
                      <Icon size={14} aria-hidden="true" />
                      {copy[key]}
                    </p>
                    {choice?.status === "ok" && Number.isFinite(choice.durationSeconds) && choice.durationSeconds >= 0 ? (
                      <>
                        <p className="flex flex-wrap items-baseline gap-1.5 text-3xl font-semibold tabular-nums text-emerald-950">
                          {Math.ceil(choice.durationSeconds / 60)}{" "}
                          <span className="text-xs font-normal text-muted">
                            {copy.minutes}
                          </span>
                          {choice.durationSeconds === fastest[key] && (
                            <span aria-label={`${copy[key]}：${copy.fastestRoute}`} className="rounded-md bg-pine-50 px-2 py-1 text-xs font-medium text-pine-700">{copy.fastestRoute}</span>
                          )}
                        </p>
                        <p className="mt-1 text-xs tabular-nums text-stone-600">
                          {formatRouteDistance(choice.distanceMeters, copy)}
                        </p>
                        {(choice.lines.length > 0 || choice.walkingMeters !== null) && (
                          <details className="mt-2 text-xs leading-5 text-muted">
                            <summary className="min-h-9 cursor-pointer py-2 font-medium text-stone-700 focus-visible:ring-2 focus-visible:ring-pine-700">{copy.routeDetails}</summary>
                            {choice.lines.length > 0 && <p>{choice.lines.join(" → ")}</p>}
                            {choice.walkingMeters !== null && <p className="mt-1">{copy.walk} {formatRouteDistance(choice.walkingMeters, copy)}</p>}
                          </details>
                        )}
                        {origin && place.coordinates && (
                          <a
                            className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-xl bg-pine-700 px-3 py-2 text-sm font-medium text-white hover:bg-pine-800 focus-visible:ring-2 focus-visible:ring-pine-700 focus-visible:ring-offset-2"
                            href={buildRouteNavigationUrl(
                              origin.coordinates,
                              place.coordinates,
                              place.name,
                              key,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {copy.navigate}
                            <ArrowUpRight size={12} aria-hidden="true" />
                          </a>
                        )}
                      </>
                    ) : (
                      <div className="text-xs leading-relaxed text-muted">
                        <p className="text-sm font-medium text-stone-700">{copy.noAvailableRoute}</p>
                        <p className="mt-1">{!place.coordinates ? copy.missing_coordinates : choice && choice.status !== 'ok' ? copy[choice.status] : choice ? copy.error : copy.notQueried}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
      <p className="text-[11px] leading-relaxed text-muted">
        {copy.routeNote}
        {routes.length > 0 &&
          ` ${copy.updated} ${new Date(Math.min(...routes.map((r) => r.queriedAt))).toLocaleTimeString(copy.locale)}`}
      </p>
    </section>
  );
}
