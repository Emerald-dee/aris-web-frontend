'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertOctagon,
  Crosshair,
  Moon,
  Radio,
  Server,
  Sun,
  TrainTrack,
} from 'lucide-react';
import { AlertList, FleetList, Panel, SensorControls, TelemetryShelf } from './components/Panels';
import { INITIAL_NODES, useFleet } from './lib/fleet';
import { ASPECT_HEX, REGIONS, type FocusState, type WorkerNode } from './lib/types';
import './styles/console.css';

const MapCanvas = dynamic(() => import('./components/MapCanvas'), { ssr: false });

type PanelId = 'fleet' | 'sensors' | 'alerts';

const RAIL_W = 52;
const PANEL_W = 296;
const SHELF_H = 196;

export default function Home() {
  const trains = useFleet();
  const [nodes] = useState<WorkerNode[]>(INITIAL_NODES);

  const [region, setRegion] = useState('National');
  const [openPanel, setOpenPanel] = useState<PanelId | null>('fleet');
  const [shelfOpen, setShelfOpen] = useState(false);
  const [showNodes, setShowNodes] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [night, setNight] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusState | null>(null);
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'UTC',
        }),
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = night ? 'night' : 'day';
  }, [night]);

  const visibleTrains = useMemo(
    () => (region === 'National' ? trains : trains.filter((t) => t.stateCode === region)),
    [trains, region],
  );
  const visibleNodes = useMemo(
    () => (region === 'National' ? nodes : nodes.filter((n) => n.stateCode === region)),
    [nodes, region],
  );

  const alertCount = visibleNodes.filter((n) => n.status === 'alert').length;
  const meshPct = nodes.length
    ? Math.round((nodes.filter((n) => n.status === 'healthy').length / nodes.length) * 100)
    : 0;

  /* The map is full bleed. These insets tell it how much chrome overlaps it so
     fitBounds can pad around the panels instead of the layout stealing width. */
  const insetLeft = RAIL_W + (openPanel ? PANEL_W + 20 : 0);
  const insetBottom = shelfOpen ? SHELF_H : 0;

  const fly = (lat: number, lng: number, zoom: number, pitch = 0) =>
    setFocus((prev) => ({
      lat,
      lng,
      zoom,
      pitch,
      bearing: 0,
      trigger: (prev?.trigger ?? 0) + 1,
    }));

  const selectTrain = (id: string) => {
    const train = trains.find((t) => t.id === id);
    if (!train) return;
    setSelectedId(id);
    fly(train.lat, train.lng, 10.5);
  };

  const inspectNode = (node: WorkerNode) => {
    setShowNodes(true);
    setShelfOpen(true);
    fly(node.lat, node.lng, 12.5);
  };

  const changeRegion = (code: string) => {
    setRegion(code);
    setSelectedId(null);
    const target = REGIONS.find((r) => r.code === code);
    if (target) fly(target.lat, target.lng, target.zoom);
  };

  const tools: Array<{ id: PanelId; icon: typeof TrainTrack; label: string; badge?: number }> = [
    { id: 'fleet', icon: TrainTrack, label: 'Live fleet' },
    { id: 'sensors', icon: Server, label: 'Track sensors' },
    { id: 'alerts', icon: AlertOctagon, label: 'Security alerts', badge: alertCount },
  ];

  return (
    <main className="console">
      <header className="bar">
        <div className="crest">
          <span className="crest-mark" aria-hidden />
          <span className="crest-text">ARIS Command</span>
        </div>

        <select
          className="region-select"
          value={region}
          onChange={(e) => changeRegion(e.target.value)}
          aria-label="Region filter"
        >
          {REGIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>

        <span className="bar-spacer" />

        <div className="readouts">
          <div className="readout">
            <span className="readout-key">Active</span>
            <span className="readout-val">
              {String(visibleTrains.filter((t) => t.status === 'moving').length).padStart(2, '0')}
            </span>
          </div>
          <div className="readout">
            <span className="readout-key">Mesh</span>
            <span className="readout-val">{meshPct}%</span>
          </div>
          <div className="readout">
            <span className="readout-key">Alerts</span>
            <span
              className="readout-val"
              style={{
                ['--tone' as string]: alertCount ? ASPECT_HEX.critical : ASPECT_HEX.nominal,
              }}
            >
              {String(alertCount).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="clock">
          <span className="clock-utc" suppressHydrationWarning>
            {clock || '--:--:--'}
          </span>
          <span className="clock-zone">UTC</span>
        </div>

        <button
          type="button"
          className="bar-btn"
          aria-label={night ? 'Switch to day display' : 'Switch to night display'}
          onClick={() => setNight(!night)}
        >
          {night ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </header>

      <div className="stage">
        <MapCanvas
          trains={visibleTrains}
          nodes={visibleNodes}
          showNodes={showNodes}
          showRoutes={showRoutes}
          night={night}
          focus={focus}
          selectedId={selectedId}
          insetLeft={insetLeft}
          insetBottom={insetBottom}
          onSelect={selectTrain}
        />

        <nav className="rail" aria-label="Console tools">
          {tools.map(({ id, icon: Icon, label, badge }) => (
            <button
              key={id}
              type="button"
              className="tool"
              aria-pressed={openPanel === id}
              aria-label={label}
              title={label}
              onClick={() => setOpenPanel(openPanel === id ? null : id)}
            >
              <Icon size={17} />
              {badge ? <span className="tool-dot" aria-hidden /> : null}
            </button>
          ))}

          <span style={{ flex: 1 }} />

          <button
            type="button"
            className="tool"
            aria-label="Telemetry shelf"
            title="Telemetry shelf"
            aria-pressed={shelfOpen}
            onClick={() => setShelfOpen(!shelfOpen)}
          >
            <Radio size={17} />
          </button>
          <button
            type="button"
            className="tool"
            aria-label="Fit network"
            title="Fit network"
            onClick={() => changeRegion('National')}
            style={{ marginBottom: 8 }}
          >
            <Crosshair size={17} />
          </button>
        </nav>

        {openPanel === 'fleet' && (
          <Panel
            title="Live fleet"
            count={`${visibleTrains.length}`}
            onClose={() => setOpenPanel(null)}
          >
            <FleetList trains={visibleTrains} selectedId={selectedId} onSelect={selectTrain} />
          </Panel>
        )}

        {openPanel === 'sensors' && (
          <Panel title="Track sensors" onClose={() => setOpenPanel(null)}>
            <SensorControls
              showNodes={showNodes}
              showRoutes={showRoutes}
              shelfOpen={shelfOpen}
              nodes={visibleNodes}
              onToggleNodes={setShowNodes}
              onToggleRoutes={setShowRoutes}
              onToggleShelf={setShelfOpen}
            />
          </Panel>
        )}

        {openPanel === 'alerts' && (
          <Panel
            title="Security alerts"
            count={`${alertCount}`}
            onClose={() => setOpenPanel(null)}
          >
            <AlertList nodes={visibleNodes} onInspect={inspectNode} />
          </Panel>
        )}

        {shelfOpen && (
          <TelemetryShelf
            nodes={visibleNodes}
            region={region === 'National' ? 'National' : region}
            onClose={() => setShelfOpen(false)}
          />
        )}
      </div>
    </main>
  );
}
