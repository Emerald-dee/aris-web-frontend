'use client';

import { X } from 'lucide-react';
import {
  ASPECT_HEX,
  NODE_ASPECT,
  TRAIN_ASPECT,
  type Train,
  type WorkerNode,
} from '../lib/types';

/* ------------------------------------------------------------------ */

export function Panel({
  title,
  count,
  onClose,
  children,
}: {
  title: string;
  count?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <aside className="panel bracketed">
      <header className="panel-head">
        <span className="label">{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {count && <span className="label">{count}</span>}
          <button type="button" className="icon-btn" aria-label="Close panel" onClick={onClose}>
            <X size={14} />
          </button>
        </span>
      </header>
      <div className="panel-body">{children}</div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */

export function FleetList({
  trains,
  selectedId,
  onSelect,
}: {
  trains: Train[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (trains.length === 0) {
    return <p className="empty">No trains in this sector. Switch region to see active services.</p>;
  }

  return (
    <>
      {trains.map((train) => {
        const tone = ASPECT_HEX[TRAIN_ASPECT[train.status]];
        return (
          <button
            key={train.id}
            type="button"
            className="fleet-row"
            aria-current={train.id === selectedId}
            style={{ ['--tone' as string]: tone }}
            onClick={() => onSelect(train.id)}
          >
            <div className="fleet-top">
              <span className="pip" />
              <span className="fleet-id">{train.id}</span>
              <span className="fleet-state">
                {train.status === 'moving' ? 'En route' : 'Halted'}
              </span>
            </div>
            <div className="fleet-grid">
              <div>
                <div className="cell-key">Speed</div>
                <div className="cell-val">{Math.round(train.speed)}</div>
              </div>
              <div>
                <div className="cell-key">Heading</div>
                <div className="cell-val">
                  {String(Math.round((train.heading + 360) % 360)).padStart(3, '0')}
                </div>
              </div>
              <div>
                <div className="cell-key">ETA</div>
                <div className="cell-val">{train.eta}</div>
              </div>
            </div>
          </button>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */

export function SensorControls({
  showNodes,
  showRoutes,
  shelfOpen,
  nodes,
  onToggleNodes,
  onToggleRoutes,
  onToggleShelf,
}: {
  showNodes: boolean;
  showRoutes: boolean;
  shelfOpen: boolean;
  nodes: WorkerNode[];
  onToggleNodes: (v: boolean) => void;
  onToggleRoutes: (v: boolean) => void;
  onToggleShelf: (v: boolean) => void;
}) {
  const rows: Array<[string, boolean, (v: boolean) => void]> = [
    ['Trackside nodes', showNodes, onToggleNodes],
    ['Service routes', showRoutes, onToggleRoutes],
    ['Telemetry shelf', shelfOpen, onToggleShelf],
  ];

  const tally = {
    nominal: nodes.filter((n) => n.status === 'healthy').length,
    caution: nodes.filter((n) => n.status === 'low_battery').length,
    critical: nodes.filter((n) => n.status === 'alert').length,
  };

  return (
    <>
      {rows.map(([label, value, set]) => (
        <label key={label} className="switch-row">
          {label}
          <span className="switch">
            <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
            <span className="switch-knob" />
          </span>
        </label>
      ))}

      <div style={{ padding: '12px' }}>
        <div className="label" style={{ marginBottom: 8 }}>
          Mesh status
        </div>
        <div className="fleet-grid">
          {(['nominal', 'caution', 'critical'] as const).map((aspect) => (
            <div key={aspect}>
              <div className="cell-key">{aspect}</div>
              <div className="cell-val" style={{ color: ASPECT_HEX[aspect] }}>
                {tally[aspect]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

export function AlertList({
  nodes,
  onInspect,
}: {
  nodes: WorkerNode[];
  onInspect: (node: WorkerNode) => void;
}) {
  const active = nodes.filter((n) => n.status === 'alert' || n.status === 'low_battery');

  if (active.length === 0) {
    return <p className="empty">All sectors nominal. Alerts appear here as they open.</p>;
  }

  return (
    <>
      {active.map((node) => {
        const critical = node.status === 'alert';
        return (
          <button
            key={node.id}
            type="button"
            className="alert-row"
            style={
              critical
                ? undefined
                : {
                    background: 'var(--caution-wash)',
                    borderLeftColor: 'var(--caution)',
                  }
            }
            onClick={() => onInspect(node)}
          >
            <span
              className="alert-title"
              style={critical ? undefined : { color: 'var(--caution)' }}
            >
              {critical ? 'Intrusion detected' : 'Battery low'}
            </span>
            <p className="alert-sub" style={{ margin: 0 }}>
              {node.codename} &middot; {node.stateCode} &middot;{' '}
              {critical
                ? 'PIR motion on an unattended section.'
                : `Cell at ${node.battery} percent. Schedule a swap.`}
            </p>
          </button>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */

export function TelemetryShelf({
  nodes,
  region,
  onClose,
}: {
  nodes: WorkerNode[];
  region: string;
  onClose: () => void;
}) {
  return (
    <section className="shelf">
      <header className="shelf-head">
        <span className="label">LoRa mesh telemetry &middot; {region}</span>
        <button type="button" className="icon-btn" aria-label="Hide telemetry" onClick={onClose}>
          <X size={14} />
        </button>
      </header>
      <div className="shelf-body">
        {nodes.length === 0 ? (
          <p className="empty" style={{ margin: 'auto' }}>
            No sensors reporting in this region.
          </p>
        ) : (
          nodes.map((node) => {
            const aspect = NODE_ASPECT[node.status];
            /* Deterministic trace — Math.random() in render caused the bars to
               re-roll on every parent update and broke SSR hydration. */
            const bars = Array.from({ length: 16 }, (_, i) => {
              const base = Math.sin(i * 1.1 + node.lat) * 0.5 + 0.5;
              return aspect === 'critical'
                ? 20 + ((i * 37 + Math.round(node.rssi)) % 80)
                : 18 + base * 44;
            });

            return (
              <article
                key={node.id}
                className="node-card"
                style={{ ['--tone' as string]: ASPECT_HEX[aspect] }}
              >
                <div className="node-top">
                  <span className="node-name">{node.codename}</span>
                  <span className="node-state">
                    {aspect === 'critical' ? 'Intrusion' : aspect === 'caution' ? 'Low cell' : 'Online'}
                  </span>
                </div>

                <div>
                  <div className="cell-key" style={{ marginBottom: 4 }}>
                    Vibration baseline
                  </div>
                  <div className="trace" aria-hidden>
                    {bars.map((h, i) => (
                      <span key={i} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>

                <div className="node-foot">
                  <span style={node.battery < 20 ? { color: ASPECT_HEX.caution } : undefined}>
                    {node.battery}% cell
                  </span>
                  <span>{node.rssi} dBm</span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
