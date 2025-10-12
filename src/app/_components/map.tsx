"use client";

import { useState } from "react";
import Map from "react-map-gl/mapbox";
import { env } from "@/env";

export function MapboxMap() {
  const [viewState, setViewState] = useState({
    longitude: -79.982131,
    latitude: 42.118093,
    zoom: 16.09,
	pitch: 43,
  });

  return (
    <div className="w-full h-screen">
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapboxAccessToken={env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
        style={{ width: "100%", height: "100%" }}
        mapStyle={env.NEXT_PUBLIC_MAPBOX_STYLE_ID}
      />
    </div>
  );
}
