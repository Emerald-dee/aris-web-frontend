export type Aspect = 'nominal' | 'caution' | 'critical';

export interface FocusState {
  lat: number;
  lng: number;
  zoom: number;
  pitch: number;
  bearing: number;
  trigger: number;
}

export interface Train {
  id: string;
  stateCode: string;
  lat: number;
  lng: number;
  status: 'moving' | 'stopped';
  heading: number;
  speed: number;
  eta: string;
  /** Distance travelled along the assigned route, 0..1 */
  progress: number;
  routeId: string;
}

export interface WorkerNode {
  id: string;
  codename: string;
  stateCode: string;
  lat: number;
  lng: number;
  status: 'healthy' | 'low_battery' | 'alert';
  battery: number;
  rssi: number;
}

export const TRAIN_ASPECT: Record<Train['status'], Aspect> = {
  moving: 'nominal',
  stopped: 'critical',
};

export const NODE_ASPECT: Record<WorkerNode['status'], Aspect> = {
  healthy: 'nominal',
  low_battery: 'caution',
  alert: 'critical',
};

export const ASPECT_HEX: Record<Aspect, string> = {
  nominal: '#0B6E4F',
  caution: '#A8710C',
  critical: '#B0231E',
};

export const REGIONS = [
  { code: 'National', label: 'National overview', lat: 9.082, lng: 8.6753, zoom: 5.4 },
  { code: 'Abuja', label: 'Abuja (FCT)', lat: 9.0579, lng: 7.4951, zoom: 8.4 },
  { code: 'Kaduna', label: 'Kaduna state', lat: 10.5222, lng: 7.4383, zoom: 7.6 },
  { code: 'Lagos', label: 'Lagos state', lat: 6.5244, lng: 3.3792, zoom: 9.2 },
] as const;
