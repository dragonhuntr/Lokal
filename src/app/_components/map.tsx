"use client";

import { useState, useEffect } from "react";
import Map, { Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { env } from "@/env";

export function MapboxMap() {
  const [viewState, setViewState] = useState({
    longitude: -79.982131,
    latitude: 42.118093,
    zoom: 16.09,
    pitch: 43,
  });
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log("User location obtained:", latitude, longitude);
          setUserLocation({ latitude, longitude });
          setViewState((prev) => ({
            ...prev,
            latitude,
            longitude,
            zoom: 16,
          }));
        },
        (error) => {
          console.error("Error getting location:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else {
      console.log("Geolocation not supported");
    }
  }, []);

  return (
    <div className="w-full h-screen">
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapboxAccessToken={env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
        style={{ width: "100%", height: "100%" }}
        mapStyle={env.NEXT_PUBLIC_MAPBOX_STYLE_ID}
      >
        {userLocation ? (
          <Marker
            latitude={userLocation.latitude}
            longitude={userLocation.longitude}
            anchor="center"
          >
            <div className="w-6 h-6 bg-red-500 border-2 border-white rounded-full shadow-lg"></div>
          </Marker>
        ) : (
          <div className="absolute top-4 left-4 bg-white bg-opacity-90 text-black px-3 py-2 rounded shadow-lg z-10">
            Waiting for location permission...
          </div>
        )}
      </Map>
    </div>
  );
}
