"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  activeAgreements,
  agreementNames,
  availableCarrierTypes,
  availableCivilianType,
  availableExplorationTypes,
  carrierLibrary,
  civilianLibrary,
  explorationLibrary,
  constructionQuote,
  formatPurchaseCost,
  getNeighbors,
  reachableHexes,
  shortestPath,
  isContacted,
  mapLibrary,
  orderLabel,
  projectedOrderBudget,
  totalOrderCost,
  gateTarget,
  totalTurns,
} from "../../../game";
import { explorationIcon, tileAssets as baseTileAssets, type ShipIconType } from "../../../game/themes/assets";
import type { CenterType, HexKind, Resource, RoomCommand, RoomSession, SecretOrder } from "../../../game";
import BuildPanel from "../BuildPanel";
import EndgameResults from "../EndgameResults";
import ShipIcon from "../ShipIcon";
import TechnologyPanel from "../TechnologyPanel";
import NetworkDiplomacyPanel from "./NetworkDiplomacyPanel";
import NetworkEconomyPanel from "./NetworkEconomyPanel";
import NetworkGatePanel from "./NetworkGatePanel";
import NetworkLegacyPanel from "./NetworkLegacyPanel";
import NetworkMilitaryPanel from "./NetworkMilitaryPanel";
import RoomLobby from "./RoomLobby";
import RoomStatus from "./RoomStatus";

type Panel = "map" | "military" | "diplomacy" | "build" | "technology" | "economy" | "gate" | "legacy" | "orders" | "room";
type UnitIntent = "move" | "publicScan" | "longRangeSurvey" | "farboundScan" | null;
type MapUnit = { kind: "explorer" | "colony" | "civilian"; id: string; hex: string; icon: ShipIconType };
type Construction = Extract<SecretOrder, { kind: "construct" }>["construction"];
type SelectedHexUnit = { key: string; owner: number; label: string; icon: ShipIconType; unit?: MapUnit; carrierId?: string };
type ActivityItem = { id: string; type: string; text: string; playerId?: number; hexId?: string };
const labels: Record<HexKind, string> = { material: "MAT", currency: "CUR", research: "RES", influence: "INF", labor: "LAB", barren: "BAR", anomaly: "ANO", hazard: "HAZ", empty: "", home: "HOME", rift: "" };
const panelLabels: Record<Panel, { icon: string; label: string }> = {
  map: { icon: "MAP", label: "Map" }, military: { icon: "MIL", label: "Military" }, build: { icon: "BLD", label: "Build" },
  technology: { icon: "TEC", label: "Technology" }, economy: { icon: "ECO", label: "Economy" }, gate: { icon: "GAT", label: "Gate" },
  diplomacy: { icon: "DIP", label: "Diplomacy" }, legacy: { icon: "LEG", label: "Legacy" }, orders: { icon: "ORD", label: "Orders" }, room: { icon: "NET", label: "Room" },
};
const fullScreenPanels: Panel[] = ["diplomacy", "legacy", "economy", "technology"];

