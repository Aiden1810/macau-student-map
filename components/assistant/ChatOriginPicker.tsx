"use client";
import { LocateFixed, MapPin } from "lucide-react";
import AmapPoiSelector from "@/components/AmapPoiSelector";
import type { AmapPoiOption } from "@/lib/amap/place-search";
import type { ChatCopy } from "@/lib/assistant/chat-copy";

export default function ChatOriginPicker({
  copy,
  options = [],
  busy,
  onSelect,
  onLocate,
}: {
  copy: ChatCopy;
  options?: AmapPoiOption[];
  busy: boolean;
  onSelect: (poi: AmapPoiOption) => void;
  onLocate: () => void;
}) {
  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-line bg-white p-4">
      <button
        type="button"
        disabled={busy}
        onClick={onLocate}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-pine-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-pine-800 disabled:opacity-50"
      >
        <LocateFixed size={16} aria-hidden="true" />
        {busy ? copy.locating : copy.locate}
      </button>
      {options.length > 0 && (
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {options
            .filter((poi) => poi.city !== "unknown")
            .map((poi) => (
              <button
                type="button"
                key={poi.placeId}
                disabled={busy}
                onClick={() => onSelect(poi)}
                className="flex min-h-12 w-full gap-3 rounded-xl border border-line p-3 text-left text-sm transition hover:border-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
              >
                <MapPin
                  size={16}
                  className="mt-0.5 shrink-0 text-pine-700"
                  aria-hidden="true"
                />
                <span>
                  <span className="block font-medium">{poi.name}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {poi.fullAddress}
                  </span>
                </span>
              </button>
            ))}
        </div>
      )}
      <AmapPoiSelector
        selectedPlace={null}
        onSelect={onSelect}
        labels={{
          label: copy.originSearch,
          placeholder: copy.originPlaceholder,
          searching: copy.searching,
          empty: copy.emptyPoi,
          searchFailed: copy.poiFailed,
          unnamedPlace: copy.unnamed,
          poiId: copy.poiId,
        }}
      />
    </div>
  );
}
