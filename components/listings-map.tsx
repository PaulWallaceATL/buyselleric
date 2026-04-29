"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import Link from "next/link";
import { formatPriceUsd } from "@/lib/format";
import type { MapPolygonVertex } from "@/lib/map-polygon-query";

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

function screenEventToLatLng(map: L.Map, e: MouseEvent): L.LatLng {
  const c = map.getContainer();
  const r = c.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  return map.containerPointToLatLng(L.point(x, y));
}

/** Freehand stroke: pointer follows like a crayon; release to apply lasso. */
function MapFreehandDrawer({
  active,
  onComplete,
  onStrokeRejected,
}: {
  active: boolean;
  onComplete: (ring: MapPolygonVertex[]) => void;
  onStrokeRejected?: (() => void) | undefined;
}) {
  const map = useMap();
  const previewRef = useRef<L.Polyline | null>(null);
  const ringRef = useRef<L.LatLng[]>([]);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!active) {
      if (previewRef.current) {
        map.removeLayer(previewRef.current);
        previewRef.current = null;
      }
      ringRef.current = [];
      draggingRef.current = false;
      map.dragging.enable();
      map.getContainer().classList.remove("cursor-crosshair");
      return;
    }

    const container = map.getContainer();
    container.classList.add("cursor-crosshair");

    const lineStyle = {
      color: "#6eb8c0",
      weight: 3,
      opacity: 0.95,
    } as const;

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (!container.contains(t)) return;
      if (t?.closest?.(".leaflet-marker-icon,.leaflet-popup")) return;

      e.preventDefault();
      draggingRef.current = true;
      const ll = screenEventToLatLng(map, e);
      ringRef.current = [ll];
      if (previewRef.current) map.removeLayer(previewRef.current);
      previewRef.current = L.polyline([[ll.lat, ll.lng]], lineStyle).addTo(map);
      map.dragging.disable();
    };

    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const ll = screenEventToLatLng(map, e);
      appendIfFar(map, ringRef.current, ll);
      previewRef.current?.setLatLngs(ringRef.current.map((p) => [p.lat, p.lng]));
    };

    const finish = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      map.dragging.enable();
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
      onComplete(out);
    };

    container.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", finish);

    return () => {
      container.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", finish);
      if (previewRef.current) {
        map.removeLayer(previewRef.current);
        previewRef.current = null;
      }
      ringRef.current = [];
      draggingRef.current = false;
      map.dragging.enable();
      container.classList.remove("cursor-crosshair");
    };
  }, [active, map, onComplete, onStrokeRejected]);

  return null;
}

function FitAppliedPolygon({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 2) return;
    const b = L.latLngBounds(positions);
    map.fitBounds(b, { padding: [28, 28], maxZoom: 15, animate: true });
  }, [map, positions]);
  return null;
}

export default function ListingsMap({
  pins,
  fallbackCenter,
  appliedPolygon,
  drawActive,
  onApplyPolygon,
  onStrokeRejected,
}: {
  pins: MapPin[];
  fallbackCenter: { lat: number; lng: number };
  appliedPolygon?: ReadonlyArray<MapPolygonVertex> | null;
  drawActive: boolean;
  onApplyPolygon: (ring: MapPolygonVertex[]) => void;
  onStrokeRejected?: (() => void) | undefined;
}) {
  const avgLat = pins.length > 0 ? pins.reduce((s, p) => s + p.lat, 0) / pins.length : fallbackCenter.lat;
  const avgLng = pins.length > 0 ? pins.reduce((s, p) => s + p.lng, 0) / pins.length : fallbackCenter.lng;

  const polyPositions = useMemo((): [number, number][] => {
    if (!appliedPolygon || appliedPolygon.length < 3) return [];
    return appliedPolygon.map((p) => [p.lat, p.lng] as [number, number]);
  }, [appliedPolygon]);

  const center: [number, number] =
    polyPositions.length >= 2
      ? [
          polyPositions.reduce((s, p) => s + p[0], 0) / polyPositions.length,
          polyPositions.reduce((s, p) => s + p[1], 0) / polyPositions.length,
        ]
      : [avgLat, avgLng];

  const onComplete = useCallback(
    (ring: MapPolygonVertex[]) => {
      onApplyPolygon(ring);
    },
    [onApplyPolygon],
  );

  const zoom = polyPositions.length >= 2 ? 12 : pins.length > 0 ? 10 : 9;

  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {polyPositions.length >= 3 && (
        <>
          <Polygon
            positions={polyPositions}
            pathOptions={{
              color: "#6eb8c0",
              fillColor: "#6eb8c0",
              fillOpacity: 0.12,
              weight: 2,
            }}
          />
          <FitAppliedPolygon positions={polyPositions} />
        </>
      )}
      <MapFreehandDrawer
        active={drawActive}
        onComplete={onComplete}
        onStrokeRejected={onStrokeRejected}
      />
      {pins.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={icon}>
          <Popup>
            <div className="min-w-[180px]">
              <p className="text-sm font-semibold">{pin.title}</p>
              <p className="text-base font-bold">{formatPriceUsd(pin.price_cents)}</p>
              <p className="text-xs text-gray-600">
                {pin.bedrooms} bd · {pin.bathrooms} ba · {pin.city}, {pin.state}
              </p>
              <Link
                href={pin.href}
                className="mt-2 inline-block text-xs font-semibold text-blue-600 underline underline-offset-2"
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
