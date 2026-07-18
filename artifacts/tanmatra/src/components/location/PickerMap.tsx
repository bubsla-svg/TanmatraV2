import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "@phosphor-icons/react";

// IMPORTANT: this module is loaded via React.lazy from LocationPickerFlow so
// Leaflet (which touches `window` at import time) is only pulled into the
// client bundle — importing it at the top level of a prerendered route would
// crash `react-router build`. Keep all leaflet/react-leaflet imports here.

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Bridges map events to the parent. `dragend` fires only for user drags (not
 * the programmatic setView we do on GPS/search), so recentres never loop back
 * into a reverse-geocode.
 */
function MapEvents({
  coords,
  recenterSeq,
  onDragEnd,
}: {
  coords: LatLng;
  recenterSeq: number;
  onDragEnd: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const firstRef = useRef(true);
  useEffect(() => {
    // Initial centre comes from MapContainer's `center` prop; only act on
    // subsequent GPS/search recentres.
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    map.setView([coords.lat, coords.lng], Math.max(map.getZoom(), 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSeq]);
  useMapEvents({
    dragend() {
      const c = map.getCenter();
      onDragEnd(c.lat, c.lng);
    },
  });
  return null;
}

/**
 * Drag-to-position map for the address picker. OpenStreetMap tiles via
 * Leaflet — no Google Maps JS (disabled on the frontend key). The pin is a
 * fixed centre overlay; the user drags the map beneath it (Swiggy/Zomato
 * pattern) and the parent reverse-geocodes the centre on drag-end.
 */
export default function PickerMap({
  coords,
  recenterSeq,
  onDragEnd,
}: {
  coords: LatLng;
  recenterSeq: number;
  onDragEnd: (lat: number, lng: number) => void;
}) {
  return (
    <>
      <MapContainer
        center={[coords.lat, coords.lng]}
        zoom={16}
        zoomControl={false}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapEvents coords={coords} recenterSeq={recenterSeq} onDragEnd={onDragEnd} />
      </MapContainer>
      {/* Fixed centre pin — the map slides beneath it. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 500,
        }}
      >
        <MapPin
          weight="fill"
          className="w-8 h-8 drop-shadow-lg"
          style={{
            color: "var(--safb)",
            transform: "translateY(-14px)",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          zIndex: 600,
          background: "var(--s1)",
          border: "1px solid var(--ln)",
          borderRadius: 6,
          padding: "3px 8px",
        }}
      >
        <span className="text-[10px]" style={{ color: "var(--mut)" }}>
          Drag the map to move the pin
        </span>
      </div>
    </>
  );
}