function uid(kind: string) {
  return `net-${kind}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
}

export default function NetworkGameBoard({ session, connection, busy, message, error, onCommand, onRefresh, onLeave, onExportReport, spectatorPaused = false, pollMs = 1200, onToggleSpectator, onPollMs }: {
  session: RoomSession;
  connection: "connected" | "syncing" | "offline";
  busy: boolean;
  message: string;
  error: string;
  onCommand: (command: RoomCommand) => Promise<void>;
  onRefresh: () => void;
  onLeave: () => void;
  onExportReport?: () => void;
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
  const [dockOpen, setDockOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [diplomacyTargetId, setDiplomacyTargetId] = useState<number | undefined>();
  const [draft, setDraft] = useState<SecretOrder[]>([]);
  const [draftScopeLoaded, setDraftScopeLoaded] = useState("");
  const [draftNotice, setDraftNotice] = useState("");
  const [selectedHexId, setSelectedHexId] = useState(player?.colonyShip || game.selected);
  const [mapUnit, setMapUnit] = useState<MapUnit | null>(null);
  const [unitIntent, setUnitIntent] = useState<UnitIntent>(null);
  const [taskForceIds, setTaskForceIds] = useState<string[]>([]);
  const [militaryTargeting, setMilitaryTargeting] = useState(false);
  const [buildTargeting, setBuildTargeting] = useState(false);
  const [buildHexId, setBuildHexId] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(.72);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const canPlan = !!player && !game.result && game.orderProtocol.phase === "orders" && !game.orderProtocol.submissions.some((submission) => submission.playerId === player.id);
  const map = mapLibrary[game.mapId];
  const tileAssets = { ...baseTileAssets, ...map.tileAssets };
  const draftScope = playerId === undefined ? "" : `horizon:network-draft:${session.code}:${playerId}:${game.turn}`;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- a new private Turn scope must restore its own draft */
    let restored: SecretOrder[] = [];
    if (draftScope) try { restored = JSON.parse(localStorage.getItem(draftScope) || "[]") as SecretOrder[]; } catch { restored = []; }
    setDraft(restored); setDraftScopeLoaded(draftScope); setMapUnit(null); setTaskForceIds([]); setMilitaryTargeting(false); setUnitIntent(null); setBuildTargeting(false); setBuildHexId(null); setDraftNotice(restored.length ? "Your unsealed private Orders were restored." : "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [draftScope]);

  useEffect(() => {
    if (draftScope && draftScopeLoaded === draftScope) localStorage.setItem(draftScope, JSON.stringify(draft));
  }, [draft, draftScope, draftScopeLoaded]);

  const viewGame = useMemo(() => {
    const view = structuredClone(game);
    if (playerId !== undefined) view.active = playerId;
    view.selected = selectedHexId;
    return view;
  }, [game, playerId, selectedHexId]);

  const militaryOrigin = game.carriers.find((carrier) => taskForceIds.includes(carrier.id))?.hex;
  const militaryMovement = taskForceIds.length ? Math.min(...game.carriers.filter((carrier) => taskForceIds.includes(carrier.id)).map((carrier) => carrier.movesRemaining)) : 0;
  const militaryTargets = militaryTargeting && militaryOrigin
    ? reachableHexes(militaryOrigin, militaryMovement, map, (id) => {
      const hex = game.hexes.find((candidate) => candidate.id === id);
      return !!hex && hex.revealed && hex.kind !== "rift";
    }) : [];
  const selectedExplorer = mapUnit?.kind === "explorer"
    ? player?.explorationVessels.find((unit) => unit.id === mapUnit.id) || (mapUnit.id === "explorer" ? player?.explorationVessels[0] : undefined)
    : undefined;
  const draftedScanHexIds = selectedExplorer
    ? draft.find((order): order is Extract<SecretOrder, { kind: "explorerScan" }> => order.kind === "explorerScan" && (order.vesselId || player?.explorationVessels[0]?.id) === selectedExplorer.id)?.hexIds || []
    : [];
  const unitRange = selectedExplorer?.movesRemaining || (mapUnit?.kind === "colony" ? game.moves.colony : game.civilianUnits.find((unit) => unit.id === mapUnit?.id)?.movesRemaining || 1);
  const unitTargets = unitIntent && mapUnit ? (unitIntent === "longRangeSurvey" ? game.hexes.map((hex) => hex.id) : unitIntent === "farboundScan" || unitIntent === "publicScan" ? getNeighbors(mapUnit.hex, map) : reachableHexes(mapUnit.hex, unitRange, map, (id, final) => {
    const hex = game.hexes.find((candidate) => candidate.id === id);
    return !!hex && hex.kind !== "rift" && (mapUnit.kind === "explorer" ? hex.revealed || final : hex.revealed);
  })).filter((id) => {
    const hex = game.hexes.find((candidate) => candidate.id === id);
    if (!hex || hex.kind === "rift") return false;
    if (unitIntent === "longRangeSurvey" || unitIntent === "farboundScan") return !hex.revealed && !player?.privateSurveys.some((survey) => survey.hexId === id);
    if (unitIntent === "publicScan") return !hex.revealed && !draftedScanHexIds.includes(id);
    return mapUnit.kind === "explorer" || hex.revealed;
  }) : [];
  const buildTargets = buildTargeting && player ? game.hexes.filter((hex) => hex.owner === player.id && hex.tier && hex.constructionUsedTurn !== game.turn).map((hex) => hex.id) : [];
  const activeTargets = militaryTargets.length ? militaryTargets : unitTargets.length ? unitTargets : buildTargets;

  function clickHex(id: string) {
    setSelectedHexId(id);
    if (militaryTargeting && militaryTargets.includes(id)) {
      const selected = [...taskForceIds];
      const path = shortestPath(militaryOrigin!, id, map, (step) => !!game.hexes.find((hex) => hex.id === step && hex.revealed && hex.kind !== "rift"));
      setDraft((current) => [...current.filter((order) => order.kind !== "carrierMove" || !order.carrierIds.some((carrierId) => selected.includes(carrierId))), { id: uid("fleet"), kind: "carrierMove", carrierIds: selected, destination: id, path }]);
      setMilitaryTargeting(false); setPanel("orders"); return;
    }
    if (unitIntent && mapUnit && unitTargets.includes(id)) {
      if (unitIntent === "farboundScan") {
        setDraft((current) => [...removeUnitOrders(current, mapUnit), { id: uid("forward-scan"), kind: "farboundForwardScan", vesselId: mapUnit.id, hexId: id }]);
        setDraftNotice(`Private Forward Scan of ${id} added to Orders.`);
        setUnitIntent(null); setContextOpen(false); return;
      }
      if (unitIntent === "publicScan" && selectedExplorer) {
        const limit = explorationLibrary[selectedExplorer.type].reveals;
        const hexIds = [...new Set([...draftedScanHexIds, id])].slice(0, limit);
        setDraft((current) => [...removeUnitOrders(current, mapUnit), { id: uid("scan"), kind: "explorerScan", vesselId: selectedExplorer.id, hexIds }]);
        if (hexIds.length < limit) {
          setDraftNotice(`${id} selected. Choose ${limit - hexIds.length} more adjacent sector for this Pathfinder scan, or cancel to keep the current selection.`);
        } else {
          setDraftNotice(`${hexIds.length} public scans added to Orders.`);
          setUnitIntent(null); setPanel("orders");
        }
        return;
      }
      const path = unitIntent === "move" ? shortestPath(mapUnit.hex, id, map, (step, final) => { const hex = game.hexes.find((candidate) => candidate.id === step); return !!hex && hex.kind !== "rift" && (mapUnit.kind === "explorer" ? hex.revealed || final : hex.revealed); }) : undefined;
      const order: SecretOrder = unitIntent === "longRangeSurvey" ? { id: uid("survey"), kind: "longRangeSurvey", unitId: mapUnit.id, hexId: id } : mapUnit.kind === "explorer" ? { id: uid("explorer"), kind: "explorerMove", vesselId: selectedExplorer?.id || mapUnit.id, destination: id, path } : mapUnit.kind === "colony" ? { id: uid("colony"), kind: "colonyMove", destination: id, path } : { id: uid("civilian"), kind: "civilianMove", unitId: mapUnit.id, destination: id };
      setDraft((current) => [...removeUnitOrders(current, mapUnit), order]);
      setDraftNotice(unitIntent === "longRangeSurvey" ? `Long-Range Survey of ${id} added to Orders.` : `Move to ${id} added to Orders.`);
      setUnitIntent(null); setPanel("orders"); return;
    }
    if (buildTargeting && buildTargets.includes(id)) { setBuildHexId(id); setBuildTargeting(false); setPanel("build"); setDockOpen(true); return; }
    if (!militaryTargeting && !unitIntent && !buildTargeting) { setMapUnit(null); setContextOpen(true); setPanel("map"); setDockOpen(false); }
  }

  function selectMapUnit(unit: MapUnit) { setMapUnit(unit); setSelectedHexId(unit.hex); setPanel("map"); setContextOpen(true); setDockOpen(false); setUnitIntent(null); }
  function notify(text: string) { setDraftNotice(text); }
  function removeUnitOrders(current: SecretOrder[], unit: MapUnit) {
    return current.filter((order) => unit.kind === "explorer" ? !((order.kind === "explorerMove" || order.kind === "explorerScan" || order.kind === "farboundForwardScan") && (order.vesselId || player?.explorationVessels[0]?.id) === unit.id) : unit.kind === "colony" ? order.kind !== "colonyMove" && order.kind !== "establish" : !((order.kind === "civilianMove" || order.kind === "prospect" || order.kind === "longRangeSurvey") && order.unitId === unit.id));
  }
  const budget = player ? projectedOrderBudget(viewGame, player.id, draft) : undefined;
  const hidden = player?.hiddenLegacy[game.era];
  const pendingProposals = playerId === undefined ? 0 : game.proposals.filter((proposal) => proposal.status === "pending" && (proposal.kind === "technology" ? proposal.buyer === playerId : proposal.to === playerId)).length;
  const incomingProposals = playerId === undefined ? [] : game.proposals.filter((proposal) => proposal.status === "pending" && (proposal.kind === "technology" ? proposal.buyer === playerId : proposal.to === playerId));
  const hiddenRequired = !!player && (game.turn - 1) % 4 === 0 && !hidden?.selected;
  const selectedHex = game.hexes.find((hex) => hex.id === selectedHexId) || game.hexes[0];
  const pendingCapture = game.pendingCenterLoss;
  const captureHexId = pendingCapture?.hexId;
  const captureCount = pendingCapture?.removeCount || 0;
  const captureOwner = pendingCapture?.playerId;
  const capturedCenters = captureHexId ? game.hexes.find((hex) => hex.id === captureHexId)?.centers || [] : [];
  const selectedCivilian = mapUnit?.kind === "civilian" ? game.civilianUnits.find((unit) => unit.id === mapUnit.id) : undefined;
  const selectedCarrier = !mapUnit && taskForceIds.length === 1 ? game.carriers.find((carrier) => carrier.id === taskForceIds[0] && carrier.hex === selectedHex.id) : undefined;
  const selectedUnitName = selectedCivilian ? civilianLibrary[selectedCivilian.type].name : mapUnit?.kind === "colony" ? "Colony Ship" : selectedExplorer ? explorationLibrary[selectedExplorer.type].name : "Vessel";
  const establishHex = mapUnit?.kind === "colony" ? game.hexes.find((hex) => hex.id === mapUnit.hex) : undefined;
  const establishReason = !player?.modules ? "Construct a Habitat Module first." : !establishHex?.revealed ? "The Colony Ship must occupy a revealed world." : establishHex.owner !== undefined ? "This world is already controlled." : ["rift", "hazard", "anomaly", "empty"].includes(establishHex.kind) ? "Habitats cannot be established in this sector." : "";
  const canMoveSelected = mapUnit?.kind === "explorer" ? !!selectedExplorer && selectedExplorer.readyTurn <= game.turn && selectedExplorer.movesRemaining > 0 : mapUnit?.kind === "colony" ? game.moves.colony > 0 : !!selectedCivilian && selectedCivilian.readyTurn <= game.turn && selectedCivilian.movesRemaining > 0;
  const prospectHex = selectedCivilian?.type === "prospector" ? game.hexes.find((hex) => hex.id === selectedCivilian.hex) : undefined;
  const prospectReason = selectedCivilian?.usedTurn === game.turn ? "This Prospector already acted this Turn." : selectedCivilian && selectedCivilian.movesRemaining < civilianLibrary.prospector.move ? "Prospecting replaces all movement for this vessel." : !prospectHex?.revealed || prospectHex.owner !== undefined || prospectHex.prospected || !["material", "currency", "research", "influence", "labor", "barren"].includes(prospectHex.kind) ? "Prospect requires a revealed, unclaimed, unprospected world." : "";
  const controlledHabitats = player ? game.hexes.filter((hex) => hex.owner === player.id && hex.tier) : [];
  const selectedHexUnits: SelectedHexUnit[] = [
    ...game.players.flatMap((owner) => (owner.explorationVessels || []).filter((unit) => unit.hex === selectedHex.id).map((unit) => ({ key: unit.id, owner: owner.id, label: explorationLibrary[unit.type].name, icon: explorationIcon(explorationLibrary[unit.type].tech), unit: { kind: "explorer", id: unit.id, hex: selectedHex.id, icon: explorationIcon(explorationLibrary[unit.type].tech) } as MapUnit }))),
    ...game.players.filter((owner) => owner.colonyShip === selectedHex.id).map((owner) => ({ key: `colony-${owner.id}`, owner: owner.id, label: "Colony Ship", icon: "colonyShip" as ShipIconType, unit: { kind: "colony", id: "colony", hex: selectedHex.id, icon: "colonyShip" } as MapUnit })),
    ...game.civilianUnits.filter((unit) => unit.hex === selectedHex.id).map((unit) => ({ key: unit.id, owner: unit.owner, label: civilianLibrary[unit.type].name, icon: unit.type as ShipIconType, unit: { kind: "civilian", id: unit.id, hex: selectedHex.id, icon: unit.type } as MapUnit })),
    ...game.carriers.filter((carrier) => carrier.hex === selectedHex.id).map((carrier) => ({ key: carrier.id, owner: carrier.owner, label: carrierLibrary[carrier.type].name, icon: carrier.type as ShipIconType, carrierId: carrier.id })),
  ];
  const quickConstructions: Array<{ label: string; construction: Construction }> = player && selectedHex.owner === player.id && selectedHex.tier ? [
    { label: "Habitat Module", construction: { type: "module" } },
    { label: "Upgrade Habitat", construction: { type: "upgrade" } },
    ...(["material", "currency", "research", "influence", "labor", "defense"] as CenterType[]).map((center) => ({ label: `${center[0].toUpperCase()}${center.slice(1)} Center`, construction: { type: "center" as const, center } })),
    { label: "Recruit 2 CU", construction: { type: "recruit", pairs: 1 } },
    ...availableCarrierTypes(player!).map((carrier) => ({ label: carrierLibrary[carrier].name, construction: { type: "carrier" as const, carrier } })),
    ...availableExplorationTypes(game, playerId!).map((vessel) => ({ label: explorationLibrary[vessel].name, construction: { type: "exploration" as const, vessel } })),
    ...(availableCivilianType(game, playerId!) ? [{ label: civilianLibrary[availableCivilianType(game, playerId!)!].name, construction: { type: "civilian" as const, civilian: availableCivilianType(game, playerId!)! } }] : []),
  ] : [];
  const notifications: ActivityItem[] = [
    ...incomingProposals.map((proposal) => ({ id: proposal.id, type: "proposal", text: `${game.players[proposal.kind === "technology" ? proposal.seller : proposal.from].name} sent a ${proposal.kind} proposal.`, playerId: proposal.kind === "technology" ? proposal.seller : proposal.from })),
    ...session.summary.recentEvents.slice(-8).reverse().map((event) => ({ id: event.id, type: event.type, text: event.message, hexId: event.message.match(/\b\d+-\d+\b/)?.[0] })),
  ];
  const hasDraftedGate = draft.some((order) => order.kind === "tribute") || (player?.eraTributes[game.era - 1] || 0) > 0;

  function draftQuickConstruction(construction: Construction) {
    if (!player || selectedHex.owner !== player.id || !selectedHex.tier) return;
    const quote = constructionQuote(viewGame, player.id, selectedHex.id, construction);
    const order: SecretOrder = { id: `build-${selectedHex.id}`, kind: "construct", habitatId: selectedHex.id, construction };
    const next = [...draft.filter((candidate) => candidate.kind !== "construct" || candidate.habitatId !== selectedHex.id), order];
    const projected = projectedOrderBudget(viewGame, player.id, next);
    if (!quote.available || projected.error) return notify(projected.error || quote.reason || "That construction is unavailable.");
    setDraft(next); notify(`${quote.label} drafted at ${selectedHex.id}.`);
  }

  function quickConstructionStatus(construction: Construction) {
    if (!player || selectedHex.owner !== player.id || !selectedHex.tier) return { available: false, label: "Unavailable", cost: {}, reason: "Select a controlled Habitat." };
    const quote = constructionQuote(viewGame, player.id, selectedHex.id, construction);
    const order: SecretOrder = { id: `build-${selectedHex.id}`, kind: "construct", habitatId: selectedHex.id, construction };
    const next = [...draft.filter((candidate) => candidate.kind !== "construct" || candidate.habitatId !== selectedHex.id), order];
    const budgetCheck = projectedOrderBudget(viewGame, player.id, next);
    return { ...quote, available: quote.available && !budgetCheck.error, reason: budgetCheck.error || quote.reason };
  }

  function focusHex(hexId: string) {
    setPanel("map"); setSelectedHexId(hexId); setMapUnit(null); setContextOpen(true); setDockOpen(false); setNotificationsOpen(false);
    window.setTimeout(() => document.querySelector(`[data-hex-id="${hexId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 0);
  }

  function openDiplomacy(targetId?: number) {
    setDiplomacyTargetId(targetId); setPanel("diplomacy"); setNotificationsOpen(false);
  }

  function unitDraftIndex(unit: MapUnit) {
    return draft.findIndex((order) => unit.kind === "explorer" ? (order.kind === "explorerMove" || order.kind === "explorerScan" || order.kind === "farboundForwardScan") && (order.vesselId || player?.explorationVessels[0]?.id) === unit.id : unit.kind === "colony" ? order.kind === "colonyMove" || order.kind === "establish" : (order.kind === "civilianMove" || order.kind === "prospect" || order.kind === "longRangeSurvey") && order.unitId === unit.id);
  }

  function carrierDraftIndex(carrierId: string) {
    return draft.findIndex((order) => order.kind === "carrierMove" && order.carrierIds.includes(carrierId));
  }

  function hexDraftIndices(hexId: string) {
    return draft.map((order, index) => ({ order, index })).filter(({ order }) =>
      (order.kind === "construct" && order.habitatId === hexId) ||
      (order.kind === "establish" && order.hexId === hexId) ||
      (order.kind === "longRangeSurvey" && order.hexId === hexId) ||
      ((order.kind === "explorerMove" || order.kind === "colonyMove" || order.kind === "civilianMove" || order.kind === "carrierMove") && order.destination === hexId),
    ).map(({ index }) => index);
  }

  function draftEstablish() {
    if (!mapUnit || mapUnit.kind !== "colony" || establishReason) return notify(establishReason || "Select your Colony Ship.");
    setDraft((current) => [...removeUnitOrders(current, mapUnit), { id: uid("establish"), kind: "establish", hexId: mapUnit.hex }]);
    notify(`Establish Habitat at ${mapUnit.hex} added to Orders.`); setPanel("orders");
  }

  function draftProspect() {
    if (!mapUnit || !selectedCivilian) return;
    setDraft((current) => [...removeUnitOrders(current, mapUnit), { id: uid("prospect"), kind: "prospect", unitId: mapUnit.id }]);
    notify(`Prospect at ${mapUnit.hex} added to Orders.`); setPanel("orders");
  }

  function centerMap() {
    const viewport = mapViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ left: Math.max(0, (1420 * mapZoom - viewport.clientWidth) / 2), top: Math.max(0, (1260 * mapZoom - viewport.clientHeight) / 2), behavior: "smooth" });
  }

  function selectPanel(next: Panel) {
    setPanel(next);
    if (!fullScreenPanels.includes(next)) setDockOpen(true);
    if (next === "build") { setBuildTargeting(true); setBuildHexId(null); }
  }

  return <main className="game-shell network-alpha" data-theme={game.themeId} data-spectator={spectator} data-dock={dockOpen ? "open" : "closed"} data-map-columns={map.columns} style={{ "--player": player?.color || "#50dcff" } as React.CSSProperties}>
    <header className="topbar network-topbar"><img src="/horizon-logo.png" alt="Horizon" /><div className="turn-id"><span>NETWORK OPERATIONS · {session.code}</span><strong>ERA {game.era} · TURN {game.turn} / {totalTurns(game)}</strong></div><div className="gate-mini"><div><span>HORIZON GATE</span><strong>{game.gate} / {gateTarget(game)}</strong></div><div className="gate-track"><i style={{ width: `${Math.min(100, game.gate / gateTarget(game) * 100)}%` }} /></div></div><button className="score-toggle" onClick={() => setNotificationsOpen((open) => !open)}>Activity <b>{incomingProposals.length || notifications.length}</b></button><div className={`network-connection ${connection}`}><i /><span>{connection}</span><b>REV {session.revision}</b></div><button className="ghost" onClick={onLeave}>Exit room</button></header>
    <section className="faction-scorebar" aria-label="Civilization standings">
      {game.players.map((civilization) => {
        const contacted = playerId === civilization.id || (playerId !== undefined && isContacted(game, playerId, civilization.id));
        const agreements = playerId === undefined || playerId === civilization.id ? [] : activeAgreements(game, playerId, civilization.id);
        const proposals = incomingProposals.filter((proposal) => (proposal.kind === "technology" ? proposal.seller : proposal.from) === civilization.id);
        const sealed = game.orderProtocol.submissions.some((submission) => submission.playerId === civilization.id);
        const faction = session.summary.availableFactions.find((candidate) => candidate.id === civilization.faction);
        return <button key={civilization.id} className={`${playerId === civilization.id ? "self" : ""} ${proposals.length ? "attention" : ""}`} style={{ "--faction": civilization.color } as React.CSSProperties} onClick={() => playerId === civilization.id || playerId === undefined ? setScoreOpen(true) : openDiplomacy(civilization.id)}>
          <i>{faction?.logo ? <img src={faction.logo} alt={`${civilization.name} emblem`} /> : civilization.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</i>
          <span><b>{civilization.name}</b><small>{contacted ? "Contact" : "No contact"} · {sealed ? "Orders sealed" : "Planning"}</small></span>
          <strong>{civilization.lp}<small> LP</small></strong>
          {agreements.length > 0 && <em title={agreements.map((agreement) => agreementNames[agreement.type]).join(", ")}>{agreements.map((agreement) => agreement.type.slice(0, 1).toUpperCase()).join("")}</em>}
          {proposals.length > 0 && <mark title="Incoming proposal">{proposals.length}</mark>}
        </button>;
      })}
    </section>
    {(message || error) && <div className={`notice ${error ? "room-error" : ""}`}>{error || message}</div>}
    {scoreOpen && <aside className="network-score-popover"><header><b>Current standings</b><button onClick={() => setScoreOpen(false)}>Close</button></header>{[...game.players].sort((a, b) => b.lp - a.lp).map((civilization, index) => <div className="standing" key={civilization.id}><i style={{ background: civilization.color }} /><b>{index + 1}</b><span>{civilization.name}<small>{civilization.controller.kind === "bot" ? "AI" : session.summary.seats[civilization.id]?.displayName || "Human"}</small></span><strong>{civilization.lp}</strong></div>)}<RoomStatus session={session} connection={connection} /></aside>}
    {notificationsOpen && <aside className="notification-popover"><header><b>Activity and notifications</b><button onClick={() => setNotificationsOpen(false)}>Close</button></header>{notifications.map((item) => <button key={item.id} onClick={() => item.type === "proposal" ? openDiplomacy(item.playerId) : item.hexId ? focusHex(item.hexId) : setNotificationsOpen(false)}><i>{item.type.slice(0, 3).toUpperCase()}</i><span>{item.text}</span>{item.hexId && <small>Locate {item.hexId}</small>}</button>)}{!notifications.length && <p>No recent activity.</p>}</aside>}
    {incomingProposals.length > 0 && panel !== "diplomacy" && <button className="proposal-alert" onClick={() => openDiplomacy(incomingProposals[0].kind === "technology" ? incomingProposals[0].seller : incomingProposals[0].from)}><span>{incomingProposals.length}</span><b>Diplomatic proposal{incomingProposals.length === 1 ? "" : "s"} waiting</b><small>Open Diplomacy to review</small></button>}
    <div className="play-area network-play-area">
      <aside className="left-rail network-command-dock"><button className="dock-toggle" aria-expanded={dockOpen} onClick={() => setDockOpen((open) => !open)}><i>{dockOpen ? "‹" : "›"}</i><span>{dockOpen ? "Collapse command dock" : "Expand command dock"}</span></button>{dockOpen && <><div className="identity"><span>{spectator ? "PUBLIC SPECTATOR" : session.role === "host" ? "ROOM HOST" : "PRIVATE NETWORK SEAT"}</span><h2>{player?.name || "The Shattered Reach"}</h2><p>{player?.faction || "Live public board"}</p></div>{player && <div className="resources">{(["material", "currency", "research", "influence"] as Resource[]).map((resource) => <div key={resource}><i className={resource}>{resource[0].toUpperCase()}</i><small>{resource}</small><strong>{player.resources[resource]}</strong></div>)}<div><i className="labor">L</i><small>Labor</small><strong>{player.labor}/{player.laborCap}</strong></div></div>}</>}
        <nav aria-label="Game actions">{(["map", "military", "build", "technology", "economy", "gate", "diplomacy", "legacy", "orders", "room"] as Panel[]).map((id) => { const badge = id === "diplomacy" ? pendingProposals : id === "legacy" && hiddenRequired ? 1 : 0; const item = panelLabels[id]; return <button key={id} title={item.label} className={panel === id ? "active" : ""} disabled={spectator && !["map", "room"].includes(id)} onClick={() => selectPanel(id)}><i>{item.icon}</i><span>{item.label}</span>{badge ? <sup>{badge}</sup> : null}</button>; })}</nav>
        {dockOpen && <>
        <section className="action-panel network-action-panel">
          <button className="dock-panel-close" onClick={() => setDockOpen(false)}>Close panel</button>
          {draftNotice && <button className="draft-notice" onClick={() => setPanel("orders")}>{draftNotice}<small>Open Orders</small></button>}
          {panel === "map" && <div className="network-map-command"><h3>{spectator ? "Spectator view" : "Vessel Actions"}</h3><p>{spectator ? "Private objectives, proposals, surveys, and sealed Orders are concealed." : "Select one of your vessel icons on the map. Every available action appears here."}</p>{!mapUnit && !spectator && <div className="map-first-tip"><b>Choose a vessel on the map</b><span>Explorer, Colony Ship, civilian vessel, or Carrier icons can be selected directly.</span></div>}{mapUnit && <div className="selected-unit-card"><ShipIcon type={mapUnit.icon} color={player?.color} /><span><b>{selectedUnitName}</b><small>{mapUnit.hex}</small></span><div className="selected-unit-actions"><button className="primary" disabled={!canPlan || !canMoveSelected} onClick={() => setUnitIntent("move")}>Move</button>{mapUnit.kind === "colony" && <button disabled={!canPlan || !!establishReason} title={establishReason} onClick={draftEstablish}>Establish Habitat</button>}{selectedCivilian?.type === "prospector" && <button disabled={!canPlan || !!prospectReason} title={prospectReason} onClick={draftProspect}>Prospect current world</button>}{selectedCivilian?.type === "surveyor" && <button disabled={!canPlan || player?.surveyUsedTurn === game.turn || selectedCivilian.usedTurn === game.turn || selectedCivilian.readyTurn > game.turn} onClick={() => setUnitIntent("longRangeSurvey")}>Long-Range Survey</button>}<button disabled={!canPlan} onClick={() => { setDraft((current) => removeUnitOrders(current, mapUnit)); notify(`${selectedUnitName} will Hold.`); setPanel("orders"); }}>Hold</button></div>{mapUnit.kind === "colony" && establishReason && <small className="action-reason">{establishReason}</small>}{selectedCivilian?.type === "prospector" && prospectReason && <small className="action-reason">{prospectReason}</small>}</div>}</div>}
          {panel === "military" && player && <NetworkMilitaryPanel game={viewGame} playerId={player.id} draft={draft} setDraft={setDraft} selectedIds={taskForceIds} setSelectedIds={setTaskForceIds} targeting={militaryTargeting} beginTargeting={() => setMilitaryTargeting(true)} busy={busy} onCommand={onCommand} />}
          {panel === "map" && selectedExplorer && <div className="exploration-actions"><h4>Exploration actions</h4>{explorationLibrary[selectedExplorer.type].tech >= 2 && <button disabled={!canPlan} onClick={() => setUnitIntent("publicScan")}>Publicly scan adjacent hex</button>}{player?.faction === "farbound" && <button disabled={!canPlan || player.forwardScanUsedTurn === game.turn} onClick={() => setUnitIntent("farboundScan")}>Private Forward Scan</button>}</div>}
          {panel === "build" && player && <BuildPanel game={viewGame} habitatId={buildHexId} draft={draft} setDraft={setDraft} flash={notify} selectHabitat={() => { setBuildTargeting(true); setBuildHexId(null); }} />}
          {panel === "gate" && player && <NetworkGatePanel game={viewGame} playerId={player.id} draft={draft} setDraft={setDraft} notify={notify} />}
          {panel === "orders" && player && game.orderProtocol.phase === "negotiation" && <div className="network-orders negotiation-step"><h3>Negotiation Phase</h3><p>Trade, form agreements, exchange information, choose Homeworld production, and select this Era&apos;s Hidden Legacy objective before Orders.</p><button className="primary wide" disabled={busy || hiddenRequired} onClick={() => void onCommand({ kind: "beginOrders" })}>{hiddenRequired ? "Choose Hidden Legacy first" : "Begin secret Orders"}</button></div>}
          {panel === "orders" && player && <div className="network-orders"><h3>Private Order Queue</h3><p>{canPlan ? "Review the complete private plan before sealing it. Drafts are saved on this device until submitted." : "Your Orders are sealed for this Turn."}</p><section className="seal-checklist"><h4>Before you seal</h4><span className={hidden?.selected ? "complete" : "warning"}><i>{hidden?.selected ? "OK" : "!"}</i><b>Hidden objective</b><small>{hidden?.selected ? "Selected for this Era" : "Selection required"}</small></span><span className={draft.length ? "complete" : "warning"}><i>{draft.length || "!"}</i><b>Orders drafted</b><small>{draft.length ? `${draft.length} action${draft.length === 1 ? "" : "s"} in queue` : "Empty queue will issue Hold"}</small></span><span className={budget?.error ? "warning" : "complete"}><i>{budget?.error ? "!" : "OK"}</i><b>Projected budget</b><small>{budget?.error || "All drafted costs are affordable"}</small></span><span className="advisory"><i>{controlledHabitats.length}</i><b>Controlled Habitats</b><small>{controlledHabitats.filter((hex) => hex.constructionUsedTurn !== game.turn && !draft.some((order) => order.kind === "construct" && order.habitatId === hex.id)).length} still have an unused construction opportunity</small></span><span className={hasDraftedGate ? "complete" : "advisory"}><i>{hasDraftedGate ? "OK" : "?"}</i><b>Horizon Gate</b><small>{hasDraftedGate ? "Contribution recorded or drafted this Era" : "No contribution recorded this Era"}</small></span><span className={incomingProposals.length ? "advisory" : "complete"}><i>{incomingProposals.length || "OK"}</i><b>Diplomacy inbox</b><small>{incomingProposals.length ? `${incomingProposals.length} unanswered proposal${incomingProposals.length === 1 ? "" : "s"}` : "No unanswered proposals"}</small></span></section><div className="network-order-list">{draft.map((order, index) => <div key={order.id}><i className="order-number">{index + 1}</i><span>{orderLabel(order)}</span><button onClick={() => setDraft((current) => current.filter((candidate) => candidate.id !== order.id))}>Remove</button></div>)}{!draft.length && <small>No drafted Orders. An empty submission issues Hold.</small>}</div><div className="network-budget"><span>Projected cost</span><b>{formatPurchaseCost(player ? totalOrderCost(viewGame, player.id, draft) : {})}</b><span>Budget status</span><b>{budget?.error || "Valid"}</b></div><button className="primary wide" disabled={!canPlan || busy || !!budget?.error || ((game.turn - 1) % 4 === 0 && !hidden?.selected)} onClick={() => void onCommand({ kind: "submitOrders", orders: draft })}>{canPlan ? "Seal Orders and end Turn" : "Orders sealed"}</button></div>}
          {panel === "room" && <><RoomStatus session={session} connection={connection} /><RoomLobby session={session} busy={busy} onCommand={onCommand} onRefresh={onRefresh} onLeave={onLeave} onExportReport={onExportReport} /></>}
        </section>{player && <button className="end-turn" onClick={() => setPanel("orders")}>{canPlan ? "Review and seal Orders" : "Orders sealed"}</button>}</>}</aside>

      <section className="map-wrap"><div className="map-header"><div><p>{map.name.toUpperCase()} · SEED {game.seed}</p><h1>{selectedHex.revealed ? `${selectedHex.kind} sector` : "Uncharted"}</h1></div><div className="map-controls"><button aria-label="Zoom out" onClick={() => setMapZoom((value) => Math.max(.4, value - .1))}>−</button><span>{Math.round(mapZoom * 100)}%</span><button aria-label="Zoom in" onClick={() => setMapZoom((value) => Math.min(1.3, value + .1))}>+</button><button onClick={centerMap}>Center</button></div><div className="network-map-help">{activeTargets.length ? `${activeTargets.length} legal targets` : "Select a vessel or hex"}</div></div>{activeTargets.length > 0 && <div className="network-target-prompt"><span><b>{selectedUnitName}</b><small>{unitIntent === "farboundScan" ? "Survey selected" : unitIntent === "longRangeSurvey" ? "Long-Range Survey selected" : "Move selected"}</small></span><strong>{unitIntent === "longRangeSurvey" || unitIntent === "farboundScan" ? "Choose an unrevealed sector" : "Choose a highlighted destination"}</strong><button onClick={() => { setUnitIntent(null); setMilitaryTargeting(false); setBuildTargeting(false); }}>Cancel</button></div>}<div ref={mapViewportRef} className={`map-viewport ${activeTargets.length ? "targeting" : ""}`}><div className="map-scale" style={{ width: 1420 * mapZoom, height: 1260 * mapZoom }}><div className="map-stage" style={{ transform: `scale(${mapZoom})` }}><div className="hex-map">{game.hexes.map((hex) => <button key={hex.id} data-hex-id={hex.id} onClick={() => clickHex(hex.id)} className={`hex ${hex.kind} ${!hex.revealed ? "concealed" : ""} ${selectedHexId === hex.id ? "selected" : ""} ${activeTargets.includes(hex.id) ? "legal-target" : ""}`} style={{ gridColumn: hex.col + 1, gridRow: hex.row + 1, "--owner": hex.owner === undefined ? "transparent" : game.players[hex.owner]?.color } as React.CSSProperties}><span className="hex-inner"><img className="tile-art" src={hex.revealed ? tileAssets[hex.kind] : tileAssets.unrevealed} alt="" />{hex.revealed && hex.kind !== "rift" && <><small>{hex.id}</small><b>{labels[hex.kind]}</b>{hex.tier && <em>{hex.tier[0]}</em>}{hex.centers.length > 0 && <u>{hex.centers.length}C</u>}</>}{hexDraftIndices(hex.id).map((index) => <mark key={index} className="hex-order-marker">{index + 1}</mark>)}</span></button>)}</div><div className="unit-layer">{game.hexes.map((hex) => <div className="unit-cell" key={hex.id} style={{ gridColumn: hex.col + 1, gridRow: hex.row + 1 }}>{game.players.filter((owner) => owner.explorer === hex.id).map((owner) => { const unit = { kind: "explorer", id: "explorer", hex: hex.id, icon: explorationIcon(owner.tech.Exploration) } as MapUnit; const orderIndex = owner.id === playerId ? unitDraftIndex(unit) : -1; return <button key={`e-${owner.id}`} className={`map-unit ${mapUnit?.kind === "explorer" && owner.id === playerId ? "selected" : ""} ${orderIndex >= 0 ? "drafted" : ""}`} aria-label={`${owner.name} Explorer at ${hex.id}`} onClick={() => owner.id === playerId && selectMapUnit(unit)}><ShipIcon type={unit.icon} color={owner.color} />{orderIndex >= 0 && <mark className="unit-order-marker">{orderIndex + 1}</mark>}</button>; })}{game.players.filter((owner) => owner.colonyShip === hex.id).map((owner) => { const unit = { kind: "colony", id: "colony", hex: hex.id, icon: "colonyShip" } as MapUnit; const orderIndex = owner.id === playerId ? unitDraftIndex(unit) : -1; return <button key={`c-${owner.id}`} className={`map-unit ${mapUnit?.kind === "colony" && owner.id === playerId ? "selected" : ""} ${orderIndex >= 0 ? "drafted" : ""}`} aria-label={`${owner.name} Colony Ship at ${hex.id}`} onClick={() => owner.id === playerId && selectMapUnit(unit)}><ShipIcon type="colonyShip" color={owner.color} />{orderIndex >= 0 && <mark className="unit-order-marker">{orderIndex + 1}</mark>}</button>; })}{game.civilianUnits.filter((unit) => unit.hex === hex.id).map((unit) => { const mapUnitValue = { kind: "civilian", id: unit.id, hex: hex.id, icon: unit.type } as MapUnit; const orderIndex = unit.owner === playerId ? unitDraftIndex(mapUnitValue) : -1; return <button key={unit.id} className={`map-unit ${mapUnit?.id === unit.id ? "selected" : ""} ${orderIndex >= 0 ? "drafted" : ""}`} aria-label={`${civilianLibrary[unit.type].name} at ${hex.id}`} onClick={() => unit.owner === playerId && selectMapUnit(mapUnitValue)}><ShipIcon type={unit.type} color={game.players[unit.owner].color} />{orderIndex >= 0 && <mark className="unit-order-marker">{orderIndex + 1}</mark>}</button>; })}{game.carriers.filter((carrier) => carrier.hex === hex.id).map((carrier) => { const orderIndex = carrier.owner === playerId ? carrierDraftIndex(carrier.id) : -1; return <button key={carrier.id} className={`map-unit carrier ${selectedCarrier?.id === carrier.id ? "selected" : ""} ${orderIndex >= 0 ? "drafted" : ""}`} aria-label={`${carrier.type} with ${carrier.cu} Combat Units at ${hex.id}`} onClick={() => { if (carrier.owner === playerId) { setTaskForceIds([carrier.id]); setSelectedHexId(hex.id); setMapUnit(null); setContextOpen(true); setPanel("map"); setDockOpen(false); } }}><ShipIcon type={carrier.type} color={game.players[carrier.owner].color} /><small>{carrier.cu}</small>{orderIndex >= 0 && <mark className="unit-order-marker">{orderIndex + 1}</mark>}</button>; })}</div>)}</div></div></div></div><div className="selected-card"><div><span>SELECTED HEX {selectedHex.id}</span><strong>{selectedHex.revealed ? selectedHex.kind : "Uncharted"}</strong></div><div>{selectedHex.owner !== undefined && <><span>CONTROL</span><strong style={{ color: game.players[selectedHex.owner].color }}>{game.players[selectedHex.owner].name}</strong></>}</div><div>{selectedHex.tier && <><span>HABITAT</span><strong>{selectedHex.tier} · {selectedHex.combat} stationed CU</strong></>}</div></div></section>
    </div>
    {contextOpen && selectedHex && <aside className="map-context-menu" aria-label={`Actions for ${selectedHex.id}`}>
      <header><div><span>{mapUnit || selectedCarrier ? "SELECTED VESSEL" : `HEX ${selectedHex.id}`}</span><b>{mapUnit ? selectedUnitName : selectedCarrier ? carrierLibrary[selectedCarrier.type].name : selectedHex.revealed ? `${selectedHex.kind} sector` : "Uncharted sector"}</b></div><button onClick={() => setContextOpen(false)}>Close</button></header>
      {mapUnit && <section className="context-primary-actions"><div className="context-unit-title"><ShipIcon type={mapUnit.icon} color={player?.color} /><span><b>{selectedUnitName}</b><small>Currently at {mapUnit.hex}</small></span>{unitDraftIndex(mapUnit) >= 0 && <mark>Order {unitDraftIndex(mapUnit) + 1}</mark>}</div><button className="primary" disabled={!canPlan || !canMoveSelected} onClick={() => { setUnitIntent("move"); setContextOpen(false); }}>Move</button>{mapUnit.kind === "explorer" && player?.faction === "farbound" && <button disabled={!canPlan || player.negotiationSurveyUsedTurn === game.turn} onClick={() => { setUnitIntent("farboundScan"); setContextOpen(false); }}>{player.negotiationSurveyUsedTurn === game.turn ? "Survey used this Turn" : "Farbound Survey"}</button>}{mapUnit.kind === "colony" && <button disabled={!canPlan || !!establishReason} title={establishReason} onClick={() => { draftEstablish(); setContextOpen(false); }}>Establish Habitat</button>}{selectedCivilian?.type === "prospector" && <button disabled={!canPlan || !!prospectReason} title={prospectReason} onClick={() => { draftProspect(); setContextOpen(false); }}>Prospect this world</button>}{selectedCivilian?.type === "surveyor" && <button disabled={!canPlan || player?.surveyUsedTurn === game.turn || selectedCivilian.usedTurn === game.turn || selectedCivilian.readyTurn > game.turn} onClick={() => { setUnitIntent("longRangeSurvey"); setContextOpen(false); }}>Long-Range Survey</button>}<button disabled={!canPlan} onClick={() => { setDraft((current) => removeUnitOrders(current, mapUnit)); notify(`${selectedUnitName} will Hold.`); setContextOpen(false); }}>Hold and clear Order</button>{mapUnit.kind === "colony" && establishReason && <small className="context-reason">{establishReason}</small>}{selectedCivilian?.type === "prospector" && prospectReason && <small className="context-reason">{prospectReason}</small>}</section>}
      {selectedCarrier && <section className="context-primary-actions"><div className="context-unit-title"><ShipIcon type={selectedCarrier.type} color={player?.color} /><span><b>{carrierLibrary[selectedCarrier.type].name}</b><small>{selectedCarrier.cu}/{carrierLibrary[selectedCarrier.type].capacity} CU · {selectedCarrier.movesRemaining} movement</small></span>{carrierDraftIndex(selectedCarrier.id) >= 0 && <mark>Order {carrierDraftIndex(selectedCarrier.id) + 1}</mark>}</div><button className="primary" disabled={!canPlan || selectedCarrier.readyTurn > game.turn || selectedCarrier.movesRemaining < 1 || selectedCarrier.cu < 1} onClick={() => { setMilitaryTargeting(true); setContextOpen(false); }}>Move vessel</button><button disabled={busy || selectedHex.combat < 1} onClick={() => void onCommand({ kind: "transferCombatUnit", carrierId: selectedCarrier.id, direction: "load" })}>Load 1 stationed CU</button><button disabled={busy || selectedCarrier.cu < 1} onClick={() => void onCommand({ kind: "transferCombatUnit", carrierId: selectedCarrier.id, direction: "unload" })}>Station 1 CU</button><button onClick={() => { setPanel("military"); setDockOpen(true); setContextOpen(false); }}>Open Fleet Command</button></section>}
      {!mapUnit && !selectedCarrier && <><section className="context-hex-summary"><span><b>{selectedHex.revealed ? selectedHex.kind : "Unrevealed"}</b><small>{selectedHex.owner === undefined ? "No controlling faction" : `Controlled by ${game.players[selectedHex.owner].name}`}</small></span>{selectedHex.tier && <span><b>{selectedHex.tier}</b><small>{selectedHex.combat} stationed CU · {selectedHex.centers.length} Centers</small></span>}</section>{selectedHexUnits.length > 0 && <section className="context-unit-stack"><h4>Vessels in this hex</h4>{selectedHexUnits.map((item) => <button key={item.key} disabled={item.owner !== playerId} onClick={() => { if (item.unit) selectMapUnit(item.unit); else if (item.carrierId) { setTaskForceIds([item.carrierId]); setMapUnit(null); } }}><ShipIcon type={item.icon} color={game.players[item.owner].color} /><span><b>{item.label}</b><small>{item.owner === playerId ? "Select for actions" : game.players[item.owner].name}</small></span></button>)}</section>}{quickConstructions.length > 0 && <section className="quick-construction"><h4>Build at this Habitat</h4><p>One construction Order may be drafted per Habitat. Choosing another option replaces the current build here.</p>{quickConstructions.map(({ label, construction }) => { const status = quickConstructionStatus(construction); return <button key={JSON.stringify(construction)} disabled={!canPlan || !status.available} title={status.reason} onClick={() => draftQuickConstruction(construction)}><span><b>{label}</b><small>{formatPurchaseCost(status.cost)}</small></span><em>{status.available ? "Draft" : status.reason || "Unavailable"}</em></button>; })}</section>}{selectedHex.owner !== undefined && selectedHex.owner !== playerId && playerId !== undefined && <button className="context-diplomacy-link" onClick={() => { openDiplomacy(selectedHex.owner); setContextOpen(false); }}>Open Diplomacy with {game.players[selectedHex.owner].name}</button>}{!selectedHexUnits.length && !quickConstructions.length && <p className="context-empty">No direct actions are available here. Select a friendly vessel or one of your Habitats for contextual actions.</p>}</>}
    </aside>}
    {fullScreenPanels.includes(panel) && player && <div className="network-workspace-overlay"><section className="network-workspace"><header className="workspace-bar"><div><span>NETWORK COMMAND WORKSPACE</span><b>{panelLabels[panel].label}</b></div><button onClick={() => setPanel("map")}>Return to map</button></header><div className="workspace-scroll">{panel === "diplomacy" && <NetworkDiplomacyPanel key={diplomacyTargetId ?? "default"} game={viewGame} playerId={player.id} busy={busy} onCommand={onCommand} initialTargetId={diplomacyTargetId} />}{panel === "legacy" && <NetworkLegacyPanel game={viewGame} playerId={player.id} busy={busy} onCommand={onCommand} />}{panel === "economy" && <NetworkEconomyPanel game={viewGame} playerId={player.id} busy={busy} onCommand={onCommand} />}{panel === "technology" && <TechnologyPanel game={viewGame} draft={draft} setDraft={setDraft} flash={notify} />}</div></section></div>}
    {spectator && <div className="spectator-floating"><button onClick={onToggleSpectator}>{spectatorPaused ? "Resume updates" : "Pause updates"}</button>{[[700, "Fast"], [1200, "Live"], [3000, "Slow"]].map(([milliseconds, label]) => <button key={milliseconds} className={pollMs === milliseconds ? "active" : ""} onClick={() => onPollMs?.(milliseconds as number)}>{label}</button>)}</div>}
    {hiddenRequired && player && <div className="handoff-overlay hidden-required-overlay"><div className="hidden-required-card"><p>ERA {game.era} OBJECTIVE REQUIRED</p><h1>Select your Hidden Legacy</h1><span>Choose your private objective before accessing the map, diplomacy, economy, or Orders for this Era.</span><NetworkLegacyPanel game={viewGame} playerId={player.id} busy={busy} onCommand={onCommand} /></div></div>}
    {captureOwner === playerId && captureHexId && <div className="handoff-overlay capture-overlay"><div className="handoff-card"><p>CAPTURE RESOLUTION // {captureHexId}</p><h1>Choose {captureCount} Center to destroy</h1><div className="captured-centers">{capturedCenters.map((center, index) => <button key={`${center}-${index}`} disabled={busy} onClick={() => void onCommand({ kind: "removeCapturedCenter", centerIndex: index })}><b>{center === "defense" ? "Defense Grid" : `${center} Center`}</b><small>Destroy this Center</small></button>)}</div></div></div>}
    {["lobby", "paused"].includes(session.summary.status) && <div className="handoff-overlay beta-room-overlay"><div className="beta-room-card"><RoomLobby session={session} busy={busy} onCommand={onCommand} onRefresh={onRefresh} onLeave={onLeave} onExportReport={onExportReport} /></div></div>}
    {game.result && <EndgameResults game={game} newGame={onLeave} />}
  </main>;
}
