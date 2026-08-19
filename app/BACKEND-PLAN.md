# ARIS rail telemetry — backend plan

Scope: get trackside worker-node and locomotive telemetry from the field into the
console reliably, in an order where each phase is useful on its own.

Two things shape every decision here. Field nodes are battery-powered and on LoRa,
so uplink bandwidth and power budget are the binding constraints — not server
throughput. And an intrusion alert is a dispatch trigger, so an alert you can't
authenticate is worse than no alert: it sends people to a location on the strength
of an unverified packet.

---

## Architecture

```
worker nodes ──LoRa──► gateway ──MQTT/TLS──► ingest ──► state store (current)
(battery, PIR,          (mains,              service    time-series (history)
 vibration, RSSI)        backhaul)              │
                                                ▼
locomotives ─────cellular/satellite───────►  API service
                                            REST + WebSocket
                                                │
                                                ▼
                                          Next.js console
```

Five services, deliberately: ingest and API scale on different axes and fail for
different reasons. A node uplink storm shouldn't take down the operator console.

**Ingest** terminates MQTT, validates and authenticates payloads, writes both
stores, and evaluates alert rules. **API** is read-only over HTTP and WebSocket.
They share the database, not a process.

---

## Data stores

**Current state** — one row per node and per train. Small, hot, read on every
console load. Postgres is enough; nothing here justifies Redis until you measure
a reason.

**History** — every reading, append-only, for the vibration traces and incident
review. This is time-series and will dominate volume: 200 nodes at one reading a
minute is ~105M rows a year. Use TimescaleDB (a Postgres extension, so one engine
and one backup story) or partition by month in plain Postgres.

**Don't** serve the console's current view from the history table with a
`GROUP BY … MAX(timestamp)`. It's the single most common mistake in this shape of
system and it degrades quietly as history grows.

---

## Payload contract

Freeze this before writing the firmware, because changing it later means physically
reaching every node. LoRa payloads are byte-budgeted, so send binary on the air and
expand to JSON at the gateway.

| Field | Bytes | Notes |
|---|---|---|
| node_id | 4 | |
| seq | 4 | monotonic, per node — replay and gap detection |
| timestamp | 4 | epoch seconds |
| battery_mv | 2 | millivolts, not percent — derive percent server-side from the cell curve |
| rssi / snr | 2 | |
| flags | 1 | PIR, tamper, low-power, self-test |
| vibration | 8 | binned magnitudes, not a raw waveform |
| mac | 8 | truncated HMAC over the above |

Two points worth arguing about now rather than after deployment:

**`seq` is not optional.** Without a monotonic counter you cannot distinguish a
replayed packet from a real one, and a replayed intrusion alert dispatches a
security team to a stale location. The ingest service rejects any packet whose
`seq` is at or below the last one recorded for that node. This is the same
anti-replay reasoning as `chain_index` in the URF work — a counter that must never
go backwards, failing closed on doubt.

**Send raw units, derive display units.** `battery_mv`, not `battery_pct`. Percent
depends on a discharge curve you will want to revise, and revising it server-side
is a deploy while revising it node-side is a field visit.

---

## Phases

### Phase 0 — Contract and schema
Payload spec above, plus the JSON shapes the API returns. Generate the frontend's
TypeScript types from the same source (OpenAPI, or a shared JSON Schema) so the
contract can't drift silently. `app/lib/types.ts` becomes generated, not
hand-written.

*Done when:* firmware and backend teams are building against one frozen document.

### Phase 1 — Ingest path
MQTT broker (Mosquitto or EMQX) with per-gateway TLS credentials. Ingest service
subscribes, verifies the HMAC, checks `seq`, writes current state and history.
Reject-and-log on any failure; never partially apply a bad packet.

*Done when:* a simulated gateway publishing recorded traffic lands correctly in
both tables, and replayed packets are rejected and counted.

### Phase 2 — Read API
- `GET /api/nodes` — current state, all nodes
- `GET /api/nodes/:id/history?from=&to=` — for the vibration trace
- `GET /api/trains` — current positions
- `GET /api/alerts?status=open`

Straight replacements for `INITIAL_NODES` and `useFleet()`'s simulated interval.

*Done when:* the console renders live data with the simulator deleted.

### Phase 3 — Push
WebSocket at `/ws`, publishing node updates, train positions, and alert
open/close. Client sends the region filter on connect so a Lagos operator isn't
receiving Kaduna traffic.

Have the API emit the **full current state on connect**, then deltas. It costs one
extra message and removes an entire class of "client missed an update and is now
silently stale" bugs.

*Done when:* two browsers show the same state within a second of a change, and a
dropped connection recovers correctly on reconnect.

### Phase 4 — Alerting and dispatch
Rules over the ingest stream: PIR triggered, battery below threshold, node silent
for N intervals. Alerts are rows with a lifecycle (open → acknowledged → resolved),
each transition carrying an operator identity and timestamp.

**Node silence is a first-class alert.** A node that stops transmitting looks
identical to a healthy node in a naive design, and a cut LoRa antenna is exactly
what someone tampering with the line would cause. Absence of signal must page
someone.

*Done when:* dispatch actions in the console write an audit trail you could hand
to an investigator.

### Phase 5 — Operations
Backpressure on the ingest queue, retention policy on history (raw for 90 days,
downsampled beyond), gateway health monitoring, and restore-from-backup rehearsed
at least once. A backup you have never restored is a hypothesis.

---

## Stack

Node with Fastify keeps one language across the codebase and shares types with the
frontend for free. Go or Python are both defensible if that's where your team's
depth is; the architecture doesn't change. Postgres plus TimescaleDB, Mosquitto or
EMQX for MQTT, one VM or container host to start — this workload does not need
Kubernetes and won't for a long time.

---

## Frontend integration

Two seams, both already isolated:

`useFleet()` in `app/lib/fleet.ts` — replace the `setInterval` body with a
WebSocket subscription emitting the same `Train[]`. If the backend sends real
lat/lng, drop the `pointOnRoute` interpolation entirely; it exists only to make
the simulator move plausibly.

`INITIAL_NODES` in the same file — becomes a `useNodes()` hook. `page.tsx`
currently holds it in `useState`; that changes to the hook and nothing else moves.

Both should expose a connection state so the console can show a stale-data banner.
An ops display that silently shows five-minute-old positions as current is
dangerous in a way that a visibly disconnected one is not.
