"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polygon, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import Link from "next/link";
import { formatPriceUsd } from "@/lib/format";
import type { MapPolygonVertex } from "@/lib/map-polygon-query";
import { peekDrawViewport, type StoredDrawViewport } from "@/lib/listings-map-draw-storage";

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const MIN_SAMPLE_M = 3;
/** Short scribbles were rejected silently (preview cleared, no navigation). Keep low for city-scale maps. */
const MIN_STROKE_M = 6;
const MIN_VERTICES = 3;

export type { MapPolygonVertex };

export interface MapPin {
  id: string;
  title: string;
  lat: number;
  lng: number;
  price_cents: number;
  href: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  /** First listing photo for hover preview */
  image_url?: string | null;
}

function strokeLengthM(map: L.Map, ring: L.LatLng[]): number {
  let s = 0;
  for (let i = 1; i < ring.length; i++) s += map.distance(ring[i - 1]!, ring[i]!);
  return s;
}

function appendIfFar(map: L.Map, ring: L.LatLng[], ll: L.LatLng) {
  const last = ring[ring.length - 1];
  if (!last || map.distance(last, ll) >= MIN_SAMPLE_M) ring.push(ll);
}

function clientPointToLatLng(map: L.Map, clientX: number, clientY: number): L.LatLng {
  const c = map.getContainer();
  const r = c.getBoundingClientRect();
  const x = clientX - r.left;
  const y = clientY - r.top;
  return map.containerPointToLatLng(L.point(x, y));
}

/** Prevent map pan / pinch-zoom from stealing touches while drawing (mobile + desktop). */
function setMapGesturesEnabled(map: L.Map, enabled: boolean): void {
  if (enabled) {
    map.dragging.enable();
    map.touchZoom?.enable();
    map.doubleClickZoom?.enable();
    map.scrollWheelZoom?.enable();
    map.boxZoom?.enable();
    map.keyboard?.enable();
  } else {
    map.dragging.disable();
    map.touchZoom?.disable();
    map.doubleClickZoom?.disable();
    map.scrollWheelZoom?.disable();
    map.boxZoom?.disable();
    map.keyboard?.disable();
  }
}

