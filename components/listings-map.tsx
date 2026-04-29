"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useRef } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import Link from "next/link";
import { formatPriceUsd } from "@/lib/format";

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const MIN_DRAW_RADIUS_M = 150;
const MAX_DRAW_RADIUS_M = 50_000;

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

export interface MapSearchCircle {
  lat: number;
  lng: number;
  radiusM: number;
}

function MapCircleDrawer({
  active,
  onComplete,
}: {
  active: boolean;
  onComplete: (lat: number, lng: number, radiusM: number) => void;
}) {
  const map = useMap();
  const previewRef = useRef<L.Circle | null>(null);
  const centerRef = useRef<L.LatLng | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!active) {
      if (previewRef.current) {
        map.removeLayer(previewRef.current);
        previewRef.current = null;
      }
      centerRef.current = null;
      draggingRef.current = false;
      map.dragging.enable();
      map.getContainer().classList.remove("cursor-crosshair");
      return;
    }

    map.getContainer().classList.add("cursor-crosshair");

    const cleanupPreview = () => {
      if (previewRef.current) {
        map.removeLayer(previewRef.current);
        previewRef.current = null;
      }
      centerRef.current = null;
      draggingRef.current = false;
      map.dragging.enable();
    };

    const onDown = (e: L.LeafletMouseEvent) => {
      if (e.originalEvent.button !== 0) return;
      const t = e.originalEvent.target as HTMLElement | null;
      if (t?.closest?.(".leaflet-marker-icon,.leaflet-popup")) return;

      centerRef.current = e.latlng;
      draggingRef.current = true;
      if (previewRef.current) map.removeLayer(previewRef.current);
      previewRef.current = L.circle(e.latlng, {
        radius: MIN_DRAW_RADIUS_M,
        color: "#6eb8c0",
        fillColor: "#6eb8c0",
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(map);
      map.dragging.disable();
    };

    const onMove = (e: L.LeafletMouseEvent) => {
      if (!draggingRef.current || !centerRef.current || !previewRef.current) return;
      const m = map.distance(centerRef.current, e.latlng);
      previewRef.current.setRadius(Math.min(MAX_DRAW_RADIUS_M, Math.max(MIN_DRAW_RADIUS_M, m)));
    };

    const finish = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      map.dragging.enable();
      const c = centerRef.current;
      const p = previewRef.current;
      if (!c || !p) return;
      const r = p.getRadius();
      map.removeLayer(p);
      previewRef.current = null;
      centerRef.current = null;
      if (r >= MIN_DRAW_RADIUS_M) {
        onComplete(c.lat, c.lng, Math.min(r, MAX_DRAW_RADIUS_M));
      }
    };

    map.on("mousedown", onDown);
    map.on("mousemove", onMove);
    map.on("mouseup", finish);
    map.on("mouseleave", finish);

    return () => {
      map.off("mousedown", onDown);
      map.off("mousemove", onMove);
      map.off("mouseup", finish);
      map.off("mouseleave", finish);
      cleanupPreview();
      map.getContainer().classList.remove("cursor-crosshair");
    };
  }, [active, map, onComplete]);

  return null;
}

export default function ListingsMap({
  pins,
  fallbackCenter,
  appliedCircle,
  drawActive,
  onApplyCircle,
}: {
  pins: MapPin[];
  /** Used when no pins have coordinates so the basemap still loads. */
  fallbackCenter: { lat: number; lng: number };
  appliedCircle?: MapSearchCircle | null;
  drawActive: boolean;
  onApplyCircle: (lat: number, lng: number, radiusM: number) => void;
}) {
  const avgLat = pins.length > 0 ? pins.reduce((s, p) => s + p.lat, 0) / pins.length : fallbackCenter.lat;
  const avgLng = pins.length > 0 ? pins.reduce((s, p) => s + p.lng, 0) / pins.length : fallbackCenter.lng;

  const center: [number, number] = appliedCircle
    ? [appliedCircle.lat, appliedCircle.lng]
    : [avgLat, avgLng];

  const onComplete = useCallback(
    (lat: number, lng: number, radiusM: number) => {
      onApplyCircle(lat, lng, radiusM);
    },
    [onApplyCircle],
  );

  const zoom = appliedCircle ? 12 : pins.length > 0 ? 10 : 9;

  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {appliedCircle && (
        <Circle
          center={[appliedCircle.lat, appliedCircle.lng]}
          radius={appliedCircle.radiusM}
          pathOptions={{
            color: "#6eb8c0",
            fillColor: "#6eb8c0",
            fillOpacity: 0.1,
            weight: 2,
          }}
        />
      )}
      <MapCircleDrawer active={drawActive} onComplete={onComplete} />
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
