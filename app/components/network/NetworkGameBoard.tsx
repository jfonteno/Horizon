"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatPurchaseCost,
  getNeighbors,
  hiddenLegacyDeck,
  mapLibrary,
  orderLabel,
  projectedOrderBudget,
  totalOrderCost,
} from "../../../game";
import { explorationIcon, tileAssets as baseTileAssets, type ShipIconType } from "../../../game/themes/assets";
import type { HexKind, Resource, RoomCommand, RoomSession, SecretOrder } from "../../../game";
import BuildPanel from "../BuildPanel";
import EndgameResults from "../EndgameResults";
import ShipIcon from "../ShipIcon";
import TechnologyPanel from "../TechnologyPanel";
import NetworkDiplomacyPanel from "./NetworkDiplomacyPanel";
import NetworkMilitaryPanel from "./NetworkMilitaryPanel";
import RoomLobby from "./RoomLobby";
import RoomStatus from "./RoomStatus";

type Panel = "map" | "military" | "diplomacy" | "build" | "technology" | "legacy" | "orders" | "room";
type MapUnit = { kind: "explorer" | "colony" | "civilian"; id: string; hex: string; icon: ShipIconType };
const labels: Record<HexKind, string> = { material: "MAT", currency: "CUR", research: "RES", influence: "INF", labor: "LAB", barren: "BAR", anomaly: "ANO", hazard: "HAZ", empty: "", home: "HOME", rift: "" };

