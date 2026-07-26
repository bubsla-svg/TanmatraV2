"use client"; // Justification: client-side Leaflet interactive map rendering and coordinate drag events.
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Coords {
  lat: number;
  lng: number;
}

function MapEvents({
  coords,
  recenterSeq,
  onDragEnd,
}: {
  coords: Coords;
  recenterSeq: number;
  onDragEnd: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const initialRef = useRef(true);

  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      return;
    }
    map.setView([coords.lat, coords.lng], Math.max(map.getZoom(), 16));
  }, [recenterSeq, coords.lat, coords.lng, map]);

  useMapEvents({
    dragend() {
      const center = map.getCenter();
      onDragEnd(center.lat, center.lng);
    },
  });

  return null;
}

/**
 * Interactive canvas-free map picker using OSM Leaflet tiles.
 * Displays a fixed central pin with instruction tooltip while the map scrolls beneath.
 */
export default function LocationPickerMap({
  coords,
  recenterSeq,
  onDragEnd,
}: {
  coords: Coords;
  recenterSeq: number;
  onDragEnd: (lat: number, lng: number) => void;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--bg)]">
      <MapContainer
        center={[coords.lat, coords.lng]}
        zoom={16}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapEvents coords={coords} recenterSeq={recenterSeq} onDragEnd={onDragEnd} />
      </MapContainer>

      {/* Fixed central pin overlay with instruction tooltip */}
      <div className="pointer-events-none absolute inset-0 z-[500] flex flex-col items-center justify-center">
        <div className="mb-1 rounded-full bg-ink px-3 py-1.5 shadow-md">
          <span className="text-xs font-semibold text-bg">Move the pin to adjust your location</span>
        </div>
        {/* Pin marker */}
        <div className="-mt-1 flex flex-col items-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-[var(--gold)] shadow-xl">
            <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="4" />
            </svg>
          </div>
          <div className="h-3 w-1 bg-[var(--gold)]" />
          <div className="h-2 w-6 rounded-full bg-ink opacity-40 blur-xs" />
        </div>
      </div>
    </div>
  );
}
