import { describe, expect, it, vi } from "vitest";
import {
  normalizeRouteResult,
  queryRoute,
  buildRouteNavigationUrl,
  resolveRouteCity,
  compareAmapRoutes,
} from "../../../lib/amap/route-comparison";
import { loadAmapPlaceSdk } from "../../../lib/amap/place-search";
vi.mock("../../../lib/amap/place-search", () => ({
  loadAmapPlaceSdk: vi.fn(),
}));

describe("AMap route comparison", () => {
  it("normalizes walking routes with real provider time/distance and a walking navigation link", () => {
    expect(
      normalizeRouteResult("walking", "complete", {
        routes: [{ time: 900, distance: 1100 }],
      }),
    ).toMatchObject({
      status: "ok",
      durationSeconds: 900,
      distanceMeters: 1100,
    });
    expect(
      new URL(
        buildRouteNavigationUrl(
          [113.5, 22.1],
          [113.6, 22.2],
          "面馆",
          "walking",
        ),
      ).searchParams.get("mode"),
    ).toBe("walk");
  });
  it("still queries driving but skips transit when the destination city is unknown", async () => {
    const transfer = vi.fn();
    vi.mocked(loadAmapPlaceSdk).mockResolvedValue({
      plugin: (_names: string[], done: () => void) => done(),
      Driving: class {
        search(
          _from: unknown,
          _to: unknown,
          _options: unknown,
          done: (status: string, result: unknown) => void,
        ) {
          done("complete", { routes: [{ time: 300, distance: 1000 }] });
        }
      },
      Transfer: transfer,
      Walking: class {
        search(
          _from: unknown,
          _to: unknown,
          done: (status: string, result: unknown) => void,
        ) {
          done("complete", { routes: [{ time: 900, distance: 1100 }] });
        }
      },
    } as unknown as Awaited<ReturnType<typeof loadAmapPlaceSdk>>);
    const result = await compareAmapRoutes(
      "test-key",
      { coordinates: [113.53, 22.13], label: "起点", city: "珠海" },
      [{ id: "test", coordinates: [113.54, 22.14], city: null }],
    );
    expect(result[0].taxi.status).toBe("ok");
    expect(result[0].walking).toMatchObject({
      status: "ok",
      durationSeconds: 900,
      distanceMeters: 1100,
    });
    expect(result[0].transit).toEqual({ status: "unknown_city" });
    expect(transfer).not.toHaveBeenCalled();
  });
  it("resolves destination cities from explicit evidence without defaulting to Macau", () => {
    expect(
      resolveRouteCity({ region: null, address: "珠海市香洲区北山正街78号" }),
    ).toBe("珠海");
    expect(
      resolveRouteCity({ region: "其它", address: "澳門俾若翰街449號" }),
    ).toBe("澳门");
    expect(resolveRouteCity({ region: "横琴区", address: "琴政路" })).toBe(
      "珠海",
    );
    expect(resolveRouteCity({ region: "氹仔岛", address: "" })).toBe("澳门");
    expect(resolveRouteCity({ region: null, address: "中央广场" })).toBeNull();
    expect(
      resolveRouteCity({ region: "澳门半岛", address: "珠海市香洲区" }),
    ).toBeNull();
  });
  it("keeps provider seconds and chooses the fastest valid transit plan", () => {
    expect(
      normalizeRouteResult("taxi", "complete", {
        routes: [{ time: 720, distance: 4300 }],
      }),
    ).toMatchObject({ status: "ok", durationSeconds: 720 });
    expect(
      normalizeRouteResult("transit", "complete", {
        plans: [
          {
            time: 1500,
            distance: 3000,
            walking_distance: 400,
            segments: [{ transit: { lines: [{ name: "14路" }] } }],
          },
          { time: 1000, distance: 2500, walking_distance: 200 },
        ],
      }),
    ).toMatchObject({ durationSeconds: 1000, walkingMeters: 200 });
  });
  it("distinguishes no route, provider failure and malformed durations", () => {
    expect(normalizeRouteResult("taxi", "no_data", {})).toEqual({
      status: "no_route",
    });
    expect(normalizeRouteResult("taxi", "error", "INVALID_KEY")).toEqual({
      status: "error",
    });
    expect(
      normalizeRouteResult("taxi", "complete", { routes: [{ distance: 1 }] }),
    ).toEqual({ status: "no_route" });
  });
  it("ends a route that never calls back, and ignores late success", async () => {
    vi.useFakeTimers();
    const run = queryRoute("taxi", () => {}, 100);
    await vi.advanceTimersByTimeAsync(101);
    expect(await run).toEqual({ status: "timeout" });
    vi.useRealTimers();
  });
  it("preserves origin and the chosen transport in navigation links", () => {
    const url = new URL(
      buildRouteNavigationUrl([113.5, 22.1], [113.6, 22.2], "A,B店", "transit"),
    );
    expect(url.searchParams.get("mode")).toBe("bus");
    expect(url.searchParams.get("from")).toContain("113.5,22.1");
    expect(url.searchParams.get("to")).toBe("113.6,22.2,A B店");
  });
});
