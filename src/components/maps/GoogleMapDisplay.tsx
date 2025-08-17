import React from "react";
import { Box } from "@chakra-ui/react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { getGoogleMapsKey } from "@utils/maps";

type MarkerShape = { id: string; lat: number; lng: number; label?: string };

export default function GoogleMapDisplay({ 
  lat, 
  lng, 
  markers = [] as MarkerShape[] 
}: { 
  lat: number; 
  lng: number; 
  markers?: MarkerShape[] 
}) {
  const apiKey = getGoogleMapsKey();

  // If API key is not provided, do not render the map
  if (!apiKey) {
    return <Box color="red.500">Google Maps API key missing — add it at src/utils/maps.ts</Box>;
  }

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });

  const center = { lat, lng };

  return (
    <Box h="100%" w="100%">
      {!isLoaded ? (
        <Box>Loading map…</Box>
      ) : (
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={center}
          zoom={14}
        >
          {markers.map((m) => (
            <Marker key={m.id} position={{ lat: m.lat, lng: m.lng }} title={m.label} />
          ))}
        </GoogleMap>
      )}
    </Box>
  );
}