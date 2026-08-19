'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Popup, Source, type MapRef } from 'react-map-gl/maplibre';
import { Navigation } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { NIGERIA_FIT, NIGERIA_MAX, ROUTE_LIST } from '../lib/fleet';
import { classifyRailways, logTrackProperties, useNigeriaBorder } from '../lib/geo';
import {
  ASPECT_HEX,
  NODE_ASPECT,
  TRAIN_ASPECT,
  type FocusState,
  type Train,
  type WorkerNode,
} from '../lib/types';

interface Props {
  trains: Train[];
  nodes: WorkerNode[];
  showNodes: boolean;
  showRoutes: boolean;
  night: boolean;
  focus: FocusState | null;
  selectedId: string | null;
  /** Left inset in px occupied by the tool rail and any open panel. */
  insetLeft: number;
  /** Bottom inset in px occupied by the telemetry shelf. */
  insetBottom: number;
  onSelect: (id: string) => void;
}

export default function MapCanvas({
  trains,
  nodes,
  showNodes,
  showRoutes,
  night,
  focus,
  selectedId,
  insetLeft,
  insetBottom,
  onSelect,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const steered = useRef(false);
  const insets = useRef({ left: insetLeft, bottom: insetBottom });
  insets.current = { left: insetLeft, bottom: insetBottom };

  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [geoError, setGeoError] = useState(false);

  /* The previous version set a hardcoded zoom of 5.5 and relied on maxBounds.
     maxBounds only constrains panning — it never fits. Nigeria's bbox is close
     to square, so at fixed zoom in a wide viewport the country floats among its
     neighbours. Fit explicitly, and pad for the chrome so nothing important
     ends up underneath a panel. */
  const fitNetwork = useCallback((animate: boolean) => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.setMinZoom(0);
    map.fitBounds(NIGERIA_FIT, {
      padding: {
        top: 24,
        right: 24,
        left: insets.current.left + 24,
        bottom: insets.current.bottom + 24,
      },
      duration: animate ? 650 : 0,
    });
    if (!animate) map.setMinZoom(Math.max(0, map.getZoom() - 0.4));
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.resize();
      if (!steered.current) fitNetwork(false);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [fitNetwork]);

  /* Re-fit when the chrome changes width, so opening a panel nudges the
     content clear rather than hiding it. */
  useEffect(() => {
    if (steered.current) return;
    const id = window.setTimeout(() => fitNetwork(true), 60);
    return () => window.clearTimeout(id);
  }, [insetLeft, insetBottom, fitNetwork]);

  const { border, mask, missing: borderMissing } = useNigeriaBorder();

  useEffect(() => {
    fetch('/Railways.json')
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((fc: GeoJSON.FeatureCollection) => {
        if (process.env.NODE_ENV === 'development') logTrackProperties(fc);
        setGeoData(classifyRailways(fc));
      })
      .catch(() => setGeoError(true));
  }, []);

  useEffect(() => {
    if (!focus) return;
    steered.current = true;
    mapRef.current?.flyTo({
      center: [focus.lng, focus.lat],
      zoom: focus.zoom,
      pitch: focus.pitch,
      bearing: focus.bearing,
      padding: { top: 0, right: 0, bottom: insets.current.bottom, left: insets.current.left },
      duration: 1600,
      essential: true,
    });
  }, [focus]);

  const routeData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: ROUTE_LIST.map((route) => ({
        type: 'Feature' as const,
        properties: { id: route.id, name: route.name, trackClass: route.trackClass },
        geometry: { type: 'LineString' as const, coordinates: route.path },
      })),
    }),
    [],
  );

  const nodeData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: nodes.map((n) => ({
        type: 'Feature' as const,
        properties: { aspect: NODE_ASPECT[n.status], codename: n.codename },
        geometry: { type: 'Point' as const, coordinates: [n.lng, n.lat] },
      })),
    }),
    [nodes],
  );

  const selected = trains.find((t) => t.id === selectedId) ?? null;

  const style = night
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

  return (
    <div ref={hostRef} className="canvas">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 8.6753, latitude: 9.082, zoom: 5 }}
        maxBounds={NIGERIA_MAX}
        mapStyle={style}
        style={{ width: '100%', height: '100%' }}
        onLoad={() => fitNetwork(false)}
        onDragStart={() => {
          steered.current = true;
        }}
        onZoomStart={(e) => {
          if (e.originalEvent) steered.current = true;
        }}
      >
        {/* Everything outside the national border, dimmed. Neighbours stay
            legible as context but read unmistakably as "not Nigeria". */}
        {mask && (
          <Source id="outside-nigeria" type="geojson" data={mask}>
            <Layer
              id="outside-fill"
              type="fill"
              paint={{
                'fill-color': night ? '#050a0d' : '#8ea3b2',
                'fill-opacity': night ? 0.62 : 0.28,
              }}
            />
          </Source>
        )}

        {border && (
          <Source id="nigeria-border" type="geojson" data={border}>
            <Layer
              id="border-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': night ? '#0b1218' : '#ffffff',
                'line-width': 4,
                'line-opacity': 0.85,
              }}
            />
            <Layer
              id="border-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': night ? '#9fb1bd' : '#3d5464',
                'line-width': 1.6,
              }}
            />
          </Source>
        )}

        {geoData && (
          <Source id="railways" type="geojson" data={geoData}>
            <Layer
              id="railway-lines"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': [
                  'match',
                  ['get', 'trackClass'],
                  'metro',
                  night ? '#c98ad6' : '#7b3d95',
                  night ? '#6fa5e0' : '#16457a',
                ],
                'line-width': ['match', ['get', 'trackClass'], 'metro', 1.1, 1.5],
                'line-opacity': 0.5,
              }}
            />
          </Source>
        )}

        {showRoutes && (
          <Source id="routes" type="geojson" data={routeData}>
            <Layer
              id="route-lines"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': [
                  'match',
                  ['get', 'trackClass'],
                  'metro',
                  night ? '#c98ad6' : '#7b3d95',
                  night ? '#6fa5e0' : '#16457a',
                ],
                /* Metro lines are short and dense, so they get a dash pattern
                   as well as a hue — colour alone fails for the ~8% of men
                   with a red/green or blue/purple confusion. */
                'line-dasharray': ['match', ['get', 'trackClass'], 'metro', ['literal', [2, 1.4]], ['literal', [1]]],
                'line-width': ['match', ['get', 'trackClass'], 'metro', 2.6, 2.4],
                'line-opacity': 0.95,
              }}
            />
          </Source>
        )}

        {showNodes && (
          <Source id="worker-nodes" type="geojson" data={nodeData}>
            <Layer
              id="node-halo"
              type="circle"
              paint={{
                'circle-radius': 7,
                'circle-color': [
                  'match',
                  ['get', 'aspect'],
                  'critical',
                  ASPECT_HEX.critical,
                  'caution',
                  ASPECT_HEX.caution,
                  ASPECT_HEX.nominal,
                ],
                'circle-opacity': 0.14,
              }}
            />
            <Layer
              id="node-points"
              type="circle"
              paint={{
                'circle-radius': 3.2,
                'circle-color': [
                  'match',
                  ['get', 'aspect'],
                  'critical',
                  ASPECT_HEX.critical,
                  'caution',
                  ASPECT_HEX.caution,
                  ASPECT_HEX.nominal,
                ],
                'circle-stroke-width': 1.2,
                'circle-stroke-color': night ? '#121c23' : '#ffffff',
              }}
            />
          </Source>
        )}

        {trains.map((train) => {
          const tone = ASPECT_HEX[TRAIN_ASPECT[train.status]];
          const isSelected = train.id === selectedId;
          return (
            <Marker key={train.id} longitude={train.lng} latitude={train.lat} anchor="center">
              <button
                type="button"
                className="contact"
                style={{ ['--tone' as string]: tone }}
                aria-label={`${train.id}, ${train.status}, ${Math.round(train.speed)} km/h`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(train.id);
                }}
              >
                {train.status === 'stopped' && <span className="contact-halo" aria-hidden />}
                {isSelected && (
                  <span className="reticle locking" aria-hidden>
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                )}
                <span className="contact-mark">
                  {/* Rotate the glyph only. The previous version rotated the
                      whole badge, so the coloured disc span as well. */}
                  <Navigation
                    size={9}
                    fill="currentColor"
                    style={{ transform: `rotate(${train.heading}deg)` }}
                  />
                </span>
              </button>
            </Marker>
          );
        })}

        {selected && (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="bottom"
            offset={24}
            closeButton={false}
            closeOnClick={false}
          >
            <div className="callout">
              <div className="callout-head">
                <span className="fleet-id">{selected.id}</span>
                <span
                  className="fleet-state"
                  style={{ ['--tone' as string]: ASPECT_HEX[TRAIN_ASPECT[selected.status]] }}
                >
                  {selected.status === 'moving' ? 'En route' : 'Halted'}
                </span>
              </div>
              <div className="callout-body">
                <div className="callout-row">
                  <span>Speed</span>
                  <b>{Math.round(selected.speed)} km/h</b>
                </div>
                <div className="callout-row">
                  <span>Heading</span>
                  <b>{String(Math.round((selected.heading + 360) % 360)).padStart(3, '0')}&deg;</b>
                </div>
                <div className="callout-row">
                  <span>Position</span>
                  <b>
                    {selected.lat.toFixed(3)}&deg;N {selected.lng.toFixed(3)}&deg;E
                  </b>
                </div>
                <div className="callout-row">
                  <span>Arrives</span>
                  <b>{selected.eta}</b>
                </div>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {geoError && (
        <div className="map-note" style={{ left: insetLeft + 10 }}>
          Track geometry didn&rsquo;t load. Check that Railways.json is in the public folder.
        </div>
      )}

      <div className="legend" style={{ left: insetLeft + 10 }}>
        <span className="legend-item" style={{ ['--tone' as string]: 'var(--track-interstate)' }}>
          <span className="rule" /> Interstate
        </span>
        <span className="legend-item" style={{ ['--tone' as string]: 'var(--track-metro)' }}>
          <span className="rule dashed" /> Metro
        </span>
        <span className="legend-sep" aria-hidden />
        <span className="legend-item" style={{ ['--tone' as string]: ASPECT_HEX.nominal }}>
          <span className="swatch" /> Nominal
        </span>
        <span className="legend-item" style={{ ['--tone' as string]: ASPECT_HEX.caution }}>
          <span className="swatch" /> Caution
        </span>
        <span className="legend-item" style={{ ['--tone' as string]: ASPECT_HEX.critical }}>
          <span className="swatch" /> Critical
        </span>
      </div>

      {borderMissing && (
        <div className="map-note" style={{ left: insetLeft + 10, top: geoError ? 68 : 10 }}>
          National outline unavailable. Add nigeria-adm0.geojson to the public folder to
          show Nigeria&rsquo;s border.
        </div>
      )}
    </div>
  );
}