/** Freehand stroke: pointer/touch follows like a crayon; release to apply lasso. */
function MapFreehandDrawer({
  active,
  onComplete,
  onStrokeRejected,
}: {
  active: boolean;
  onComplete: (ring: MapPolygonVertex[], view: { lat: number; lng: number; zoom: number }) => void;
  onStrokeRejected?: (() => void) | undefined;
}) {
  const map = useMap();
  const previewRef = useRef<L.Polyline | null>(null);
  const ringRef = useRef<L.LatLng[]>([]);
  const draggingRef = useRef(false);
  const strokePointerId = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (previewRef.current) {
        map.removeLayer(previewRef.current);
        previewRef.current = null;
      }
      ringRef.current = [];
      draggingRef.current = false;
      strokePointerId.current = null;
      setMapGesturesEnabled(map, true);
      const el = map.getContainer();
      el.classList.remove("cursor-crosshair");
      el.style.touchAction = "";
      return;
    }

    setMapGesturesEnabled(map, false);

    const container = map.getContainer();
    container.classList.add("cursor-crosshair");
    container.style.touchAction = "none";

    const lineStyle = {
      color: "#6eb8c0",
      weight: 3,
      opacity: 0.95,
    } as const;

    const ptrOpts: AddEventListenerOptions = { passive: false };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (!container.contains(t)) return;
      if (t?.closest?.(".leaflet-marker-icon,.leaflet-popup")) return;

      e.preventDefault();
      e.stopPropagation();

      draggingRef.current = true;
      strokePointerId.current = e.pointerId;
      try {
        container.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const ll = clientPointToLatLng(map, e.clientX, e.clientY);
      ringRef.current = [ll];
      if (previewRef.current) map.removeLayer(previewRef.current);
      previewRef.current = L.polyline([[ll.lat, ll.lng]], lineStyle).addTo(map);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current || strokePointerId.current !== e.pointerId) return;
      e.preventDefault();
      const ll = clientPointToLatLng(map, e.clientX, e.clientY);
      appendIfFar(map, ringRef.current, ll);
      previewRef.current?.setLatLngs(ringRef.current.map((p) => [p.lat, p.lng]));
    };

    const finishStroke = (e: PointerEvent) => {
      if (strokePointerId.current !== e.pointerId) return;
      try {
        if (container.hasPointerCapture?.(e.pointerId)) {
          container.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      strokePointerId.current = null;

      if (!draggingRef.current) return;
      draggingRef.current = false;

      const raw = ringRef.current;
      ringRef.current = [];

      const tooShort = raw.length < MIN_VERTICES || strokeLengthM(map, raw) < MIN_STROKE_M;

      if (previewRef.current) {
        map.removeLayer(previewRef.current);
        previewRef.current = null;
      }

      if (tooShort) {
        onStrokeRejected?.();
        return;
      }

      const out: MapPolygonVertex[] = raw
        .map((p) => ({ lat: p.lat, lng: p.lng }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (out.length < MIN_VERTICES) {
        onStrokeRejected?.();
        return;
      }
      const first = out[0]!;
      const last = out[out.length - 1]!;
      if (last.lat !== first.lat || last.lng !== first.lng) out.push({ ...first });
      const c = map.getCenter();
      onComplete(out, { lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    };

    container.addEventListener("pointerdown", onPointerDown, ptrOpts);
    container.addEventListener("pointermove", onPointerMove, ptrOpts);
    container.addEventListener("pointerup", finishStroke, ptrOpts);
    container.addEventListener("pointercancel", finishStroke, ptrOpts);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown, ptrOpts);
      container.removeEventListener("pointermove", onPointerMove, ptrOpts);
      container.removeEventListener("pointerup", finishStroke, ptrOpts);
      container.removeEventListener("pointercancel", finishStroke, ptrOpts);
      if (previewRef.current) {
        map.removeLayer(previewRef.current);
        previewRef.current = null;
      }
      ringRef.current = [];
      draggingRef.current = false;
      strokePointerId.current = null;
      container.style.touchAction = "";
      setMapGesturesEnabled(map, true);
      container.classList.remove("cursor-crosshair");
    };
  }, [active, map, onComplete, onStrokeRejected]);

  return null;
}

/** Reapply pan/zoom after draw navigation (belt-and-suspenders with MapContainer initial props). */
function RestoreDrawViewport({ view }: { view: StoredDrawViewport }) {
  const map = useMap();
  useLayoutEffect(() => {
    map.setView([view.lat, view.lng], view.zoom, { animate: false });
  }, [map, view]);
  return null;
}

export default function ListingsMap({
  pins,
  fallbackCenter,
  appliedPolygon,
  drawActive,
  onApplyPolygon,
  onStrokeRejected,
  mapPolyFromUrl,
}: {
  pins: MapPin[];
  fallbackCenter: { lat: number; lng: number };
  appliedPolygon?: ReadonlyArray<MapPolygonVertex> | null;
  drawActive: boolean;
  onApplyPolygon: (ring: MapPolygonVertex[], view: { lat: number; lng: number; zoom: number }) => void;
  onStrokeRejected?: (() => void) | undefined;
  /** Raw `mapPoly` query value — used once to restore pan/zoom after a draw (sessionStorage). */
  mapPolyFromUrl: string | null;
}) {
  const drawViewportLockRef = useRef<StoredDrawViewport | null | undefined>(undefined);
  if (drawViewportLockRef.current === undefined) {
    drawViewportLockRef.current = peekDrawViewport(mapPolyFromUrl);
  }
  const drawViewportLock = drawViewportLockRef.current;

  const avgLat = pins.length > 0 ? pins.reduce((s, p) => s + p.lat, 0) / pins.length : fallbackCenter.lat;
  const avgLng = pins.length > 0 ? pins.reduce((s, p) => s + p.lng, 0) / pins.length : fallbackCenter.lng;

  const polyPositions = useMemo((): [number, number][] => {
    if (!appliedPolygon || appliedPolygon.length < 3) return [];
    return appliedPolygon.map((p) => [p.lat, p.lng] as [number, number]);
  }, [appliedPolygon]);

  const center: [number, number] = drawViewportLock
    ? [drawViewportLock.lat, drawViewportLock.lng]
    : polyPositions.length >= 2
      ? [
          polyPositions.reduce((s, p) => s + p[0], 0) / polyPositions.length,
          polyPositions.reduce((s, p) => s + p[1], 0) / polyPositions.length,
        ]
      : [avgLat, avgLng];

  const onComplete = useCallback(
    (ring: MapPolygonVertex[], view: { lat: number; lng: number; zoom: number }) => {
      onApplyPolygon(ring, view);
    },
    [onApplyPolygon],
  );

  const zoom = drawViewportLock?.zoom ?? (polyPositions.length >= 2 ? 12 : pins.length > 0 ? 10 : 9);

  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {polyPositions.length >= 3 && (
        <Polygon
          positions={polyPositions}
          pathOptions={{
            color: "#6eb8c0",
            fillColor: "#6eb8c0",
            fillOpacity: 0.12,
            weight: 2,
          }}
        />
      )}
      {drawViewportLock ? <RestoreDrawViewport view={drawViewportLock} /> : null}
      <MapFreehandDrawer
        active={drawActive}
        onComplete={onComplete}
        onStrokeRejected={onStrokeRejected}
      />
      {pins.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={icon}>
          <Tooltip direction="top" offset={[0, -36]} opacity={1}>
            <div className="max-w-[200px] rounded-lg border border-border bg-background px-2 py-2 text-foreground shadow-lg">
              {pin.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote MLS URLs; Leaflet tooltip context
                <img
                  src={pin.image_url}
                  alt=""
                  className="mb-1.5 h-20 w-full rounded-md object-cover"
                  loading="lazy"
                />
              ) : null}
              <p className="text-xs font-semibold leading-snug line-clamp-2">{pin.title}</p>
              <p className="text-sm font-bold text-foreground">{formatPriceUsd(pin.price_cents)}</p>
            </div>
          </Tooltip>
          <Popup>
            <div className="min-w-[180px] text-foreground">
              {pin.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pin.image_url}
                  alt=""
                  className="mb-2 h-24 w-full rounded-md object-cover"
                  loading="lazy"
                />
              ) : null}
              <p className="text-sm font-semibold">{pin.title}</p>
              <p className="text-base font-bold">{formatPriceUsd(pin.price_cents)}</p>
              <p className="text-xs text-muted-foreground">
                {pin.bedrooms} bd · {pin.bathrooms} ba · {pin.city}, {pin.state}
              </p>
              <Link
                href={pin.href}
                className="mt-2 inline-block text-xs font-semibold text-ring underline underline-offset-2"
              >
                View details →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
