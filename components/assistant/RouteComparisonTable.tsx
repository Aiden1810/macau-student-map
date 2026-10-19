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
  return (
    <section aria-label={copy.routes} className="mt-4 space-y-3">
      {places.map((place) => {
        const result = routes.find((r) => r.placeId === place.id);
        return (
          <article
            key={place.id}
            className="overflow-hidden rounded-2xl border border-line bg-white"
          >
            <div className="border-b border-stone-100 px-4 py-3">
              <h3 className="font-semibold text-stone-900">{place.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {place.address || copy.addressUnknown}
              </p>
            </div>
            <div className="grid grid-cols-1 divide-y divide-stone-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {modes.map(({ key, icon: Icon }) => {
                const choice = result?.[key];
                return (
                  <div key={key} className="px-4 py-3">
                    <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
                      <Icon size={14} aria-hidden="true" />
                      {copy[key]}
                    </p>
                    {choice?.status === "ok" ? (
                      <>
                        <p className="text-xl font-semibold tabular-nums text-emerald-950">
                          {Math.ceil(choice.durationSeconds / 60)}{" "}
                          <span className="text-xs font-normal text-muted">
                            {copy.minutes}
                          </span>
                        </p>
                        <p className="mt-1 text-xs tabular-nums text-stone-600">
                          {formatRouteDistance(choice.distanceMeters, copy)}
                        </p>
                        {choice.lines.length > 0 && (
                          <p className="mt-2 text-xs leading-relaxed text-muted">
                            {choice.lines.join(" → ")}
                          </p>
                        )}
                        {choice.walkingMeters !== null && (
                          <p className="mt-1 text-xs text-muted">
                            {copy.walk}{" "}
                            {formatRouteDistance(choice.walkingMeters, copy)}
                          </p>
                        )}
                        {origin && place.coordinates && (
                          <a
                            className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-medium text-pine-700 underline-offset-4 hover:underline"
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
                      <p className="text-xs leading-relaxed text-muted">
                        {!place.coordinates
                          ? copy.missing_coordinates
                          : choice
                            ? copy[choice.status]
                            : copy.notQueried}
                      </p>
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
