"use client";

import {
  carrierLibrary,
  getNeighbors,
  mapLibrary,
  taskForceSummary,
  totalCombatUnits,
} from "../../../game";
import type { GameState, RoomCommand, SecretOrder } from "../../../game";
import ShipIcon from "../ShipIcon";

export default function NetworkMilitaryPanel({
  game,
  playerId,
  draft,
  setDraft,
  selectedIds,
  setSelectedIds,
  targeting,
  beginTargeting,
  busy,
  onCommand,
}: {
  game: GameState;
  playerId: number;
  draft: SecretOrder[];
  setDraft: React.Dispatch<React.SetStateAction<SecretOrder[]>>;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  targeting: boolean;
  beginTargeting: () => void;
  busy: boolean;
  onCommand: (command: RoomCommand) => Promise<void>;
}) {
  const player = game.players[playerId];
  const carriers = game.carriers.filter((carrier) => carrier.owner === playerId);
  const selected = carriers.filter((carrier) => selectedIds.includes(carrier.id));
  const origin = selected[0]?.hex;
  const summary = taskForceSummary(game, selectedIds);
  const strengthTwoLocks = new Set(draft.filter((order) => order.kind === "bombard" && order.strength === 2).map((order) => order.kind === "bombard" ? order.carrierId : ""));
  const redistribution = game.pendingCombatRedistributions.find((pending) => pending.playerId === playerId);

  function resolveRedistribution() {
    if (!redistribution) return;
    let remaining = redistribution.total;
    const assignments: { carrierId: string; cu: number }[] = [];
    for (const carrierId of redistribution.carrierIds) {
      const carrier = game.carriers.find((candidate) => candidate.id === carrierId)!;
      const raw = window.prompt(`${carrierLibrary[carrier.type].name}: assign 1 to ${carrierLibrary[carrier.type].capacity} CU. ${remaining} CU remain.`, String(carrier.cu));
      if (raw === null) return;
      const cu = Number(raw);
      if (!Number.isInteger(cu) || cu < 1 || cu > carrierLibrary[carrier.type].capacity) return;
      assignments.push({ carrierId, cu }); remaining -= cu;
    }
    const stationed = redistribution.allowStationed ? remaining : 0;
    if (remaining < 0 || (!redistribution.allowStationed && remaining !== 0)) return;
    void onCommand({ kind: "redistributeCombatUnits", hexId: redistribution.hexId, assignments, stationed });
  }

  function toggle(id: string) {
    const carrier = carriers.find((candidate) => candidate.id === id);
    if (!carrier) return;
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((candidate) => candidate !== id);
      const currentOrigin = carriers.find((candidate) => current.includes(candidate.id))?.hex;
      return currentOrigin && currentOrigin !== carrier.hex ? [id] : [...current, id];
    });
  }

  const forecastTargets = origin
    ? getNeighbors(origin, mapLibrary[game.mapId])
    : [];
  const militaryDraft = draft.filter((order): order is Extract<SecretOrder, { kind: "carrierMove" | "construct" }> =>
    order.kind === "carrierMove" || (order.kind === "construct" && (order.construction.type === "carrier" || order.construction.type === "recruit")),
  );

  return <div className="network-military">
    <header className="network-panel-header"><span>FLEET COMMAND</span><h3>Task Forces and Combat</h3><p>Select any ready carriers in one hex, then choose Move and select a highlighted adjacent hex on the map. All movement remains sealed until Turn resolution.</p></header>
    <div className="military-total"><span>Total military strength</span><b>{totalCombatUnits(game, playerId)} CU</b></div>
    {redistribution && <section className="network-action-card"><h4>Post-combat redistribution at {redistribution.hexId}</h4><p>Allocate exactly {redistribution.total} surviving CU. Every military vessel must retain at least 1 CU and cannot exceed Capacity.</p><button className="primary wide" disabled={busy} onClick={resolveRedistribution}>Assign surviving CU</button></section>}
    <div className="network-fleet-list">{carriers.map((carrier) => {
      const definition = carrierLibrary[carrier.type];
      const checked = selectedIds.includes(carrier.id);
      const ready = carrier.readyTurn <= game.turn && carrier.movesRemaining > 0 && carrier.cu > 0;
      return <article key={carrier.id} className={checked ? "selected" : ""}><label><input type="checkbox" checked={checked} disabled={!ready && !checked} onChange={() => toggle(carrier.id)} /><ShipIcon type={carrier.type} color={player.color} title={definition.name} /><span><b>{definition.name}</b><small>{carrier.hex} · {carrier.cu}/{definition.capacity} CU · {carrier.movesRemaining} move</small></span></label><div><button disabled={busy} onClick={() => void onCommand({ kind: "transferCombatUnit", carrierId: carrier.id, direction: "load" })}>Load CU</button><button disabled={busy} onClick={() => void onCommand({ kind: "transferCombatUnit", carrierId: carrier.id, direction: "unload" })}>Station CU</button></div></article>;
    })}{!carriers.length && <p>No military vessels constructed.</p>}</div>
    <div className="task-force-card"><span>SELECTED TASK FORCE</span><strong>{summary.carriers} vessels · {summary.cu} CU · {summary.movement} movement</strong><button className="primary wide" title={selected.some((carrier) => strengthTwoLocks.has(carrier.id)) ? "Bombardment 2 requires this vessel to remain stationary." : undefined} disabled={!selected.length || selected.some((carrier) => carrier.hex !== origin || carrier.movesRemaining < 1 || carrier.cu < 1 || strengthTwoLocks.has(carrier.id))} onClick={beginTargeting}>{targeting ? "Select highlighted destination" : "Move task force"}</button>{selected.some((carrier) => strengthTwoLocks.has(carrier.id)) && <small>Remove Bombardment 2 before moving this vessel.</small>}</div>
    {origin && <section className="combat-forecast"><h4>Adjacent public strength</h4>{forecastTargets.map((id) => {
      const hex = game.hexes.find((candidate) => candidate.id === id);
      if (!hex || hex.kind === "rift" || !hex.revealed) return null;
      const fleetCU = game.carriers.filter((carrier) => carrier.hex === id && carrier.owner !== playerId).reduce((sum, carrier) => sum + carrier.cu, 0);
      const habitatCU = hex.owner !== undefined && hex.owner !== playerId ? hex.combat + (hex.centers.includes("defense") ? 3 : 1) : 0;
      const opposition = fleetCU + habitatCU;
      return <div key={id}><span><b>{id}</b><small>{hex.owner === undefined ? "Unclaimed" : game.players[hex.owner].name}</small></span><strong className={opposition >= summary.cu && opposition > 0 ? "status-bad" : "status-good"}>{opposition} public CS</strong></div>;
    })}</section>}
    <section className="network-order-preview"><h4>Military Orders in draft</h4>{militaryDraft.map((order) => <div key={order.id}><span>{order.kind === "carrierMove" ? `${order.carrierIds.length} vessels to ${order.destination}` : order.construction.type === "carrier" ? `Construct ${carrierLibrary[order.construction.carrier].name}` : order.construction.type === "recruit" ? `Recruit ${order.construction.pairs * 2} CU` : "Military construction"}</span><button onClick={() => setDraft((current) => current.filter((candidate) => candidate.id !== order.id))}>Remove</button></div>)}</section>
  </div>;
}
