import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { reverseGeocode } from '../services/geocoding.service';

// Fix default marker icon (known Leaflet + bundler issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom pin icons to match FarmX brand color-codes
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const greyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface Coordinates {
  lat: number;
  lng: number;
}

interface FarmField {
  id: string;
  label: string;
  ha: number;
  lat: number;
  lng: number;
  soil: string;
  lastCrop: string;
}

// Recenter map dynamically when target coordinates change
function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Click listener inside react-leaflet context
function MapClickHandler({ onPin }: { onPin: (coords: Coordinates) => void }) {
  useMapEvents({
    click(e) {
      onPin({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export function CropPredictionMap({
  center,
  farmFields,
  activeField,
  customLocation,
  onFieldSelect,
  onLocationSelected,
}: {
  center: Coordinates;
  farmFields: FarmField[];
  activeField: number;
  customLocation: Coordinates | null;
  onFieldSelect: (index: number) => void;
  onLocationSelected: (coords: Coordinates, placeName: string) => void;
}) {
  const mapCenter: [number, number] = [center.lat, center.lng];

  async function handleMapClick(coords: Coordinates) {
    const placeName = await reverseGeocode(coords);
    onLocationSelected(coords, placeName);
  }

  return (
    <div className="w-full h-full relative" id="crop_prediction_osm_wrapper">
      <MapContainer
        center={mapCenter}
        zoom={11}
        style={{ width: '100%', height: '100%', minHeight: '260px' }}
        id="crop_prediction_osm_map"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Sync camera with state changes */}
        <RecenterMap center={mapCenter} />

        {/* Capture generic map click coordinates */}
        <MapClickHandler onPin={handleMapClick} />

        {/* Fixed Farm fields markers */}
        {farmFields.map((field, index) => (
          <Marker
            key={field.id}
            position={[field.lat, field.lng]}
            icon={activeField === index ? greenIcon : greyIcon}
            eventHandlers={{
              click: () => {
                onFieldSelect(index);
              },
            }}
          >
            <Popup>
              <div className="p-1 font-sans">
                <p className="font-bold text-emerald-800 text-sm">{field.label}</p>
                <p className="text-xs text-gray-600 mt-0.5">{field.soil} · {field.ha} hectares</p>
                <p className="text-[10px] text-gray-500 font-mono mt-1">Lat: {field.lat.toFixed(4)}, Lng: {field.lng.toFixed(4)}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Custom dropped pin indicator */}
        {activeField === -1 && customLocation && (
          <Marker position={[customLocation.lat, customLocation.lng]} icon={redIcon}>
            <Popup>
              <div className="p-1 font-sans">
                <p className="font-bold text-red-600 text-sm">Inspected Location</p>
                <p className="text-[10px] text-gray-500 font-mono mt-1">Lat: {customLocation.lat.toFixed(4)}, Lng: {customLocation.lng.toFixed(4)}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
