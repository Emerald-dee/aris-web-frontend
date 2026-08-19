'use client';

import { useEffect, useState } from 'react';

/**
 * Nigeria's national outline.
 *
 * Expects `public/nigeria-adm0.geojson` — the geoBoundaries NGA ADM0 file.
 * Nothing here approximates the border: if the file is absent the outline and
 * the mask simply don't render, and the map reports it. See README.
 */
export const BORDER_URL = '/nigeria-adm0.geojson';

type Ring = [number, number][];

/** A rectangle comfortably larger than the visible world, in lng/lat. */
const WORLD_RING: Ring = [
  [-200, -85],
  [200, -85],
  [200, 85],
  [-200, 85],
  [-200, -85],
];

function ringsOf(geometry: GeoJSON.Geometry): Ring[] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates as Ring[];
  }
  if (geometry.type === 'MultiPolygon') {
    // Only outer rings matter as holes — interior lakes stay filled.
    return (geometry.coordinates as Ring[][]).map((poly) => poly[0]);
  }
  return [];
}

/**
 * Everything outside Nigeria, as a single polygon: a world-sized outer ring
 * with the country's rings punched out as holes. Drawn as a translucent fill,
 * this dims neighbouring countries so the national edge is unmistakable
 * without hiding context entirely.
 */
export function buildMask(border: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const holes: Ring[] = [];
  for (const feature of border.features) {
    if (feature.geometry) holes.push(...ringsOf(feature.geometry));
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [WORLD_RING, ...holes] },
      },
    ],
  };
}

/* ------------------------------------------------------------------
   Track classification
   ------------------------------------------------------------------ */

/**
 * Railways.json is third-party geometry and its property names aren't known
 * ahead of time, so classification is explicit and inspectable rather than
 * guessed. Order of precedence:
 *
 *   1. a property named in CLASS_PROPERTIES holding "metro"/"light_rail"/etc
 *   2. a feature name matching METRO_NAME_PATTERNS
 *   3. interstate (the default — most of the network is mainline)
 *
 * Run `logTrackProperties()` once in dev to see what your file actually
 * carries, then narrow these lists.
 */
const CLASS_PROPERTIES = ['railway', 'usage', 'service', 'type', 'category', 'class'];
const NAME_PROPERTIES = ['name', 'Name', 'NAME', 'line', 'route', 'ref'];

const METRO_VALUES = ['metro', 'subway', 'light_rail', 'lightrail', 'tram', 'urban', 'commuter'];
const METRO_NAME_PATTERNS = [/blue\s*line/i, /red\s*line/i, /light\s*rail/i, /metro/i];

export type TrackClass = 'interstate' | 'metro';

function readClass(props: Record<string, unknown> | null): TrackClass {
  if (!props) return 'interstate';

  for (const key of CLASS_PROPERTIES) {
    const raw = props[key];
    if (typeof raw === 'string' && METRO_VALUES.includes(raw.toLowerCase().trim())) {
      return 'metro';
    }
  }

  for (const key of NAME_PROPERTIES) {
    const raw = props[key];
    if (typeof raw === 'string' && METRO_NAME_PATTERNS.some((re) => re.test(raw))) {
      return 'metro';
    }
  }

  return 'interstate';
}

/** Returns a copy of the collection with a `trackClass` property on every feature. */
export function classifyRailways(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((feature) => ({
      ...feature,
      properties: {
        ...(feature.properties ?? {}),
        trackClass: readClass(feature.properties as Record<string, unknown> | null),
      },
    })),
  };
}

/** Dev helper: prints the property keys and sample values Railways.json carries. */
export function logTrackProperties(fc: GeoJSON.FeatureCollection) {
  const samples = new Map<string, Set<string>>();
  for (const feature of fc.features.slice(0, 400)) {
    for (const [key, value] of Object.entries(feature.properties ?? {})) {
      if (key === 'trackClass') continue;
      if (!samples.has(key)) samples.set(key, new Set());
      const set = samples.get(key)!;
      if (set.size < 8 && value != null) set.add(String(value));
    }
  }
  // eslint-disable-next-line no-console
  console.table(
    [...samples].map(([key, values]) => ({ property: key, values: [...values].join(', ') })),
  );
}

export interface BorderState {
  border: GeoJSON.FeatureCollection | null;
  mask: GeoJSON.FeatureCollection | null;
  missing: boolean;
}

export function useNigeriaBorder(): BorderState {
  const [state, setState] = useState<BorderState>({
    border: null,
    mask: null,
    missing: false,
  });

  useEffect(() => {
    let live = true;
    fetch(BORDER_URL)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data: GeoJSON.FeatureCollection) => {
        if (!live) return;
        setState({ border: data, mask: buildMask(data), missing: false });
      })
      .catch(() => {
        if (live) setState({ border: null, mask: null, missing: true });
      });
    return () => {
      live = false;
    };
  }, []);

  return state;
}