function uid(kind: string) {
  return `net-${kind}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
}

export default function NetworkGameBoard({ session, connection, busy, message, error, onCommand, onRefresh, onLeave, spectatorPaused = false, pollMs = 1200, onToggleSpectator, onPollMs }: {
  session: RoomSession;
  connection: "connected" | "syncing" | "offline";
  busy: boolean;
  message: string;
  error: string;
  onCommand: (command: RoomCommand) => Promise<void>;
  onRefresh: () => void;
  onLeave: () => void;
  spectatorPaused?: boolean;
  pollMs?: number;
  onToggleSpectator?: () => void;
  onPollMs?: (milliseconds: number) => void;
}) {
  const game = session.game;
  const spectator = session.role === "spectator" || session.playerId === undefined;
  const playerId = session.playerId;
  const player = playerId === undefined ? undefined : game.players[playerId];
  const [panel, setPanel] = useState<Panel>("map");
  const [draft, setDraft] = useState<SecretOrder[]>([]);
  const [selectedHexId, setSelectedHexId] = useState(player?.colonyShip || game.selected);
  const [mapUnit, setMapUnit] = useState<MapUnit | null>(null);
  const [unitTargeting, setUnitTargeting] = useState(false);
  const [taskForceIds, setTaskForceIds] = useState<string[]>([]);
  const [militaryTargeting, setMilitaryTargeting] = useState(false);
  const [buildTargeting, setBuildTargeting] = useState(false);
  const [buildHexId, setBuildHexId] = useState<string | null>(null);
  const canPlan = !!player && !game.result && game.orderProtocol.phase === "orders" && !game.orderProtocol.submissions.some((submission) => submission.playerId === player.id);
  const map = mapLibrary[game.mapId];
  const tileAssets = { ...baseTileAssets, ...map.tileAssets };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- authoritative Turn changes invalidate local private drafts */
    setDraft([]); setMapUnit(null); setTaskForceIds([]); setMilitaryTargeting(false); setBuildTargeting(false); setBuildHexId(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [game.turn, playerId]);

  const viewGame = useMemo(() => {
    const view = structuredClone(game);
    if (playerId !== undefined) view.active = playerId;
    view.selected = selectedHexId;
    return view;
  }, [game, playerId, selectedHexId]);

  const militaryOrigin = game.carriers.find((carrier) => taskForceIds.includes(carrier.id))?.hex;
  const militaryTargets = militaryTargeting && militaryOrigin
    ? getNeighbors(militaryOrigin, map).filter((id) => {
      const hex = game.hexes.find((candidate) => candidate.id === id);
      return !!hex && hex.revealed && hex.kind !== "rift";
    }) : [];
  const unitTargets = unitTargeting && mapUnit ? getNeighbors(mapUnit.hex, map).filter((id) => {
    const hex = game.hexes.find((candidate) => candidate.id === id);
    return !!hex && hex.kind !== "rift" && (mapUnit.kind === "explorer" || hex.revealed);
  }) : [];
  const buildTargets = buildTargeting && player ? game.hexes.filter((hex) => hex.owner === player.id && hex.tier && hex.constructionUsedTurn !== game.turn).map((hex) => hex.id) : [];
  const activeTargets = militaryTargets.length ? militaryTargets : unitTargets.length ? unitTargets : buildTargets;

  function clickHex(id: string) {
    setSelectedHexId(id);
    if (militaryTargeting && militaryTargets.includes(id)) {
      const selected = [...taskForceIds];
      setDraft((current) => [...current.filter((order) => order.kind !== "carrierMove" || !order.carrierIds.some((carrierId) => selected.includes(carrierId))), { id: uid("fleet"), kind: "carrierMove", carrierIds: selected, destination: id }]);
      setMilitaryTargeting(false); setPanel("orders"); return;
    }
    if (unitTargeting && mapUnit && unitTargets.includes(id)) {
      const order: SecretOrder = mapUnit.kind === "explorer" ? { id: uid("explorer"), kind: "explorerMove", destination: id } : mapUnit.kind === "colony" ? { id: uid("colony"), kind: "colonyMove", destination: id } : { id: uid("civilian"), kind: "civilianMove", unitId: mapUnit.id, destination: id };
      setDraft((current) => [...current.filter((candidate) => mapUnit.kind === "explorer" ? candidate.kind !== "explorerMove" : mapUnit.kind === "colony" ? candidate.kind !== "colonyMove" : !(candidate.kind === "civilianMove" && candidate.unitId === mapUnit.id)), order]);
      setUnitTargeting(false); setPanel("orders"); return;
    }
    if (buildTargeting && buildTargets.includes(id)) { setBuildHexId(id); setBuildTargeting(false); setPanel("build"); }
  }

  function selectMapUnit(unit: MapUnit) { if (!canPlan) return; setMapUnit(unit); setSelectedHexId(unit.hex); setPanel("map"); setUnitTargeting(false); }
  const budget = player ? projectedOrderBudget(viewGame, player.id, draft) : undefined;
  const hidden = player?.hiddenLegacy[game.era];
  const pendingProposals = playerId === undefined ? 0 : game.proposals.filter((proposal) => proposal.status === "pending" && (proposal.kind === "technology" ? proposal.buyer === playerId : proposal.to === playerId)).length;
  const hiddenRequired = !!player && (game.turn - 1) % 4 === 0 && !hidden?.selected;
  const selectedHex = game.hexes.find((hex) => hex.id === selectedHexId) || game.hexes[0];
  const pendingCapture = game.pendingCenterLoss;
  const captureHexId = pendingCapture?.hexId;
  const captureCount = pendingCapture?.removeCount || 0;
  const captureOwner = pendingCapture?.playerId;
  const capturedCenters = captureHexId ? game.hexes.find((hex) => hex.id === captureHexId)?.centers || [] : [];

  return <main className="game-shell network-alpha" data-theme={game.themeId} data-spectator={spectator} style={{ "--player": player?.color || "#50dcff" } as React.CSSProperties}>
    <header className="topbar network-topbar"><img src="/horizon-logo.png" alt="Horizon" /><div className="turn-id"><span>NETWORK OPERATIONS · {session.code}</span><strong>ERA {game.era} · TURN {game.turn} / 16</strong></div><div className="gate-mini"><div><span>HORIZON GATE</span><strong>{game.gate} / {game.players.length * 3}</strong></div><div className="gate-track"><i style={{ width: `${Math.min(100, game.gate / (game.players.length * 3) * 100)}%` }} /></div></div><div className={`network-connection ${connection}`}><i /><span>{connection}</span><b>REV {session.revision}</b></div><button className="ghost" onClick={onLeave}>Exit room</button></header>
    {(message || error) && <div className={`notice ${error ? "room-error" : ""}`}>{error || message}</div>}
    <div className="play-area network-play-area">
      <aside className="left-rail"><div className="identity"><span>{spectator ? "PUBLIC SPECTATOR" : session.role === "host" ? "ROOM HOST" : "PRIVATE NETWORK SEAT"}</span><h2>{player?.name || "The Shattered Reach"}</h2><p>{player?.faction || "Live public board"}</p></div>{player && <div className="resources">{(["material", "currency", "research", "influence"] as Resource[]).map((resource) => <div key={resource}><i className={resource}>{resource[0].toUpperCase()}</i><small>{resource}</small><strong>{player.resources[resource]}</strong></div>)}<div><i className="labor">L</i><small>Labor</small><strong>{player.labor}/{player.laborCap}</strong></div></div>}
        <nav>{(["map", "military", "diplomacy", "build", "technology", "legacy", "orders", "room"] as Panel[]).map((id) => { const badge = id === "diplomacy" ? pendingProposals : id === "legacy" && hiddenRequired ? 1 : 0; return <button key={id} className={panel === id ? "active" : ""} disabled={spectator && !["map", "room"].includes(id)} onClick={() => { setPanel(id); if (id === "build") { setBuildTargeting(true); setBuildHexId(null); } }}>{id === "technology" ? "Tech" : id}{badge ? <sup>{badge}</sup> : null}</button>; })}</nav>
        <section className="action-panel network-action-panel">
          {panel === "map" && <div className="network-map-command"><h3>{spectator ? "Spectator view" : "Map Command"}</h3><p>{spectator ? "Private objectives, proposals, surveys, and sealed Orders are concealed." : "Select a vessel icon, choose Move, then select a highlighted destination."}</p>{mapUnit && <div className="selected-unit-card"><ShipIcon type={mapUnit.icon} color={player?.color} /><span><b>{mapUnit.kind}</b><small>{mapUnit.hex}</small></span><button className="primary" disabled={!canPlan} onClick={() => setUnitTargeting(true)}>Move</button>{mapUnit.kind === "colony" && player && game.hexes.find((hex) => hex.id === mapUnit.hex)?.owner === undefined && <button onClick={() => setDraft((current) => [...current.filter((order) => order.kind !== "establish"), { id: uid("establish"), kind: "establish", hexId: mapUnit.hex }])}>Establish Habitat</button>}</div>}</div>}
          {panel === "military" && player && <NetworkMilitaryPanel game={viewGame} playerId={player.id} draft={draft} setDraft={setDraft} selectedIds={taskForceIds} setSelectedIds={setTaskForceIds} targeting={militaryTargeting} beginTargeting={() => setMilitaryTargeting(true)} busy={busy} onCommand={onCommand} />}
          {panel === "diplomacy" && player && <NetworkDiplomacyPanel game={viewGame} playerId={player.id} busy={busy} onCommand={onCommand} />}
          {panel === "build" && player && <BuildPanel game={viewGame} habitatId={buildHexId} draft={draft} setDraft={setDraft} flash={() => undefined} selectHabitat={() => { setBuildTargeting(true); setBuildHexId(null); }} />}
          {panel === "technology" && player && <TechnologyPanel game={viewGame} draft={draft} setDraft={setDraft} flash={() => undefined} />}
          {panel === "legacy" && player && <div className="network-legacy"><h3>Hidden Legacy</h3>{hidden?.selected ? <><b>{hiddenLegacyDeck.find((card) => card.id === hidden.selected)?.name}</b><p>{hiddenLegacyDeck.find((card) => card.id === hidden.selected)?.condition}</p></> : hidden?.choices.length ? hidden.choices.map((id) => { const card = hiddenLegacyDeck.find((candidate) => candidate.id === id)!; return <button className="legacy-choice" key={id} onClick={() => void onCommand({ kind: "selectHidden", cardId: id })}><b>{card.name}</b><small>{card.condition} · {card.lp} LP</small></button>; }) : <button className="primary wide" onClick={() => void onCommand({ kind: "drawHidden" })}>Draw Hidden objectives</button>}</div>}
          {panel === "orders" && player && <div className="network-orders"><h3>Private Order Queue</h3><p>{canPlan ? "Review the complete private plan before sealing it." : "Your Orders are sealed for this Turn."}</p><div className="network-order-list">{draft.map((order) => <div key={order.id}><span>{orderLabel(order)}</span><button onClick={() => setDraft((current) => current.filter((candidate) => candidate.id !== order.id))}>Remove</button></div>)}{!draft.length && <small>No drafted Orders. An empty submission issues Hold.</small>}</div><div className="network-budget"><span>Projected cost</span><b>{formatPurchaseCost(player ? totalOrderCost(viewGame, player.id, draft) : {})}</b><span>Budget status</span><b>{budget?.error || "Valid"}</b></div><button className="primary wide" disabled={!canPlan || busy || !!budget?.error || ((game.turn - 1) % 4 === 0 && !hidden?.selected)} onClick={() => void onCommand({ kind: "submitOrders", orders: draft })}>{canPlan ? "Seal Orders and end Turn" : "Orders sealed"}</button></div>}
          {panel === "room" && <><RoomStatus session={session} connection={connection} /><RoomLobby session={session} busy={busy} onCommand={onCommand} onRefresh={onRefresh} onLeave={onLeave} /></>}
        </section>{player && <button className="end-turn" onClick={() => setPanel("orders")}>{canPlan ? "Review and seal Orders" : "Orders sealed"}</button>}</aside>

      <section className="map-wrap"><div className="map-header"><div><p>{map.name.toUpperCase()} · SEED {game.seed}</p><h1>{selectedHex.revealed ? `${selectedHex.kind} sector` : "Uncharted"}</h1></div><div className="network-map-help">{activeTargets.length ? `${activeTargets.length} legal targets` : "Select a vessel"}</div></div>{activeTargets.length > 0 && <div className="network-target-prompt">Select a highlighted target hex</div>}<div className={`map-viewport ${activeTargets.length ? "targeting" : ""}`}><div className="map-scale" style={{ width: 1420, height: 1260 }}><div className="map-stage"><div className="hex-map">{game.hexes.map((hex) => <button key={hex.id} data-hex-id={hex.id} onClick={() => clickHex(hex.id)} className={`hex ${hex.kind} ${!hex.revealed ? "concealed" : ""} ${selectedHexId === hex.id ? "selected" : ""} ${activeTargets.includes(hex.id) ? "legal-target" : ""}`} style={{ gridColumn: hex.col + 1, gridRow: hex.row + 1, "--owner": hex.owner === undefined ? "transparent" : game.players[hex.owner]?.color } as React.CSSProperties}><span className="hex-inner"><img className="tile-art" src={hex.revealed ? tileAssets[hex.kind] : tileAssets.unrevealed} alt="" />{hex.revealed && hex.kind !== "rift" && <><small>{hex.id}</small><b>{labels[hex.kind]}</b>{hex.tier && <em>{hex.tier[0]}</em>}{hex.centers.length > 0 && <u>{hex.centers.length}C</u>}</>}</span></button>)}</div><div className="unit-layer">{game.hexes.map((hex) => <div className="unit-cell" key={hex.id} style={{ gridColumn: hex.col + 1, gridRow: hex.row + 1 }}>{game.players.filter((owner) => owner.explorer === hex.id).map((owner) => <button key={`e-${owner.id}`} className="map-unit" onClick={() => owner.id === playerId && selectMapUnit({ kind: "explorer", id: "explorer", hex: hex.id, icon: explorationIcon(owner.tech.Exploration) })}><ShipIcon type={explorationIcon(owner.tech.Exploration)} color={owner.color} /></button>)}{game.players.filter((owner) => owner.colonyShip === hex.id).map((owner) => <button key={`c-${owner.id}`} className="map-unit" onClick={() => owner.id === playerId && selectMapUnit({ kind: "colony", id: "colony", hex: hex.id, icon: "colonyShip" })}><ShipIcon type="colonyShip" color={owner.color} /></button>)}{game.civilianUnits.filter((unit) => unit.hex === hex.id).map((unit) => <button key={unit.id} className="map-unit" onClick={() => unit.owner === playerId && selectMapUnit({ kind: "civilian", id: unit.id, hex: hex.id, icon: unit.type })}><ShipIcon type={unit.type} color={game.players[unit.owner].color} /></button>)}{game.carriers.filter((carrier) => carrier.hex === hex.id).map((carrier) => <button key={carrier.id} className="map-unit carrier" onClick={() => { if (carrier.owner === playerId) { setTaskForceIds([carrier.id]); setPanel("military"); } }}><ShipIcon type={carrier.type} color={game.players[carrier.owner].color} /><small>{carrier.cu}</small></button>)}</div>)}</div></div></div></div><div className="selected-card"><div><span>SELECTED HEX {selectedHex.id}</span><strong>{selectedHex.revealed ? selectedHex.kind : "Uncharted"}</strong></div><div>{selectedHex.owner !== undefined && <><span>CONTROL</span><strong style={{ color: game.players[selectedHex.owner].color }}>{game.players[selectedHex.owner].name}</strong></>}</div><div>{selectedHex.tier && <><span>HABITAT</span><strong>{selectedHex.tier} · {selectedHex.combat} stationed CU</strong></>}</div></div></section>
      <aside className="right-rail">{spectator && <section className="spectator-controls"><div className="section-title"><span>Spectator controls</span></div><button onClick={onToggleSpectator}>{spectatorPaused ? "Resume live updates" : "Pause live updates"}</button><div>{[[700, "Fast"], [1200, "Live"], [3000, "Slow"]].map(([milliseconds, label]) => <button key={milliseconds} className={pollMs === milliseconds ? "active" : ""} onClick={() => onPollMs?.(milliseconds as number)}>{label}</button>)}</div><small>{spectatorPaused ? "Public board frozen locally" : `Syncing every ${(pollMs / 1000).toFixed(1)} seconds`}</small></section>}<section><div className="section-title"><span>Standings</span><span>LP</span></div>{[...game.players].sort((a, b) => b.lp - a.lp).map((civilization, index) => <div className="standing" key={civilization.id}><i style={{ background: civilization.color }} /><b>{index + 1}</b><span>{civilization.name}<small>{civilization.controller.kind === "bot" ? "AI" : session.summary.seats[civilization.id]?.displayName || "Human"}</small></span><strong>{civilization.lp}</strong></div>)}</section><section><div className="section-title"><span>Turn status</span></div><RoomStatus session={session} connection={connection} /></section><section className="log"><div className="section-title"><span>Resolution log</span></div>{game.orderProtocol.lastResolution.slice(0, 8).map((entry, index) => <p key={`${index}-${entry}`}>{entry}</p>)}</section></aside>
    </div>
    {captureOwner === playerId && captureHexId && <div className="handoff-overlay capture-overlay"><div className="handoff-card"><p>CAPTURE RESOLUTION // {captureHexId}</p><h1>Choose {captureCount} Center to destroy</h1><div className="captured-centers">{capturedCenters.map((center, index) => <button key={`${center}-${index}`} disabled={busy} onClick={() => void onCommand({ kind: "removeCapturedCenter", centerIndex: index })}><b>{center === "defense" ? "Defense Grid" : `${center} Center`}</b><small>Destroy this Center</small></button>)}</div></div></div>}
    {["lobby", "paused"].includes(session.summary.status) && <div className="handoff-overlay beta-room-overlay"><div className="beta-room-card"><RoomLobby session={session} busy={busy} onCommand={onCommand} onRefresh={onRefresh} onLeave={onLeave} /></div></div>}
    {game.result && <EndgameResults game={game} newGame={onLeave} />}
  </main>;
}
