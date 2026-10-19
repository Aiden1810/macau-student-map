import { loadAmapPlaceSdk } from "./place-search";
import {
  coordinatesSchema,
  routeChoiceSchema,
  type AssistantOrigin,
  type Coordinates,
  type RouteChoice,
  type RouteSnapshot,
} from "../assistant/contracts";

type Mode = "taxi" | "transit" | "walking";
type Callback = (status: string, result: unknown) => void;
export function resolveRouteCity(place: {
  region?: string | null;
  address: string;
}): AssistantOrigin["city"] | null {
  const regionCity = ["横琴区", "香洲区"].includes(place.region ?? "")
    ? "珠海"
    : ["澳门半岛", "氹仔岛", "路环岛"].includes(place.region ?? "")
      ? "澳门"
      : null;
  const zhuhai = /珠海|横琴|橫琴|香洲|zhuhai|hengqin/i.test(place.address);
  const macau = /澳门|澳門|macau|macao/i.test(place.address);
  if (zhuhai && macau) return null;
  const addressCity = zhuhai ? "珠海" : macau ? "澳门" : null;
  if (regionCity && addressCity && regionCity !== addressCity) return null;
  return regionCity ?? addressCity;
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;

export function normalizeRouteResult(
  mode: Mode,
  status: string,
  result: unknown,
): RouteChoice {
  if (status === "no_data") return { status: "no_route" };
  if (status !== "complete") return { status: "error" };
  const raw = record(result)[mode === "transit" ? "plans" : "routes"];
  const plans = (Array.isArray(raw) ? raw : [])
    .map(record)
    .filter(
      (plan) => finite(plan.time) !== null && finite(plan.distance) !== null,
    )
    .sort((a, b) => Number(a.time) - Number(b.time));
  if (!plans.length) return { status: "no_route" };
  const plan = plans[0];
  const segments = Array.isArray(plan.segments) ? plan.segments : [];
  const lines = segments.flatMap((segment) => {
    const lines = record(record(segment).transit).lines;
    return Array.isArray(lines)
      ? lines
          .map((line) => record(line).name)
          .filter((name): name is string => typeof name === "string")
          .map((name) => name.slice(0, 120))
      : [];
  });
  const normalized = routeChoiceSchema.safeParse({
    status: "ok",
    durationSeconds: plan.time,
    distanceMeters: plan.distance,
    lines: [...new Set(lines)].slice(0, 12),
    walkingMeters: mode === "transit" ? finite(plan.walking_distance) : null,
  });
  return normalized.success ? normalized.data : { status: "no_route" };
}

export function queryRoute(
  mode: Mode,
  start: (callback: Callback) => void,
  timeoutMs = 12000,
): Promise<RouteChoice> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: RouteChoice) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish({ status: "timeout" }), timeoutMs);
    try {
      start((status, result) =>
        finish(normalizeRouteResult(mode, status, result)),
      );
    } catch {
      finish({ status: "error" });
    }
  });
}

type RouteSdk = {
  plugin: (names: string[], callback: () => void) => void;
  Driving: new (options: { policy: number; extensions: string }) => {
    search: (
      from: Coordinates,
      to: Coordinates,
      options: object,
      callback: Callback,
    ) => void;
  };
  Transfer: new (options: {
    city: string;
    cityd: string;
    policy: number;
    extensions: string;
  }) => {
    search: (from: Coordinates, to: Coordinates, callback: Callback) => void;
  };
  Walking: new (options: object) => {
    search: (from: Coordinates, to: Coordinates, callback: Callback) => void;
  };
};

export async function compareAmapRoutes(
  key: string,
  origin: AssistantOrigin,
  places: Array<{
    id: string;
    coordinates: Coordinates | null;
    city: string | null;
  }>,
): Promise<RouteSnapshot[]> {
  if (places.length > 4) throw new Error("最多比较4家店铺");
  const sdk = await new Promise<RouteSdk>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("地图加载超时，请重试")),
      12000,
    );
    void loadAmapPlaceSdk(key)
      .then((amap) => {
        const sdk = amap as unknown as RouteSdk;
        sdk.plugin(["AMap.Driving", "AMap.Transfer", "AMap.Walking"], () => {
          clearTimeout(timer);
          resolve(sdk);
        });
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
  const outputs: RouteSnapshot[] = [];
  // Two destinations at a time bounds provider requests and preserves partial results.
  for (let i = 0; i < places.length; i += 2) {
    const chunk = await Promise.all(
      places.slice(i, i + 2).map(async (place) => {
        if (
          !place.coordinates ||
          !coordinatesSchema.safeParse(place.coordinates).success
        )
          return null;
        const destination = place.coordinates;
        const [taxi, transit, walking] = await Promise.all([
          queryRoute("taxi", (callback) =>
            new sdk.Driving({ policy: 0, extensions: "all" }).search(
              origin.coordinates,
              destination,
              {},
              callback,
            ),
          ),
          place.city
            ? queryRoute("transit", (callback) =>
                new sdk.Transfer({
                  city: origin.city,
                  cityd: place.city!,
                  policy: 0,
                  extensions: "all",
                }).search(origin.coordinates, destination, callback),
              )
            : Promise.resolve<RouteChoice>({ status: "unknown_city" }),
          queryRoute("walking", (callback) =>
            new sdk.Walking({}).search(
              origin.coordinates,
              destination,
              callback,
            ),
          ),
        ]);
        return {
          placeId: place.id,
          source: "amap-js" as const,
          origin: origin.coordinates,
          destination,
          queriedAt: Date.now(),
          taxi,
          transit,
          walking,
        };
      }),
    );
    outputs.push(...chunk.filter((r) => r !== null));
  }
  return outputs;
}

export function buildRouteNavigationUrl(
  origin: Coordinates,
  destination: Coordinates,
  name: string,
  mode: Mode,
): string {
  const url = new URL("https://uri.amap.com/navigation");
  url.searchParams.set("from", `${origin.join(",")},出发地`);
  url.searchParams.set(
    "to",
    `${destination.join(",")},${name.replace(/[,\r\n]+/g, " ")}`,
  );
  url.searchParams.set(
    "mode",
    mode === "taxi" ? "car" : mode === "transit" ? "bus" : "walk",
  );
  url.searchParams.set("src", "macau-student-map");
  url.searchParams.set("callnative", "1");
  return url.toString();
}
