'use client';

import { useEffect, useState } from 'react';
import type { Train, WorkerNode } from './types';

/**
 * Route polylines. The previous simulator incremented lat/lng by a fixed delta
 * every tick, so trains left the rail line immediately and eventually left the
 * country. Positions are now interpolated along a real path and clamped to it.
 */
export type TrackClass = 'interstate' | 'metro';

export interface Route {
  id: string;
  name: string;
  trackClass: TrackClass;
  path: [number, number][];
}

export const ROUTE_LIST: Route[] = [
  {
    id: 'abuja-kaduna',
    name: 'Abuja \u2013 Kaduna',
    trackClass: 'interstate',
    path: [
      [7.354, 9.016],
      [7.313, 9.153],
      [7.302, 9.395],
      [7.48, 9.655],
      [7.522, 9.788],
      [7.436, 10.407],
      [7.383, 10.545],
    ],
  },
  {
    id: 'lagos-ibadan',
    name: 'Lagos \u2013 Ibadan',
    trackClass: 'interstate',
    path: [
      [3.377, 6.487],
      [3.32, 6.626],
      [3.234, 6.822],
      [3.351, 7.152],
      [3.756, 7.362],
      [3.895, 7.523],
    ],
  },
  {
    id: 'lagos-blue',
    name: 'Lagos blue line',
    trackClass: 'metro',
    path: [
      [3.397, 6.45],
      [3.343, 6.457],
      [3.312, 6.466],
      [3.271, 6.462],
      [3.222, 6.457],
      [3.18, 6.443],
    ],
  },
  {
    id: 'abuja-metro',
    name: 'Abuja light rail',
    trackClass: 'metro',
    path: [
      [7.494, 9.058],
      [7.446, 9.024],
      [7.398, 9.007],
      [7.354, 9.016],
      [7.312, 9.0],
    ],
  },
];

export const ROUTES: Record<string, [number, number][]> = Object.fromEntries(
  ROUTE_LIST.map((r) => [r.id, r.path]),
);

export const ROUTE_CLASS: Record<string, TrackClass> = Object.fromEntries(
  ROUTE_LIST.map((r) => [r.id, r.trackClass]),
);

export const NIGERIA_FIT: [[number, number], [number, number]] = [
  [2.67, 4.27],
  [14.68, 13.89],
];

/** Slacker than the fit box — if the pan limit equals the fit target, fitBounds gets clamped. */
export const NIGERIA_MAX: [[number, number], [number, number]] = [
  [1.2, 2.8],
  [16.2, 15.4],
];

export function pointOnRoute(routeId: string, progress: number) {
  const route = ROUTES[routeId] ?? ROUTES['abuja-kaduna'];
  const t = Math.max(0, Math.min(1, progress)) * (route.length - 1);
  const i = Math.min(route.length - 2, Math.floor(t));
  const f = t - i;

  const [lng1, lat1] = route[i];
  const [lng2, lat2] = route[i + 1];
  const lat = lat1 + (lat2 - lat1) * f;
  const lng = lng1 + (lng2 - lng1) * f;

  const dLat = lat2 - lat1;
  const dLng = (lng2 - lng1) * Math.cos((lat * Math.PI) / 180);
  const heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;

  return { lat, lng, heading };
}

export const INITIAL_NODES: WorkerNode[] = [
  { id: 'WN-01', codename: 'FCT-NODE-01', stateCode: 'Abuja', lat: 9.15, lng: 7.48, status: 'healthy', battery: 92, rssi: -45 },
  { id: 'WN-02', codename: 'FCT-NODE-02', stateCode: 'Abuja', lat: 9.05, lng: 7.45, status: 'healthy', battery: 88, rssi: -42 },
  { id: 'WN-03', codename: 'KD-NODE-01', stateCode: 'Kaduna', lat: 10.05, lng: 7.43, status: 'alert', battery: 45, rssi: -85 },
  { id: 'WN-04', codename: 'KD-NODE-02', stateCode: 'Kaduna', lat: 10.2, lng: 7.4, status: 'low_battery', battery: 15, rssi: -70 },
  { id: 'WN-05', codename: 'LG-NODE-01', stateCode: 'Lagos', lat: 6.52, lng: 3.37, status: 'healthy', battery: 100, rssi: -30 },
];

function seed(
  id: string,
  stateCode: string,
  routeId: string,
  progress: number,
  status: Train['status'],
  speed: number,
): Train {
  const p = pointOnRoute(routeId, progress);
  return {
    id,
    stateCode,
    routeId,
    progress,
    status,
    speed,
    lat: p.lat,
    lng: p.lng,
    heading: p.heading,
    eta: status === 'moving' ? '14 min' : '\u2014',
  };
}

const SEEDS: Train[] = [
  seed('ARIS-LOCO-01', 'Abuja', 'abuja-kaduna', 0.18, 'moving', 64),
  seed('ARIS-LOCO-02', 'Kaduna', 'abuja-kaduna', 0.74, 'stopped', 0),
  seed('ARIS-LOCO-03', 'Lagos', 'lagos-ibadan', 0.42, 'moving', 88),
];

/** Replace this hook with a WebSocket or SSE subscription emitting the same shapes. */
export function useFleet() {
  const [trains, setTrains] = useState<Train[]>(SEEDS);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTrains((prev) =>
        prev.map((train) => {
          if (train.status !== 'moving') return train;
          const next = train.progress + 0.004;
          const progress = next > 1 ? 0 : next;
          const p = pointOnRoute(train.routeId, progress);
          const speed = Math.round(train.speed + (Math.random() * 6 - 3));
          return {
            ...train,
            progress,
            lat: p.lat,
            lng: p.lng,
            heading: p.heading,
            speed: Math.max(40, Math.min(110, speed)),
            eta: `${Math.max(1, Math.round((1 - progress) * 120))} min`,
          };
        }),
      );
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  return trains;
}
