"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
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

export interface MapPin {
  id: string;
  title: string;
  lat: number;
  lng: number;
  price_cents: number;
  slug: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
}

export default function ListingsMap({ pins }: { pins: MapPin[] }) {
  if (pins.length === 0) return null;

  const avgLat = pins.reduce((s, p) => s + p.lat, 0) / pins.length;
  const avgLng = pins.reduce((s, p) => s + p.lng, 0) / pins.length;

  return (
    <MapContainer
      center={[avgLat, avgLng]}
      zoom={10}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
                href={`/listings/${pin.slug}`}
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
