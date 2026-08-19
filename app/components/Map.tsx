'use client';

import { useEffect, useState, useRef } from 'react';
import Map, { Source, Layer, MapRef, Marker, Popup } from 'react-map-gl/maplibre';
import { Navigation, TrainFront } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

// --- DATA SCHEMA EXPORTS ---
export interface FocusState { lat: number; lng: number; zoom: number; pitch: number; bearing: number; trigger: number; }
export interface Train { id: string; stateCode: string; lat: number; lng: number; status: string; heading: number; speed: number; eta: string; }
export interface WorkerNode { id: string; codename: string; stateCode: string; lat: number; lng: number; status: string; battery: number; rssi: number; }

interface MapProps {
  showNodes: boolean;
  focusState: FocusState | null;
  isDarkMode: boolean;
  liveTrains: Train[];
  workerNodes: WorkerNode[];
}

export default function MapComponent({ showNodes, focusState, isDarkMode, liveTrains, workerNodes }: MapProps) {
  const mapRef = useRef<MapRef>(null);
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);

  useEffect(() => {
    fetch('/Railways.json').then(res => res.json()).then(data => setGeoData(data)).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (focusState && mapRef.current) {
      mapRef.current.flyTo({
        center: [focusState.lng, focusState.lat],
        zoom: focusState.zoom, pitch: focusState.pitch || 45, bearing: focusState.bearing || 0,
        duration: 2500, essential: true
      });
    }
  }, [focusState]);

  const mapStyle = isDarkMode ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: 8.6753, latitude: 9.0820, zoom: 5.5, pitch: 45, bearing: 0 }}
      maxBounds={[2.67, 4.27, 14.68, 13.89]}
      mapStyle={mapStyle}
      style={{ width: '100%', height: '100%' }}
    >
      {/* RAILWAYS */}
      {geoData && (
        <Source id="railways" type="geojson" data={geoData}>
          <Layer id="railway-lines" type="line" paint={{ 'line-color': isDarkMode ? '#d4af37' : '#1d4ed8', 'line-width': 3, 'line-opacity': 0.8 }} />
        </Source>
      )}

      {/* FILTERED SENSORS */}
      {showNodes && (
        <Source id="worker-nodes" type="geojson" data={{ type: 'FeatureCollection', features: workerNodes.map(n => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [n.lng, n.lat] }, properties: { status: n.status } })) }}>
          <Layer id="node-points" type="circle" paint={{ 'circle-radius': 5, 'circle-color': ['match', ['get', 'status'], 'alert', '#ef4444', 'low_battery', '#eab308', 'healthy', '#22c55e', '#ffffff'], 'circle-stroke-width': 2, 'circle-stroke-color': isDarkMode ? '#000' : '#fff' }} />
        </Source>
      )}

      {/* FILTERED LIVE TRAINS */}
      {liveTrains.map((train) => (
        <Marker key={train.id} longitude={train.lng} latitude={train.lat} anchor="center">
          <div onClick={(e) => { e.stopPropagation(); setSelectedTrain(train); }} className="relative flex items-center justify-center cursor-pointer" style={{ transition: 'transform 2s linear' }}>
            <div className={`absolute w-10 h-10 rounded-full animate-ping opacity-50 ${train.status === 'moving' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div className={`relative z-10 p-1.5 rounded-full shadow-lg border-2 ${isDarkMode ? 'border-black' : 'border-white'} ${train.status === 'moving' ? 'bg-green-500 text-white' : 'bg-red-500 text-white animate-pulse'}`} style={{ transform: `rotate(${train.heading}deg)` }}>
              <Navigation size={14} fill="currentColor" />
            </div>
          </div>
        </Marker>
      ))}

      {/* TOOLTIP */}
      {selectedTrain && (
        <Popup longitude={selectedTrain.lng} latitude={selectedTrain.lat} anchor="bottom" onClose={() => setSelectedTrain(null)} closeButton={false} offset={20}>
          <div className="p-2 text-slate-900 min-w-[140px]">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-2">
              <TrainFront size={16} className="text-blue-600"/>
              <span className="font-bold font-mono text-sm">{selectedTrain.id}</span>
            </div>
            <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Speed:</span><span className="font-bold">{selectedTrain.speed} km/h</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">ETA:</span><span className="font-bold text-blue-600">{selectedTrain.eta}</span></div>
          </div>
        </Popup>
      )}
    </Map>
  );
}