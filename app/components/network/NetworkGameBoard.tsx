"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  activeAgreements,
  agreementNames,
  carrierLibrary,
  civilianLibrary,
  explorationLibrary,
  constructionQuote,
  formatPurchaseCost,
  getNeighbors,
  isContacted,
  mapLibrary,
  orderLabel,
  projectedOrderBudget,
  individualOrderCosts,
  totalOrderCost,
  gateTarget,
  totalTurns,
  firstHorizonLessons,
  blockadeCargoCapacity,
  legalBombardmentTargets,
  loadedBlockades,
  mobileHabitatLibrary,
} from "../../../game";
import {
  explorationIcon,
  tileAssets as baseTileAssets,
  type ShipIconType,
} from "../../../game/themes/assets";
import type {
  HexKind,
  Resource,
  RoomCommand,
  RoomSession,
  SecretOrder,
} from "../../../game";
import BuildPanel from "../BuildPanel";
import EndgameResults from "../EndgameResults";
import ShipIcon from "../ShipIcon";
import TechnologyPanel from "../TechnologyPanel";
import NetworkDiplomacyPanel from "./NetworkDiplomacyPanel";
import NetworkEconomyPanel from "./NetworkEconomyPanel";
import NetworkResourcesPanel from "./NetworkResourcesPanel";
import NetworkGatePanel from "./NetworkGatePanel";
import NetworkLegacyPanel from "./NetworkLegacyPanel";
import NetworkMilitaryPanel from "./NetworkMilitaryPanel";
import { hasStationingPermission } from "../../../game/rules/diplomacy";
import RoomLobby from "./RoomLobby";
import RoomStatus from "./RoomStatus";
import CommandIcon from "./CommandIcon";
import HexDetails from "./HexDetails";
import { publicFeedItems } from "./PublicFeed";
import { playerHints } from "../../../game/rules/player-hints";
import { hexColumnClass, mapCanvasDimensions } from "../../lib/map-geometry";
import { useMapGestures } from "../../lib/use-map-gestures";
import { useRoomAttention } from "../../lib/use-room-attention";
import TurnResolutionSummary from "../TurnResolutionSummary";
import TurnReplayOverlay from "./TurnReplayOverlay";
import FactionStatusOverlay from "./FactionStatusOverlay";
import FactionAcademy from "./FactionAcademy";
import NetworkFirstHorizonGuide from "./NetworkFirstHorizonGuide";
import NetworkAcademyGuide from "./NetworkAcademyGuide";
import NetworkCommsPanel from "./NetworkCommsPanel";
import ShatteredReachPanel from "../ShatteredReachPanel";
import GameplayAudio from "./GameplayAudio";
import { ResourceGlyph } from "./ResourceGlyph";
import { uncommandedUnits, type UncommandedUnit } from "../../../game/rules/uncommanded-units";
import { combatHexesFromReplays } from "../../lib/combat-hexes";
import { movementTargets } from "../../lib/movement-targets";

type Panel =
  | "map"
  | "military"
  | "diplomacy"
  | "communications"
  | "build"
  | "technology"
  | "economy"
  | "resources"
  | "gate"
  | "legacy"
  | "orders"
  | "room"
  | "academy"
  | "more";
type UnitIntent =
  | "move"
  | "publicScan"
  | "longRangeSurvey"
  | "farboundScan"
  | "wayfarerRecon"
  | null;
type MapUnit = {
  kind: "explorer" | "colony" | "civilian";
  id: string;
  hex: string;
  icon: ShipIconType;
};
type Construction = Extract<SecretOrder, { kind: "construct" }>["construction"];
type SelectedHexUnit = {
  key: string;
  owner: number;
  label: string;
  icon: ShipIconType;
  unit?: MapUnit;
  carrierId?: string;
};
type ActivityItem = {
  id: string;
  type: string;
  text: string;
  playerId?: number;
  hexId?: string;
};
const labels: Record<HexKind, string> = {
  material: "MAT",
  currency: "CUR",
  research: "RES",
  influence: "INF",
  labor: "LAB",
  barren: "BAR",
  anomaly: "ANO",
  hazard: "HAZ",
  empty: "",
  home: "HOME",
  rift: "",
};
const panelLabels: Record<Panel, { icon: string; label: string }> = {
  map: { icon: "MAP", label: "Map" },
  military: { icon: "MIL", label: "Military" },
  build: { icon: "BLD", label: "Build" },
  technology: { icon: "TEC", label: "Technology" },
  economy: { icon: "ECO", label: "Economy" },
  resources: { icon: "RES", label: "Resources" },
  gate: { icon: "GAT", label: "Gate" },
  diplomacy: { icon: "DIP", label: "Diplomacy" },
  communications: { icon: "COM", label: "Messages" },
  legacy: { icon: "LEG", label: "Legacy" },
  orders: { icon: "ORD", label: "Orders" },
  room: { icon: "NET", label: "Room" },
  academy: { icon: "ACA", label: "Academy" },
  more: { icon: "•••", label: "More" },
};
const fullScreenPanels: Panel[] = [
  "diplomacy",
  "communications",
  "academy",
];
const rightPanels: Panel[] = ["build", "economy", "technology", "gate", "legacy", "resources"];

const panelCoach: Partial<Record<Panel, string>> = {
  map: "The map is the shared strategic picture. Tap a sector for details, tap a vessel for actions, drag to pan, and pinch to zoom.",
  military: "Military gathers carriers, Combat Units, movement range, and deterministic combat forecasts in one place.",
  diplomacy: "Diplomacy contains trades, agreements, technology exchanges, and proposals awaiting your response.",
  communications: "Messages contains All Chat, direct messages, private groups, attached sectors, and diplomatic proposal history for this match.",
  build: "Build converts controlled Habitats and Labor into Centers, upgrades, vessels, and Combat Units.",
  technology: "Technology advances one of five branches. Research costs and faction abilities can change the available price.",
  economy: "Economy shows reserves, production, Labor, and immediate faction or Market conversions.",
  gate: "Gate Tributes secure shared survival. Contributions and remaining requirements are public.",
  legacy: "Legacy tracks Universal, Civilization, and private Hidden Objectives. Legacy Points determine the winner if the Gate succeeds.",
  orders: "Orders remain private until every civilization seals. Review the cost and legality of the full queue before submitting.",
  room: "Room contains the timer, connection state, seat administration, host notices, and authoritative event history.",
  academy: "Academy explains the capabilities and strategic identity of every faction without interrupting the match.",
};

function uid(kind: string) {
  return `net-${kind}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
}

export default function NetworkGameBoard({
  session,
  connection,
  busy,
  error,
  onCommand,
  onRefresh,
  onLeave,
  onExportReport,
  onRematch,
  spectatorPaused = false,
  pollMs = 1200,
  onToggleSpectator,
  onPollMs,
}: {
  session: RoomSession;
  connection: "connected" | "syncing" | "offline";
  busy: boolean;
  message: string;
  error: string;
  onCommand: (command: RoomCommand) => Promise<void>;
  onRefresh: () => void;
  onLeave: () => void;
  onExportReport?: () => void;
  onRematch?: () => void;
  spectatorPaused?: boolean;
  pollMs?: number;
  onToggleSpectator?: () => void;
  onPollMs?: (milliseconds: number) => void;
}) {
  const game = session.game;
  const spectator =
    session.role === "spectator" || session.playerId === undefined;
  const playerId = session.playerId;
  const player = playerId === undefined ? undefined : game.players[playerId];
  const roomReminders = useRoomAttention(session);
  const [panel, setPanel] = useState<Panel>("map");
  const [dockOpen, setDockOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [diplomacyTargetId, setDiplomacyTargetId] = useState<
    number | undefined
  >();
  const [draft, setDraftRaw] = useState<SecretOrder[]>([]);
  const [draftScopeLoaded, setDraftScopeLoaded] = useState("");
  const [draftNotice, setDraftNotice] = useState("");
  const [hintsOpen, setHintsOpen] = useState(false);
  const [sealChecklistOpen, setSealChecklistOpen] = useState(false);
  const [factionOrderToolsOpen, setFactionOrderToolsOpen] = useState(false);
  const [sealingOrders, setSealingOrders] = useState(false);
  const [sealReviewOpen, setSealReviewOpen] = useState(false);
  const [turnNotice, setTurnNotice] = useState("");
  const [replayOpen, setReplayOpen] = useState(false);
  const [replayTurn, setReplayTurn] = useState<number | undefined>();
  const [factionStatusId, setFactionStatusId] = useState<number | null>(null);
  const [briefDismissedTurn, setBriefDismissedTurn] = useState(0);
  const [localHandoff, setLocalHandoff] = useState(false);
  const [coachPanel, setCoachPanel] = useState<Panel | null>(null);
  const previousLocalPlayer = useRef(playerId);
  const seenTurn = useRef(game.turn);
  useEffect(() => {
    if (seenTurn.current !== game.turn) {
      const previous = seenTurn.current;
      seenTurn.current = game.turn;
      setTurnNotice(`Turn ${previous} processed. Era ${game.era}, Turn ${game.turn} is now open.`);
    }
  }, [game.turn, game.era]);
  useEffect(() => {
    if (session.summary.mode === "local" && previousLocalPlayer.current !== playerId && player?.controller.kind === "human") setLocalHandoff(true);
    previousLocalPlayer.current = playerId;
  }, [player?.controller.kind, playerId, session.summary.mode]);
  const sealedSubmission = player ? game.orderProtocol.submissions.find((entry) => entry.playerId === player.id) : undefined;
  const displayedOrders = sealedSubmission?.orders || draft;
  function setDraft(next: React.SetStateAction<SecretOrder[]>) {
    if (sealedSubmission) {
      setDraftNotice("Unseal your Orders using the bottom bar before changing the queue.");
      return;
    }
    setDraftRaw(next);
  }

  async function unseal() {
    if (!sealedSubmission) return;
    setDraftRaw(structuredClone(sealedSubmission.orders).filter((order) => order.kind !== "hold"));
    await onCommand({ kind: "unsealOrders" });
  }
  async function sealOrders(command: Extract<RoomCommand, { kind: "submitOrders" }>) {
    if (!canDraft || busy || sealingOrders) return;
    setSealingOrders(true);
    try {
      await onCommand(command);
      setSealReviewOpen(false);
      setPanel("map");
      setDockOpen(false);
      setContextOpen(false);
    } finally {
      setSealingOrders(false);
    }
  }
  const [selectedHexId, setSelectedHexId] = useState(
    player?.colonyShips[0]?.hex || player?.colonyShip || game.selected,
  );
  const [mapUnit, setMapUnit] = useState<MapUnit | null>(null);
  const [selectedReachAssetId, setSelectedReachAssetId] = useState<string | null>(null);
  const [migrationMobileId, setMigrationMobileId] = useState<string | null>(null);
  const [unitIntent, setUnitIntent] = useState<UnitIntent>(null);
  const [taskForceIds, setTaskForceIds] = useState<string[]>([]);
  const [militaryTargeting, setMilitaryTargeting] = useState(false);
  const [bombardCarrierId, setBombardCarrierId] = useState<string | null>(null);
  const [bombardStrength, setBombardStrength] = useState<1 | 2>(1);
  const [buildTargeting, setBuildTargeting] = useState(false);
  const [buildHexId, setBuildHexId] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(0.72);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const lobbyOverlayRef = useRef<HTMLDivElement>(null);
  const initialMapFocus = useRef("");
  const mapGestures = useMapGestures({ viewportRef: mapViewportRef, zoom: mapZoom, setZoom: setMapZoom, minZoom: 0.2 });
  const canDraft =
    !!player &&
    !game.result &&
    ["negotiation", "orders"].includes(game.orderProtocol.phase) &&
    !game.orderProtocol.submissions.some(
      (submission) => submission.playerId === player.id,
    );
  const map = mapLibrary[game.mapId];
  const mapCanvas = mapCanvasDimensions(map.columns, map.rows);
  const tileAssets = { ...baseTileAssets, ...map.tileAssets };
  const draftScope =
    playerId === undefined
      ? ""
      : `horizon:network-draft:${session.code}:${playerId}:${game.turn}`;

  const tutorialLessonId = game.tutorial
    ? firstHorizonLessons[game.tutorial.step]?.id
    : undefined;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- a new private Turn scope must restore its own draft */
    let restored: SecretOrder[] = [];
    if (draftScope)
      try {
        restored = session.privateDraft?.length ? structuredClone(session.privateDraft) : JSON.parse(localStorage.getItem(draftScope) || "[]") as SecretOrder[];
      } catch {
        restored = [];
      }
    setDraftRaw(restored);
    setDraftScopeLoaded(draftScope);
    setMapUnit(null);
    setSelectedReachAssetId(null);
    setMigrationMobileId(null);
    setTaskForceIds([]);
    setMilitaryTargeting(false);
    setBombardCarrierId(null);
    setBombardStrength(1);
    setUnitIntent(null);
    setBuildTargeting(false);
    setBuildHexId(null);
    setDraftNotice(
      restored.length ? "Your unsealed private Orders were restored." : "",
    );
    setSealChecklistOpen(false);
    setFactionOrderToolsOpen(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- restore only when the private seat/Turn scope changes
  }, [draftScope]);

  useEffect(() => {
    if (draftScope && draftScopeLoaded === draftScope)
      localStorage.setItem(draftScope, JSON.stringify(draft));
  }, [draft, draftScope, draftScopeLoaded]);

  useLayoutEffect(() => {
    if (!["lobby", "paused"].includes(session.summary.status)) return;
    const overlay = lobbyOverlayRef.current;
    if (!overlay) return;

    const resetLobbyScroll = () => {
      overlay.scrollTop = 0;
      overlay.scrollLeft = 0;
      window.scrollTo(0, 0);
    };

    // Reset before paint, then once more after browser focus and scroll
    // restoration have settled. This keeps a newly opened lobby at its header
    // on desktop, installed-app, and mobile browser layouts.
    resetLobbyScroll();
    const frame = window.requestAnimationFrame(resetLobbyScroll);
    const timer = window.setTimeout(resetLobbyScroll, 100);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [session.code, session.summary.status]);

  useEffect(() => {
    if (session.summary.status !== "active" || panel !== "map") return;
    const key = `${game.mapId}:${playerId ?? "spectator"}`;
    if (initialMapFocus.current === key) return;
    const timer = window.setTimeout(() => {
      const viewport = mapViewportRef.current;
      if (!viewport) return;
      initialMapFocus.current = key;
      const fit = fittedMapZoom(viewport);
      setMapZoom(fit);
      const home = playerId === undefined
        ? undefined
        : game.hexes.find((hex) => hex.kind === "home" && hex.originalOwner === playerId)?.id;
      window.requestAnimationFrame(() => {
        if (home) viewport.querySelector<HTMLElement>(`[data-hex-id="${home}"]`)?.scrollIntoView({ block: "center", inline: "center" });
        else centerMap(fit);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initial fitting intentionally runs once per map and private seat
  }, [game.mapId, panel, playerId, session.summary.status]);

  useEffect(() => {
    if (game.scenarioId !== "first-horizon" || tutorialLessonId !== "legacy") return;
    const timer = window.setTimeout(() => {
      setPanel("legacy");
      setDockOpen(false);
      setRightDrawerOpen(true);
      if (!game.tutorial?.seenPanels?.includes("legacy")) setCoachPanel("legacy");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [game.scenarioId, game.tutorial?.seenPanels, tutorialLessonId]);

  useEffect(() => {
    if (!canDraft || sealedSubmission || draftScopeLoaded !== draftScope) return;
    if (JSON.stringify(session.privateDraft || []) === JSON.stringify(draft)) return;
    const timer = window.setTimeout(() => void onCommand({ kind: "saveDraft", orders: draft }), 850);
    return () => window.clearTimeout(timer);
  }, [canDraft, draft, draftScope, draftScopeLoaded, onCommand, sealedSubmission, session.privateDraft]);

  const viewGame = useMemo(() => {
    const view = structuredClone(game);
    if (playerId !== undefined) view.active = playerId;
    view.selected = selectedHexId;
    return view;
  }, [game, playerId, selectedHexId]);

  const selectedFleet = game.carriers.filter((carrier) =>
    taskForceIds.includes(carrier.id) && carrier.owner === playerId,
  );
  // Room updates can remove a selected vessel while this component is mounted.
  const completeFleetSelection = taskForceIds.length > 0 && selectedFleet.length === taskForceIds.length;
  const readyFleet = completeFleetSelection && selectedFleet.every((carrier) =>
    carrier.hex === selectedFleet[0].hex && carrier.readyTurn <= game.turn && carrier.cu > 0);
  const militaryOrigin = readyFleet ? selectedFleet[0].hex : undefined;
  const militaryMovement = readyFleet
    ? Math.min(...selectedFleet.map((carrier) => carrier.movesRemaining))
    : 0;
  const militaryPaths = militaryTargeting && militaryOrigin && playerId !== undefined
    ? movementTargets(game, playerId, militaryOrigin, militaryMovement, "military",
        selectedFleet.some((carrier) => carrier.portalUsedTurn === game.turn))
    : new Map<string, string[]>();
  const militaryTargets = [...militaryPaths.keys()];
  const selectedExplorer =
    mapUnit?.kind === "explorer"
      ? player?.explorationVessels.find((unit) => unit.id === mapUnit.id) ||
        (mapUnit.id === "explorer" ? player?.explorationVessels[0] : undefined)
      : undefined;
  const selectedColony =
    mapUnit?.kind === "colony"
      ? player?.colonyShips.find((unit) => unit.id === mapUnit.id)
      : undefined;
  const selectedCivilianForMove = mapUnit?.kind === "civilian"
    ? game.civilianUnits.find((unit) => unit.id === mapUnit.id && unit.owner === playerId)
    : undefined;
  const draftedScanHexIds = selectedExplorer
    ? draft.find(
        (order): order is Extract<SecretOrder, { kind: "explorerScan" }> =>
          order.kind === "explorerScan" &&
          (order.vesselId || player?.explorationVessels[0]?.id) ===
            selectedExplorer.id,
      )?.hexIds || []
    : [];
  const unitRange = mapUnit?.kind === "explorer"
    ? selectedExplorer?.movesRemaining ?? 0
    : mapUnit?.kind === "colony"
      ? selectedColony?.movesRemaining ?? 0
      : mapUnit?.kind === "civilian"
        ? game.civilianUnits.find((unit) => unit.id === mapUnit.id)?.movesRemaining ?? 0
        : 0;
  const unitOrigin = mapUnit?.kind === "explorer" ? selectedExplorer?.hex
    : mapUnit?.kind === "colony" ? selectedColony?.hex : selectedCivilianForMove?.hex;
  const unitMovePaths = unitIntent === "move" && mapUnit && unitOrigin && playerId !== undefined
    ? movementTargets(game, playerId, unitOrigin, unitRange, mapUnit.kind,
        mapUnit.kind === "explorer" ? selectedExplorer?.portalUsedTurn === game.turn
          : mapUnit.kind === "colony" ? selectedColony?.portalUsedTurn === game.turn : false)
    : new Map<string, string[]>();
  const unitTargets =
    unitIntent && mapUnit
      ? (unitIntent === "move" ? [...unitMovePaths.keys()]
          : unitIntent === "longRangeSurvey"
          ? game.hexes.map((hex) => hex.id)
          : unitIntent === "farboundScan" || unitIntent === "wayfarerRecon" || unitIntent === "publicScan"
            ? getNeighbors(mapUnit.hex, map)
            : []
        ).filter((id) => {
          const hex = game.hexes.find((candidate) => candidate.id === id);
          if (!hex || hex.kind === "rift") return false;
          if (unitIntent === "longRangeSurvey" || unitIntent === "farboundScan" || unitIntent === "wayfarerRecon")
            return (
              !hex.revealed &&
              !player?.privateSurveys.some((survey) => survey.hexId === id)
            );
          if (unitIntent === "publicScan")
            return !hex.revealed && !draftedScanHexIds.includes(id);
          if (unitIntent === "move" && selectedCivilianForMove?.type === "envoy" &&
            hex.owner !== undefined && hex.owner !== playerId &&
            playerId !== undefined && !hasStationingPermission(game, hex.owner, playerId, "envoy")) return false;
          return unitIntent === "move" || hex.revealed;
        })
      : [];
  const buildTargets =
    buildTargeting && player
      ? game.hexes
          .filter(
            (hex) =>
              hex.owner === player.id &&
              hex.tier,
          )
          .map((hex) => hex.id)
      : [];
  const bombardCarrier = game.carriers.find((carrier) => carrier.id === bombardCarrierId);
  const bombardMove = draft.find((order): order is Extract<SecretOrder, { kind: "carrierMove" }> => order.kind === "carrierMove" && order.carrierIds.includes(bombardCarrierId || ""));
  const bombardTargets = bombardCarrierId && playerId !== undefined
    ? legalBombardmentTargets(game, playerId, bombardCarrierId, undefined, bombardMove?.destination)
    : [];
  const migrationMobile = game.mobileHabitats.find((mobile) => mobile.id === migrationMobileId && mobile.owner === playerId);
  const migrationTargets = migrationMobile
    ? getNeighbors(migrationMobile.hex, map).filter((id) => {
        const target = game.hexes.find((hex) => hex.id === id);
        return !!target?.revealed && target.kind !== "rift";
      })
    : [];
  const activeTargets = migrationMobileId ? migrationTargets
    : bombardCarrierId ? bombardTargets.map((target) => target.hexId)
    : militaryTargeting ? militaryTargets
    : unitIntent ? unitTargets : buildTargets;

  const planningRoute = militaryTargeting || unitIntent === "move";

  function draftMovement(destination: string) {
    if (!canDraft) return;
    if (militaryTargeting) {
      const path = militaryPaths.get(destination);
      if (!path || playerId === undefined) return;
      const selected = [...taskForceIds];
      setDraft((current) => [
        ...current.filter((order) =>
          (order.kind !== "carrierMove" || !order.carrierIds.some((carrierId) => selected.includes(carrierId))) &&
          (order.kind !== "bombard" || !selected.includes(order.carrierId) ||
            legalBombardmentTargets(game, playerId, order.carrierId, undefined, destination).some((target) => target.hexId === order.targetHexId))),
        { id: uid("fleet"), kind: "carrierMove", carrierIds: selected, destination, path },
      ]);
      setMilitaryTargeting(false);
    } else if (unitIntent === "move" && mapUnit) {
      const path = unitMovePaths.get(destination);
      if (!path) return;
      const order: SecretOrder = mapUnit.kind === "explorer"
        ? { id: uid("explorer"), kind: "explorerMove", vesselId: selectedExplorer?.id || mapUnit.id, destination, path }
        : mapUnit.kind === "colony"
          ? { id: uid("colony"), kind: "colonyMove", vesselId: mapUnit.id, destination, path }
          : { id: uid("civilian"), kind: "civilianMove", unitId: mapUnit.id, destination };
      setDraft((current) => {
        const keepFarboundScan = mapUnit.kind === "explorer" && player?.faction === "farbound";
        const cleaned = keepFarboundScan
          ? current.filter((candidate) => !((candidate.kind === "explorerMove" || candidate.kind === "explorerScan") && (candidate.vesselId || player?.explorationVessels[0]?.id) === mapUnit.id))
          : removeUnitOrders(current, mapUnit);
        return [...cleaned, order];
      });
      setUnitIntent(null);
    }
    setContextOpen(false);
    setPanel("map");
  }

  function openBuildAt(hexId: string) {
    setSelectedHexId(hexId);
    setBuildHexId(hexId);
    setBuildTargeting(false);
    setMapUnit(null);
    setSelectedReachAssetId(null);
    setTaskForceIds([]);
    setContextOpen(false);
    setPanel("build");
    setDockOpen(false);
    setRightDrawerOpen(true);
  }

  function clickHex(id: string) {
    setSelectedHexId(id);
    if (!migrationMobileId) setSelectedReachAssetId(null);
    if (game.scenarioId === "first-horizon" && tutorialLessonId === "inspect") {
      const home = game.hexes.find((hex) => hex.kind === "home" && hex.originalOwner === playerId)?.id;
      if (id !== home) void onCommand({ kind: "tutorialEvent", event: "hex-inspected", value: id });
    }
    if (bombardCarrierId) {
      const target = bombardTargets.find((candidate) => candidate.hexId === id);
      if (target) {
        setDraft((current) => [
          ...current.filter((order) => order.kind !== "bombard" || order.carrierId !== bombardCarrierId),
          { id: uid("bombard"), kind: "bombard", carrierId: bombardCarrierId, targetHexId: id, targetPlayerId: target.targetPlayerId, strength: bombardStrength },
        ]);
        setDraftNotice(`Bombardment ${bombardStrength} aimed at ${id}. It resolves after fleet movement; hostile CUs in that hex at that time can be hit.`);
        setBombardCarrierId(null);
        setPanel("orders");
        setDockOpen(true);
        return;
      }
    }
    if (migrationMobile && migrationTargets.includes(id)) {
      setDraft((current) => [
        ...current.filter((order) => order.kind !== "migration" || order.mobileHabitatId !== migrationMobile.id),
        { id: uid("migration"), kind: "migration", mobileHabitatId: migrationMobile.id, destination: id },
      ]);
      setDraftNotice(`${mobileHabitatLibrary[migrationMobile.type].name} migration to ${id} added to Orders.`);
      setMigrationMobileId(null);
      setSelectedReachAssetId(migrationMobile.id);
      setContextOpen(false);
      setPanel("orders");
      setDockOpen(true);
      return;
    }
    if (militaryTargeting) {
      if (militaryPaths.has(id)) draftMovement(id);
      return;
    }
    if (unitIntent && mapUnit && unitTargets.includes(id)) {
      if (unitIntent === "farboundScan") {
        setDraft((current) => [
          ...current.filter((order) => !(order.kind === "farboundForwardScan" && (order.vesselId || player?.explorationVessels[0]?.id) === mapUnit.id)),
          {
            id: uid("forward-scan"),
            kind: "farboundForwardScan",
            vesselId: mapUnit.id,
            hexId: id,
          },
        ]);
        setDraftNotice(`Private Forward Scan of ${id} added to Orders.`);
        setUnitIntent(null);
        setContextOpen(false);
        return;
      }
      if (unitIntent === "wayfarerRecon") {
        setDraft((current) => [
          ...removeUnitOrders(current, mapUnit),
          { id: uid("deep-recon"), kind: "wayfarerDeepRecon", vesselId: mapUnit.id, hexId: id },
        ]);
        setDraftNotice(`Private Deep Recon of ${id} added to Orders.`);
        setUnitIntent(null);
        setContextOpen(false);
        return;
      }
      if (unitIntent === "publicScan" && selectedExplorer) {
        const limit = player?.tech.Exploration || 1;
        const hexIds = [...new Set([...draftedScanHexIds, id])].slice(0, limit);
        setDraft((current) => [
          ...current.filter((order) => !((order.kind === "explorerMove" || order.kind === "explorerScan") && (order.vesselId || player?.explorationVessels[0]?.id) === mapUnit.id)),
          {
            id: uid("scan"),
            kind: "explorerScan",
            vesselId: selectedExplorer.id,
            hexIds,
          },
        ]);
        if (hexIds.length < limit) {
          setDraftNotice(
            `${id} selected. Choose ${limit - hexIds.length} more adjacent sector for this Pathfinder scan, or cancel to keep the current selection.`,
          );
        } else {
          setDraftNotice(`${hexIds.length} public scans added to Orders.`);
          setUnitIntent(null);
          setPanel("orders");
        }
        return;
      }
      if (unitIntent === "move") {
        draftMovement(id);
        return;
      }
      setDraft((current) => [...removeUnitOrders(current, mapUnit),
        { id: uid("survey"), kind: "longRangeSurvey", unitId: mapUnit.id, hexId: id }]);
      setDraftNotice(`Long-Range Survey of ${id} added to Orders.`);
      setUnitIntent(null);
      setPanel("orders");
      return;
    }
    if (buildTargeting && buildTargets.includes(id)) {
      openBuildAt(id);
      return;
    }
    if (!militaryTargeting && !unitIntent && !buildTargeting) {
      const hex = game.hexes.find((candidate) => candidate.id === id);
      if (player && hex?.owner === player.id && hex.tier) {
        openBuildAt(id);
        return;
      }
      setMapUnit(null);
      setContextOpen(true);
      setPanel("map");
      setDockOpen(false);
    }
  }

  function selectMapUnit(unit: MapUnit) {
    setMapUnit(unit);
    setBombardCarrierId(null);
    setSelectedReachAssetId(null);
    setSelectedHexId(unit.hex);
    setPanel("map");
    setContextOpen(true);
    setDockOpen(false);
    setUnitIntent(null);
  }
  function notify(text: string) {
    setDraftNotice(text);
  }
  function removeUnitOrders(current: SecretOrder[], unit: MapUnit) {
    return current.filter((order) =>
      unit.kind === "explorer"
        ? !(
            (order.kind === "explorerMove" ||
              order.kind === "explorerScan" ||
              order.kind === "farboundForwardScan") &&
            (order.vesselId || player?.explorationVessels[0]?.id) === unit.id
          )
        : unit.kind === "colony"
          ? !(
              (order.kind === "colonyMove" || order.kind === "establish") &&
              (order.vesselId || player?.colonyShips[0]?.id) === unit.id
            )
          : !(
              (order.kind === "civilianMove" ||
                order.kind === "prospect" ||
                order.kind === "longRangeSurvey") &&
              order.unitId === unit.id
            ),
    );
  }
  const budget = player
    ? projectedOrderBudget(viewGame, player.id, displayedOrders)
    : undefined;
  const budgetResources = (["material", "currency", "research", "influence"] as const);
  const displayedCosts = player ? individualOrderCosts(viewGame, player.id, displayedOrders) : [];
  const draftCosts = player && !sealedSubmission ? displayedCosts : player ? individualOrderCosts(viewGame, player.id, draft) : [];
  const combatHexes = combatHexesFromReplays(game.turnReplays);
  const idleUnits = player ? uncommandedUnits(viewGame, player.id, displayedOrders) : [];
  function focusUncommanded(unit: UncommandedUnit) {
    if (!player) return;
    setUnitIntent(null);
    setMilitaryTargeting(false);
    setPanel("map");
    setDockOpen(false);
    setSelectedHexId(unit.hex);
    setContextOpen(true);
    setSelectedReachAssetId(unit.kind === "mobile" ? unit.id : null);
    if (unit.kind === "carrier") {
      setMapUnit(null);
      setTaskForceIds([unit.id]);
    } else if (unit.kind !== "mobile") {
      setTaskForceIds([]);
      const icon = unit.kind === "explorer" ? player.explorationVessels.find((item) => item.id === unit.id)?.type || "exploration" : unit.kind === "colony" ? "colony" : game.civilianUnits.find((item) => item.id === unit.id)?.type || "prospector";
      setMapUnit({ kind: unit.kind, id: unit.id, hex: unit.hex, icon } as MapUnit);
    } else { setMapUnit(null); setTaskForceIds([]); }
    requestAnimationFrame(() => mapViewportRef.current?.querySelector<HTMLElement>(`[data-hex-id="${unit.hex}"]`)?.scrollIntoView({ block: "center", inline: "center" }));
  }
  const hidden = player?.hiddenLegacy[game.era];
  const pendingProposals =
    playerId === undefined
      ? 0
      : game.proposals.filter(
          (proposal) =>
            proposal.status === "pending" &&
            (proposal.kind === "technology"
              ? proposal.buyer === playerId
              : proposal.to === playerId),
        ).length;
  const incomingProposals =
    playerId === undefined
      ? []
      : game.proposals.filter(
          (proposal) =>
            proposal.status === "pending" &&
            (proposal.kind === "technology"
              ? proposal.buyer === playerId
              : proposal.to === playerId),
        );
  const selectedHex =
    game.hexes.find((hex) => hex.id === selectedHexId) || game.hexes[0];
  const pendingCapture = game.pendingCenterLoss;
  const pendingRedistribution = game.pendingCombatRedistributions.find(
    (pending) => pending.playerId === playerId,
  );
  const captureHexId = pendingCapture?.hexId;
  const captureCount = pendingCapture?.removeCount || 0;
  const captureOwner = pendingCapture?.playerId;
  const hasMandatoryCombatCleanup =
    captureOwner === playerId || Boolean(pendingRedistribution);
  const hiddenRequired =
    !!player &&
    (game.turn - 1) % 4 === 0 &&
    !hidden?.selected &&
    !hasMandatoryCombatCleanup;
  const policyVoteRequired = !!player && !!hidden?.selected && !hasMandatoryCombatCleanup &&
    (game.turn - 1) % 4 === 0 && !!game.policyElection?.choices.length &&
    game.policyElection.era === game.era && !game.policyElection.votingClosed &&
    !game.policyElection.votes.some((vote) => vote.playerId === player.id) &&
    !game.orderProtocol.submissions.some((submission) => submission.playerId === player.id);
  const capturedCenters = captureHexId
    ? game.hexes.find((hex) => hex.id === captureHexId)?.centers || []
    : [];

  useEffect(() => {
    if (!pendingRedistribution) return;
    const timer = window.setTimeout(() => {
      setPanel("military");
      setDockOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pendingRedistribution]);
  const selectedCivilian =
    mapUnit?.kind === "civilian"
      ? game.civilianUnits.find((unit) => unit.id === mapUnit.id)
      : undefined;
  const selectedCarrier =
    !mapUnit && taskForceIds.length === 1
      ? game.carriers.find(
          (carrier) =>
            carrier.id === taskForceIds[0] && carrier.hex === selectedHex.id,
        )
      : undefined;
  const selectedMobileHabitat = selectedReachAssetId
    ? game.mobileHabitats.find((mobile) => mobile.id === selectedReachAssetId)
    : undefined;
  const selectedBlockade = selectedReachAssetId
    ? game.blockades.find((blockade) => blockade.id === selectedReachAssetId && blockade.active)
    : undefined;
  const selectedCarrierMoveDrafted = !!selectedCarrier && draft.some((order) => order.kind === "carrierMove" && order.carrierIds.includes(selectedCarrier.id));
  const selectedCarrierBombardDrafted = !!selectedCarrier && draft.some((order) => order.kind === "bombard" && order.carrierId === selectedCarrier.id);
  const selectedCarrierBombardTwo = !!selectedCarrier && draft.some((order) => order.kind === "bombard" && order.carrierId === selectedCarrier.id && order.strength === 2);
  const selectedCarrierCargoDrafted = !!selectedCarrier && draft.some((order) => order.kind === "blockadeCargo" && order.carrierId === selectedCarrier.id);
  const selectedCarrierDeployDrafted = !!selectedCarrier && draft.some((order) => order.kind === "blockadeCargo" && order.carrierId === selectedCarrier.id && order.action === "deploy");
  const selectedCarrierLoadedBlockades = selectedCarrier ? loadedBlockades(game, selectedCarrier.id) : [];
  const selectedCarrierLoadableBlockades = selectedCarrier ? game.blockades.filter((blockade) =>
    blockade.owner === player?.id &&
    blockade.active &&
    !blockade.carrierId &&
    blockade.hex === selectedCarrier.hex &&
    blockade.readyTurn <= game.turn &&
    !draft.some((order) => order.kind === "blockadeCargo" && order.blockadeId === blockade.id)
  ) : [];
  const selectedCarrierProjectedCargo = selectedCarrier
    ? selectedCarrierLoadedBlockades.length
      + draft.filter((order) => order.kind === "blockadeCargo" && order.carrierId === selectedCarrier.id && order.action === "load").length
      - draft.filter((order) => order.kind === "blockadeCargo" && order.carrierId === selectedCarrier.id && order.action === "deploy").length
    : 0;
  const selectedUnitName = selectedCivilian
    ? civilianLibrary[selectedCivilian.type].name
    : mapUnit?.kind === "colony"
      ? "Colony Ship"
      : selectedExplorer
        ? explorationLibrary[selectedExplorer.type].name
        : "Vessel";
  const establishHex =
    mapUnit?.kind === "colony"
      ? game.hexes.find((hex) => hex.id === selectedColony?.hex)
      : undefined;
  const selectedColonyEstablishDrafted = !!selectedColony && draft.some(
    (order) => order.kind === "establish" && order.vesselId === selectedColony.id,
  );
  const projectedHabitatModules = (player?.modules || 0) + draft.filter(
    (order) => order.kind === "construct" && order.construction.type === "module",
  ).length;
  const reservedHabitatModules = draft.filter((order) => order.kind === "establish").length - (selectedColonyEstablishDrafted ? 1 : 0);
  const establishReason = !selectedColony || selectedColony.readyTurn > game.turn
    ? "This Colony Ship is not ready until next Turn."
    : projectedHabitatModules <= reservedHabitatModules
    ? `Construct another Habitat Module or remove another Establish Order. ${projectedHabitatModules} Module${projectedHabitatModules === 1 ? " is" : "s are"} available for ${reservedHabitatModules + 1} planned settlements.`
    : !establishHex?.revealed
      ? "The Colony Ship must occupy a revealed world."
      : establishHex.owner !== undefined
        ? "This world is already controlled."
        : ["rift", "hazard", "anomaly", "empty"].includes(establishHex.kind)
          ? "Habitats cannot be established in this sector."
          : "";
  const canMoveSelected =
    mapUnit?.kind === "explorer"
      ? !!selectedExplorer &&
        selectedExplorer.readyTurn <= game.turn &&
        selectedExplorer.movesRemaining > 0
      : mapUnit?.kind === "colony"
        ? !!selectedColony && selectedColony.readyTurn <= game.turn && selectedColony.movesRemaining > 0
        : !!selectedCivilian &&
          selectedCivilian.readyTurn <= game.turn &&
          selectedCivilian.movesRemaining > 0;
  const prospectHex =
    selectedCivilian?.type === "prospector"
      ? game.hexes.find((hex) => hex.id === selectedCivilian.hex)
      : undefined;
  const prospectReason =
    selectedCivilian?.usedTurn === game.turn
      ? "This Prospector already acted this Turn."
      : selectedCivilian &&
          selectedCivilian.movesRemaining < civilianLibrary.prospector.move
        ? "Prospecting replaces all movement for this vessel."
        : !prospectHex?.revealed ||
            prospectHex.owner !== undefined ||
            prospectHex.prospected ||
            ![
              "material",
              "currency",
              "research",
              "influence",
              "labor",
              "barren",
            ].includes(prospectHex.kind)
          ? "Prospect requires a revealed, unclaimed, unprospected world."
          : "";
  const controlledHabitats = player
    ? game.hexes.filter((hex) => hex.owner === player.id && hex.tier)
    : [];
  const selectedHexUnits: SelectedHexUnit[] = [
    ...game.players.flatMap((owner) =>
      (owner.explorationVessels || [])
        .filter((unit) => unit.hex === selectedHex.id)
        .map((unit) => ({
          key: unit.id,
          owner: owner.id,
          label: explorationLibrary[unit.type].name,
          icon: explorationIcon(explorationLibrary[unit.type].tech),
          unit: {
            kind: "explorer",
            id: unit.id,
            hex: selectedHex.id,
            icon: explorationIcon(explorationLibrary[unit.type].tech),
          } as MapUnit,
        })),
    ),
    ...game.players.flatMap((owner) => owner.colonyShips
      .filter((vessel) => vessel.hex === selectedHex.id)
      .map((vessel) => ({
        key: vessel.id,
        owner: owner.id,
        label: "Colony Ship",
        icon: "colonyShip" as ShipIconType,
        unit: {
          kind: "colony",
          id: vessel.id,
          hex: selectedHex.id,
          icon: "colonyShip",
        } as MapUnit,
      }))),
    ...game.civilianUnits
      .filter((unit) => unit.hex === selectedHex.id)
      .map((unit) => ({
        key: unit.id,
        owner: unit.owner,
        label: civilianLibrary[unit.type].name,
        icon: unit.type as ShipIconType,
        unit: {
          kind: "civilian",
          id: unit.id,
          hex: selectedHex.id,
          icon: unit.type,
        } as MapUnit,
      })),
    ...game.carriers
      .filter((carrier) => carrier.hex === selectedHex.id)
      .map((carrier) => ({
        key: carrier.id,
        owner: carrier.owner,
        label: carrierLibrary[carrier.type].name,
        icon: carrier.type as ShipIconType,
        carrierId: carrier.id,
      })),
  ];
  const notifications: ActivityItem[] = [
    ...session.attention.map((item) => ({ id: `attention-${item.id}`, type: item.kind, text: `${item.title}: ${item.detail}` })),
    ...incomingProposals.map((proposal) => ({
      id: proposal.id,
      type: "proposal",
      text: `${game.players[proposal.kind === "technology" ? proposal.seller : proposal.from].name} sent a ${proposal.kind} proposal.`,
      playerId:
        proposal.kind === "technology" ? proposal.seller : proposal.from,
    })),
    ...publicFeedItems(game).slice(0, 8).map((entry) => ({ ...entry, type: "public-feed" })),
    ...session.summary.recentEvents
      .slice(-8)
      .reverse()
      .map((event) => ({
        id: event.id,
        type: event.type,
        text: event.message,
        hexId: event.message.match(/\b\d+-\d+\b/)?.[0],
      })),
  ];
  const hasDraftedGate =
    draft.some((order) => order.kind === "tribute") ||
    (player?.eraTributes[game.era - 1] || 0) > 0;

  function draftMobileConstruction(construction: Extract<Construction, { type: "mobileCenter" | "caravanGuard" }>) {
    if (!player || !selectedMobileHabitat || selectedMobileHabitat.owner !== player.id) return;
    const quote = constructionQuote(viewGame, player.id, selectedMobileHabitat.hex, construction);
    const order: SecretOrder = { id: uid("mobile-build"), kind: "construct", habitatId: selectedMobileHabitat.hex, construction };
    const next = [
      ...draft.filter((candidate) => !(candidate.kind === "construct" && (candidate.construction.type === "mobileCenter" || candidate.construction.type === "caravanGuard") && candidate.construction.mobileHabitatId === selectedMobileHabitat.id)),
      order,
    ];
    const projected = projectedOrderBudget(viewGame, player.id, next);
    if (!quote.available || projected.error) return notify(projected.error || quote.reason || "That mobile construction is unavailable.");
    setDraft(next);
    notify(`${quote.label} drafted aboard ${mobileHabitatLibrary[selectedMobileHabitat.type].name}.`);
  }

  function focusHex(hexId: string) {
    setPanel("map");
    setSelectedHexId(hexId);
    setMapUnit(null);
    setSelectedReachAssetId(null);
    setContextOpen(true);
    setDockOpen(false);
    setNotificationsOpen(false);
    window.setTimeout(
      () =>
        document
          .querySelector(`[data-hex-id="${hexId}"]`)
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
          }),
      0,
    );
  }

  function openDiplomacy(targetId?: number) {
    setDiplomacyTargetId(targetId);
    setPanel("diplomacy");
    setDockOpen(true);
    setNotificationsOpen(false);
  }

  function unitDraftIndex(unit: MapUnit) {
    return draft.findIndex((order) =>
      unit.kind === "explorer"
        ? (order.kind === "explorerMove" ||
            order.kind === "explorerScan" ||
            order.kind === "farboundForwardScan") &&
          (order.vesselId || player?.explorationVessels[0]?.id) === unit.id
        : unit.kind === "colony"
          ? (order.kind === "colonyMove" || order.kind === "establish") &&
            (order.vesselId || player?.colonyShips[0]?.id) === unit.id
          : (order.kind === "civilianMove" ||
              order.kind === "prospect" ||
              order.kind === "longRangeSurvey") &&
            order.unitId === unit.id,
    );
  }

  function carrierDraftIndex(carrierId: string) {
    return draft.findIndex(
      (order) =>
        order.kind === "carrierMove" && order.carrierIds.includes(carrierId),
    );
  }

  function hexDraftIndices(hexId: string) {
    return draft
      .map((order, index) => ({ order, index }))
      .filter(
        ({ order }) =>
          (order.kind === "construct" && order.habitatId === hexId) ||
          (order.kind === "establish" && order.hexId === hexId) ||
          (order.kind === "longRangeSurvey" && order.hexId === hexId) ||
          ((order.kind === "explorerMove" ||
            order.kind === "colonyMove" ||
            order.kind === "civilianMove" ||
            order.kind === "carrierMove") &&
            order.destination === hexId),
      )
      .map(({ index }) => index);
  }

  function draftEstablish() {
    if (!mapUnit || mapUnit.kind !== "colony" || establishReason)
      return notify(establishReason || "Select your Colony Ship.");
    setDraft((current) => [
      ...removeUnitOrders(current, mapUnit),
      { id: uid("establish"), kind: "establish", vesselId: mapUnit.id, hexId: selectedColony!.hex },
    ]);
    notify(`Establish Habitat at ${mapUnit.hex} added to Orders.`);
    setPanel("orders");
  }

  function draftProspect() {
    if (!mapUnit || !selectedCivilian) return;
    setDraft((current) => [
      ...removeUnitOrders(current, mapUnit),
      { id: uid("prospect"), kind: "prospect", unitId: mapUnit.id },
    ]);
    notify(`Prospect at ${mapUnit.hex} added to Orders.`);
    setPanel("orders");
  }

  function centerMap(zoom = mapZoom) {
    const viewport = mapViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      left: Math.max(0, (mapCanvas.width * zoom - viewport.clientWidth) / 2),
      top: Math.max(0, (mapCanvas.height * zoom - viewport.clientHeight) / 2),
      behavior: "smooth",
    });
  }

  function fittedMapZoom(viewport: HTMLDivElement) {
    const style = window.getComputedStyle(viewport);
    const width = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 28;
    const height = viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 28;
    return Math.max(0.2, Math.min(0.9, width / mapCanvas.width, height / mapCanvas.height));
  }

  function fitMap() {
    const viewport = mapViewportRef.current;
    if (!viewport) return;
    const fit = fittedMapZoom(viewport);
    setMapZoom(fit);
    window.requestAnimationFrame(() => centerMap(fit));
  }

  function selectPanel(next: Panel) {
    if (rightPanels.includes(next)) {
      setRightDrawerOpen(true);
      setDockOpen(false);
      setContextOpen(false);
    } else {
      setRightDrawerOpen(false);
      if (!fullScreenPanels.includes(next)) setDockOpen(true);
    }
    setPanel(next);
    if (next === "build") {
      setBuildTargeting(true);
      setBuildHexId(null);
    }
    if (game.scenarioId === "first-horizon" && game.tutorial && panelCoach[next] && !game.tutorial.seenPanels?.includes(next))
      setCoachPanel(next);
    if (game.scenarioId === "faction-academy" && game.academy && !game.academy.freePractice && !game.academy.stageEvents?.includes(`panel:${next}`))
      void onCommand({ kind: "academyEvent", event: "panel-opened", value: next });
  }

  function openActivity(item: ActivityItem) {
    if (item.type === "proposal") openDiplomacy(item.playerId);
    else if (item.type === "message" || item.type === "public-feed") selectPanel("communications");
    else if (item.type === "hidden") selectPanel("legacy");
    else if (item.type === "orders") selectPanel("orders");
    else if (item.type === "capture" || item.type === "redistribution") selectPanel("military");
    else if (item.type === "ready") selectPanel("room");
    else if (item.hexId) focusHex(item.hexId);
    else setNotificationsOpen(false);
  }

  const latestBrief = player ? game.resolutionBriefs?.find((brief) => brief.playerId === player.id && brief.turn > briefDismissedTurn) : undefined;
  const openReplay = (turn?: number) => { setReplayTurn(turn); setReplayOpen(true); setPanel("map"); setDockOpen(false); };

  return (
    <main
      className={`game-shell network-alpha${contextOpen ? " context-visible" : ""}`}
      data-theme={game.themeId}
      data-spectator={spectator}
      data-dock={dockOpen ? "open" : "closed"}
      data-room-status={session.summary.status}
      data-map-columns={map.columns}
      data-map-rows={map.rows}
      style={{
        "--player": player?.color || "#50dcff",
        "--map-columns": map.columns,
        "--map-rows": map.rows,
      } as React.CSSProperties}
    >
      {session.summary.status === "active" && <GameplayAudio />}
      <header className="topbar network-topbar">
        <img src="/horizon-logo.png" alt="Horizon" />
        <div className="turn-id">
          <span>{session.summary.name} · {session.code}</span>
          <strong>
            ERA {game.era} · TURN {game.turn} / {totalTurns(game)}
          </strong>
        </div>
        <div className="gate-mini">
          <div>
            <span>HORIZON GATE</span>
            <strong>
              {game.gate} / {gateTarget(game)}
            </strong>
          </div>
          <div className="gate-track">
            <i
              style={{
                width: `${Math.min(100, (game.gate / gateTarget(game)) * 100)}%`,
              }}
            />
          </div>
        </div>
        <button
          className="score-toggle topbar-action activity-action"
          onClick={() => setNotificationsOpen((open) => !open)}
        >
          Activity <b>{notifications.length + (turnNotice ? 1 : 0) + (draftNotice ? 1 : 0)}</b>
        </button>
        <div className={`network-connection topbar-action ${connection}`}>
          <i />
          <span>{connection}</span>
          <b>REV {session.revision}</b>
        </div>
        <button className="ghost topbar-action exit-action" onClick={onLeave}>
          Exit room
        </button>
      </header>
      <section className="faction-scorebar" aria-label="Civilization standings">
        {game.players.map((civilization) => {
          const contacted =
            playerId === civilization.id ||
            (playerId !== undefined &&
              isContacted(game, playerId, civilization.id));
          const agreements =
            playerId === undefined || playerId === civilization.id
              ? []
              : activeAgreements(game, playerId, civilization.id);
          const proposals = incomingProposals.filter(
            (proposal) =>
              (proposal.kind === "technology"
                ? proposal.seller
                : proposal.from) === civilization.id,
          );
          const sealed = game.orderProtocol.submissions.some(
            (submission) => submission.playerId === civilization.id,
          );
          const faction = session.summary.availableFactions.find(
            (candidate) => candidate.id === civilization.faction,
          );
          return (
            <button
              key={civilization.id}
              className={`${playerId === civilization.id ? "self" : ""} ${proposals.length ? "attention" : ""}`}
              style={{ "--faction": civilization.color } as React.CSSProperties}
              onClick={() => openDiplomacy(civilization.id === playerId ? undefined : civilization.id)}
            >
              <i>
                {faction?.logo ? (
                  <img src={faction.logo} alt={`${civilization.name} emblem`} />
                ) : (
                  civilization.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                )}
              </i>
              <span>
                <b>{civilization.name}</b>
                <small>
                  {contacted ? "Contact" : "No contact"} ·{" "}
                  {sealed ? "Orders sealed" : "Planning"}
                </small>
                <small className="faction-card-resources">
                  {(["material", "currency", "research", "influence"] as const).map((resource) => <span key={resource} className={`resource-${resource}`} title={resource}><ResourceGlyph resource={resource} label={false}/>{civilization.resources[resource]}</span>)}<span className="resource-labor" title="labor"><ResourceGlyph resource="labor" label={false}/>{civilization.labor}</span>
                </small>
              </span>
              <strong>
                {civilization.lp}
                <small> LP</small>
              </strong>
              {agreements.length > 0 && (
                <em
                  title={agreements
                    .map((agreement) => agreementNames[agreement.type])
                    .join(", ")}
                >
                  {agreements
                    .map((agreement) =>
                      agreement.type.slice(0, 1).toUpperCase(),
                    )
                    .join("")}
                </em>
              )}
              {proposals.length > 0 && (
                <mark title="Incoming proposal">{proposals.length}</mark>
              )}
            </button>
          );
        })}
      </section>
      {error && (
        <div className="notice room-error" role="alert">
          {error}
        </div>
      )}
      {latestBrief && <TurnResolutionSummary brief={latestBrief} close={() => setBriefDismissedTurn(latestBrief.turn)} viewPrevious={() => { setBriefDismissedTurn(latestBrief.turn); openReplay(latestBrief.turn); }} />}
      <NetworkFirstHorizonGuide game={game} onCommand={onCommand} openPanel={(requested) => selectPanel((requested === "tech" ? "technology" : requested === "command" ? "military" : requested === "faction" ? "academy" : panelLabels[requested as Panel] ? requested : "map") as Panel)} />
      <NetworkAcademyGuide game={game} onCommand={onCommand} openPanel={(requested) => selectPanel((requested === "faction" ? "academy" : panelLabels[requested as Panel] ? requested : "map") as Panel)} />
      {game.scenarioId === "faction-academy" && game.academy?.dismissed && !game.academy.freePractice && <button className="academy-guide-reopen" onClick={() => void onCommand({ kind: "showAcademy" })}>Show Academy Guide</button>}
      {coachPanel && panelCoach[coachPanel] && (
        <aside className="first-horizon-panel-coach" aria-live="polite">
          <span>INTERFACE DISCOVERED</span>
          <h3>{panelLabels[coachPanel].label}</h3>
          <p>{panelCoach[coachPanel]}</p>
          <button onClick={() => {
            void onCommand({ kind: "tutorialEvent", event: "panel-opened", value: coachPanel });
            setCoachPanel(null);
          }}>Continue exploring</button>
        </aside>
      )}
      {scoreOpen && (
        <aside className="network-score-popover">
          <header>
            <b>Current standings</b>
            <button onClick={() => setScoreOpen(false)}>Close</button>
          </header>
          {turnNotice && <button onClick={() => { setTurnNotice(""); if (game.turnReplays?.length) openReplay(game.turn - 1); }}><i>TURN</i><span>{turnNotice}</span>{game.turnReplays?.length ? <small>View Previous Orders</small> : null}</button>}
          {draftNotice && <button onClick={() => { setPanel("orders"); setDockOpen(true); setNotificationsOpen(false); }}><i>ORD</i><span>{sealedSubmission ? "Your Orders are sealed. Unseal before editing the queue." : draftNotice}</span><small>Open Orders</small></button>}
          {[...game.players]
            .sort((a, b) => b.lp - a.lp)
            .map((civilization, index) => (
              <div className="standing" key={civilization.id}>
                <i style={{ background: civilization.color }} />
                <b>{index + 1}</b>
                <span>
                  {civilization.name}
                  <small>
                    {civilization.controller.kind === "bot"
                      ? "AI"
                      : session.summary.seats[civilization.id]?.displayName ||
                        "Human"}
                  </small>
                </span>
                <strong>{civilization.lp}</strong>
              </div>
            ))}
          <RoomStatus session={session} connection={connection} />
        </aside>
      )}
      {notificationsOpen && (
        <aside className="notification-popover">
          <header>
            <b>Activity and notifications</b>
            <button onClick={() => setNotificationsOpen(false)}>Close</button>
          </header>
          {!roomReminders.enabled && <button onClick={() => void roomReminders.enable()}><i>REM</i><span>Enable browser reminders for decisions requiring your attention.</span><small>Enable reminders</small></button>}
          {notifications.map((item) => (
            <button
              key={item.id}
              onClick={() => openActivity(item)}
            >
              <i>{item.type.slice(0, 3).toUpperCase()}</i>
              <span>{item.text}</span>
              {item.hexId && <small>Locate {item.hexId}</small>}
            </button>
          ))}
          {!notifications.length && <p>No recent activity.</p>}
        </aside>
      )}
      <div className="play-area network-play-area">
        <aside className="left-rail network-command-dock">
          <button
            className="dock-toggle"
            aria-expanded={dockOpen}
            onClick={() => setDockOpen((open) => !open)}
          >
            <i>{dockOpen ? "‹" : "›"}</i>
            <span>
              {dockOpen ? "Collapse command dock" : "Expand command dock"}
            </span>
          </button>
          {dockOpen && (
            <>
              <div className="identity">
                <span>
                  {spectator
                    ? "PUBLIC SPECTATOR"
                    : session.role === "host"
                      ? "ROOM HOST"
                      : "PRIVATE NETWORK SEAT"}
                </span>
                <h2>{player?.name || "The Shattered Reach"}</h2>
                <p>{player?.faction || "Live public board"}</p>
              </div>
              {player && (
                <div className="resources">
                  {(
                    [
                      "material",
                      "currency",
                      "research",
                      "influence",
                    ] as Resource[]
                  ).map((resource) => (
                    <div key={resource}>
                      <i className={resource}>{resource[0].toUpperCase()}</i>
                      <small>{resource}</small>
                      <strong>{player.resources[resource]}</strong>
                    </div>
                  ))}
                  <div>
                    <i className="labor">L</i>
                    <small>Labor</small>
                    <strong>
                      {player.labor}/{player.laborCap}
                    </strong>
                  </div>
                </div>
              )}
            </>
          )}
          <nav aria-label="Game actions">
            {(
              [
                "map",
                "military",
                "build",
                "technology",
                "economy",
                "communications",
                "diplomacy",
                "orders",
                "academy",
                "room",
                "more",
              ] as Panel[]
            ).map((id) => {
              const badge =
                id === "communications"
                  ? Object.values(session.chat?.unreadByChannel || {}).reduce((sum, count) => sum + count, 0)
                  : id === "diplomacy"
                  ? pendingProposals
                  : id === "legacy" && hiddenRequired
                    ? 1
                    : 0;
              const item = panelLabels[id];
              return (
                <button
                  key={id}
                  title={item.label}
                  className={`${panel === id ? "active" : ""} ${["map", "military", "communications", "diplomacy", "orders", "more"].includes(id) ? "mobile-primary" : "mobile-secondary"}`}
                  data-panel={id}
                  disabled={spectator && !["map", "room", "academy", "more"].includes(id)}
                  onClick={() => selectPanel(id)}
                >
                  <i><CommandIcon name={id} /></i>
                  <span>{item.label}</span>
                  {badge ? <sup>{badge}</sup> : null}
                </button>
              );
            })}
          </nav>
          {dockOpen && (
            <>
              <section className="action-panel network-action-panel">
                <button
                  className="dock-panel-close"
                  onClick={() => setDockOpen(false)}
                >
                  Close panel
                </button>
                {draftNotice && (
                  <button
                    className="draft-notice"
                    onClick={() => setPanel("orders")}
                  >
                    {draftNotice}
                    <small>Open Orders</small>
                  </button>
                )}
                {panel === "map" && (
                  <div className="network-map-command">
                    <h3>{spectator ? "Spectator view" : "Vessel Actions"}</h3>
                    <p>
                      {spectator
                        ? "Private objectives, proposals, surveys, and sealed Orders are concealed."
                        : "Select one of your vessel icons on the map. Every available action appears here."}
                    </p>
                    {!mapUnit && !spectator && (
                      <div className="map-first-tip">
                        <b>Choose a vessel on the map</b>
                        <span>
                          Explorer, Colony Ship, civilian vessel, or Carrier
                          icons can be selected directly.
                        </span>
                      </div>
                    )}
                    {mapUnit && (
                      <div className="selected-unit-card">
                        <ShipIcon type={mapUnit.icon} color={player?.color} />
                        <span>
                          <b>{selectedUnitName}</b>
                          <small>{mapUnit.hex}</small>
                          {mapUnit.kind === "colony" && <small>Noncombatant · immune to ordinary combat</small>}
                        </span>
                        <div className="selected-unit-actions">
                          <button
                            className="primary"
                            disabled={!canDraft || !canMoveSelected}
                            onClick={() => setUnitIntent("move")}
                          >
                            Move
                          </button>
                          {mapUnit.kind === "colony" && (
                            <button
                              disabled={!canDraft || !!establishReason}
                              title={establishReason}
                              onClick={draftEstablish}
                            >
                              Establish Habitat
                            </button>
                          )}
                          {selectedCivilian?.type === "prospector" && (
                            <button
                              disabled={!canDraft || !!prospectReason}
                              title={prospectReason}
                              onClick={draftProspect}
                            >
                              Prospect current world
                            </button>
                          )}
                          {selectedCivilian?.type === "surveyor" && (
                            <button
                              disabled={
                                !canDraft ||
                                player?.surveyUsedTurn === game.turn ||
                                selectedCivilian.usedTurn === game.turn ||
                                selectedCivilian.readyTurn > game.turn
                              }
                              onClick={() => setUnitIntent("longRangeSurvey")}
                            >
                              Long-Range Survey
                            </button>
                          )}
                          <button
                            disabled={!canDraft}
                            onClick={() => {
                              setDraft((current) =>
                                removeUnitOrders(current, mapUnit),
                              );
                              notify(`${selectedUnitName} will Hold.`);
                              setPanel("orders");
                            }}
                          >
                            Hold
                          </button>
                        </div>
                        {mapUnit.kind === "colony" && establishReason && (
                          <small className="action-reason">
                            {establishReason}
                          </small>
                        )}
                        {selectedCivilian?.type === "prospector" &&
                          prospectReason && (
                            <small className="action-reason">
                              {prospectReason}
                            </small>
                          )}
                      </div>
                    )}
                  </div>
                )}
                {panel === "military" && player && (
                  <NetworkMilitaryPanel
                    game={viewGame}
                    playerId={player.id}
                    draft={draft}
                    setDraft={setDraft}
                    selectedIds={taskForceIds}
                    setSelectedIds={setTaskForceIds}
                    targeting={militaryTargeting}
                    beginTargeting={() => setMilitaryTargeting(true)}
                    busy={busy}
                    onCommand={onCommand}
                  />
                )}
                {panel === "map" && selectedExplorer && (
                  <div className="exploration-actions">
                    <h4>Exploration actions</h4>
                    {explorationLibrary[selectedExplorer.type].tech >= 2 && (
                      <button
                        disabled={!canDraft}
                        onClick={() => setUnitIntent("publicScan")}
                      >
                        Publicly scan adjacent hex
                      </button>
                    )}
                    {player?.faction === "farbound" && (
                      <button
                        disabled={
                          !canDraft || player.forwardScanUsedTurn === game.turn
                        }
                        onClick={() => setUnitIntent("farboundScan")}
                      >
                        Private Forward Scan
                      </button>
                    )}
                    {player?.faction === "wayfarers" && player.tech.Exploration >= 2 && (
                      <button disabled={!canDraft || player.deepReconUsedTurn === game.turn} onClick={() => setUnitIntent("wayfarerRecon")}>Private Deep Recon</button>
                    )}
                  </div>
                )}
                {panel === "orders" && player && (
                  <div className="network-orders">
                    <header className="orders-review-header">
                      <span>PRIVATE ORDER QUEUE</span>
                      <h3>{draft.length} drafted {draft.length === 1 ? "Order" : "Orders"}</h3>
                    </header>
                    <button className="primary wide orders-seal-button orders-seal-top" disabled={!canDraft || busy || sealingOrders} onClick={() => setSealReviewOpen(true)}>{canDraft ? "Review and seal Orders" : "Orders sealed"}</button>
                    <p className="orders-review-copy">
                      {canDraft
                        ? "Review the queue and projected cost, then seal when ready."
                        : "Your Orders are sealed for this Turn."}
                    </p>
                    {(game.turn - 1) % 4 === 0 && !!game.policyElection?.choices.length && !game.policyElection.votingClosed && <p className="policy-orders-reminder">The Era Policy ballot is in Legacy. Seal it there before you seal Orders.</p>}
                    <div className="orders-secondary-actions">
                      {!!game.turnReplays?.length && <button onClick={() => openReplay()}>View Previous Orders</button>}
                      <button aria-expanded={hintsOpen} onClick={() => setHintsOpen(!hintsOpen)}>{hintsOpen ? "Hide suggestions" : "Show Turn suggestions"}</button>
                    </div>
                    {hintsOpen && <section className="orders-hints"><b>Suggested next steps</b><ul>{playerHints(viewGame, player.id, draft).map((hint) => <li key={hint}>{hint}</li>)}</ul><small>Suggestions only. Choose the plan that fits your strategy.</small></section>}
                    <div className="network-order-list">
                      {draft.map((order, index) => (
                        <div key={order.id}>
                          <i className="order-number">{index + 1}</i>
                          <span>{orderLabel(order)}</span>
                          <button
                            onClick={() =>
                              setDraft((current) =>
                                current.filter(
                                  (candidate) => candidate.id !== order.id,
                                ),
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {!draft.length && (
                        <small>
                          No drafted Orders. An empty submission issues Hold.
                        </small>
                      )}
                    </div>
                    <div className="network-budget">
                      <span>Projected cost</span>
                      <b>
                        {formatPurchaseCost(
                          player
                            ? totalOrderCost(viewGame, player.id, draft)
                            : {},
                        )}
                      </b>
                      <span>Budget status</span>
                      <b>{budget?.error || "Valid"}</b>
                    </div>
                    <details className="orders-idle-units"><summary>{idleUnits.length ? `${idleUnits.length} ready vessel${idleUnits.length === 1 ? "" : "s"} without Orders` : "All ready vessels reviewed"}</summary><p>Advisory only. Unordered vessels hold position; click one to inspect it on the map.</p>{idleUnits.map((unit) => <button key={unit.id} onClick={() => focusUncommanded(unit)}>{unit.label} <small>{unit.hex}</small></button>)}</details>
                    <div className="orders-detail-toggles">
                      <button aria-expanded={sealChecklistOpen} onClick={() => setSealChecklistOpen((open) => !open)}>{sealChecklistOpen ? "Hide pre-seal checklist" : "Show pre-seal checklist"}</button>
                      {["spires", "aegis", "wayfarers", "salvo", "guilds"].includes(player.faction) && <button aria-expanded={factionOrderToolsOpen} onClick={() => setFactionOrderToolsOpen((open) => !open)}>{factionOrderToolsOpen ? "Hide faction order tools" : "Show faction order tools"}</button>}
                    </div>
                    {sealChecklistOpen && <section className="seal-checklist">
                      <h4>Before you seal</h4>
                      <span className={hidden?.selected ? "complete" : "warning"}><i>{hidden?.selected ? "OK" : "!"}</i><b>Hidden objective</b><small>{hidden?.selected ? "Selected for this Era" : "Selection required"}</small></span>
                      <span className={draft.length ? "complete" : "warning"}><i>{draft.length || "!"}</i><b>Orders drafted</b><small>{draft.length ? `${draft.length} action${draft.length === 1 ? "" : "s"} in queue` : "Empty queue will issue Hold"}</small></span>
                      <span className={budget?.error ? "warning" : "complete"}><i>{budget?.error ? "!" : "OK"}</i><b>Projected budget</b><small>{budget?.error || "All drafted costs are affordable"}</small></span>
                      <span className="advisory"><i>{controlledHabitats.length}</i><b>Controlled Habitats</b><small>{controlledHabitats.filter((hex) => !draft.some((order) => order.kind === "construct" && order.habitatId === hex.id)).length} still have an unused construction opportunity</small></span>
                      <span className={hasDraftedGate ? "complete" : "advisory"}><i>{hasDraftedGate ? "OK" : "?"}</i><b>Horizon Gate</b><small>{hasDraftedGate ? "Contribution recorded or drafted this Era" : "No contribution recorded this Era"}</small></span>
                      <span className={incomingProposals.length ? "advisory" : "complete"}><i>{incomingProposals.length || "OK"}</i><b>Diplomacy inbox</b><small>{incomingProposals.length ? `${incomingProposals.length} unanswered proposal${incomingProposals.length === 1 ? "" : "s"}` : "No unanswered proposals"}</small></span>
                    </section>}
                    {factionOrderToolsOpen && <ShatteredReachPanel game={viewGame} draft={draft} setDraft={setDraft}/>}
                  </div>
                )}
                {panel === "room" && (
                  <>
                    <RoomStatus session={session} connection={connection} />
                    {!['lobby', 'paused'].includes(session.summary.status) && <RoomLobby session={session} busy={busy} onCommand={onCommand} onRefresh={onRefresh} onLeave={onLeave} onExportReport={onExportReport} />}
                  </>
                )}
                {panel === "more" && <section className="network-more-menu"><header className="network-panel-header"><span>COMMAND DIRECTORY</span><h3>More systems</h3><p>Every game system remains available on compact screens.</p></header>{(["build","technology","economy","gate","legacy","resources","academy","room"] as Panel[]).map((id) => <button key={id} onClick={() => selectPanel(id)}><CommandIcon name={id}/><span><b>{panelLabels[id].label}</b><small>Open {panelLabels[id].label}</small></span></button>)}</section>}
              </section>
              {player && (
                <button className="end-turn" onClick={() => { setPanel("orders"); setDockOpen(true); }}>
                  {canDraft ? "Review and seal Orders" : "Orders sealed"}
                </button>
              )}
            </>
          )}
        </aside>

        <section className="map-wrap">
          <div className="map-header">
            <div>
              <p>
                {map.name.toUpperCase()} · SEED {game.seed}
              </p>
              <h1>
                {selectedHex.revealed
                  ? `${selectedHex.kind} sector`
                  : "Uncharted"}
              </h1>
            </div>
            <div className="map-controls">
              <button
                aria-label="Zoom out"
                onClick={() =>
                  setMapZoom((value) => Math.max(0.2, value - 0.1))
                }
              >
                −
              </button>
              <span>{Math.round(mapZoom * 100)}%</span>
              <button
                aria-label="Zoom in"
                onClick={() =>
                  setMapZoom((value) => Math.min(1.3, value + 0.1))
                }
              >
                +
              </button>
              <button onClick={() => centerMap()}>Center</button>
              <button onClick={fitMap}>Fit</button>
              {!!game.turnReplays?.length && <button onClick={() => openReplay()}>Previous Orders</button>}
            </div>
          </div>
          {(activeTargets.length > 0 || planningRoute) && (
            <div className="network-target-prompt">
              <span>
                <b>{migrationMobile ? mobileHabitatLibrary[migrationMobile.type].name : bombardCarrier ? carrierLibrary[bombardCarrier.type].name : selectedUnitName}</b>
                <small>
                  {migrationMobileId
                    ? "Migration selected"
                    : bombardCarrierId
                    ? "Bombardment selected"
                    : unitIntent === "farboundScan" || unitIntent === "wayfarerRecon"
                    ? "Survey selected"
                    : unitIntent === "longRangeSurvey"
                      ? "Long-Range Survey selected"
                      : "Move selected"}
                </small>
              </span>
              {activeTargets.length > 0 && <strong>
                {migrationMobileId
                  ? "Choose a highlighted destination hex"
                  : bombardCarrierId
                  ? "Choose a highlighted target hex"
                  : unitIntent === "longRangeSurvey" ||
                unitIntent === "farboundScan" || unitIntent === "wayfarerRecon"
                  ? "Choose an unrevealed sector"
                  : "Choose a highlighted destination"}
              </strong>}
              <button
                onClick={() => {
                  setUnitIntent(null);
                  setMilitaryTargeting(false);
                  setBombardCarrierId(null);
                  setMigrationMobileId(null);
                  setBuildTargeting(false);
                }}
              >
                Cancel
              </button>
            </div>
          )}
          <div
            ref={mapViewportRef}
            className={`map-viewport ${mapGestures.dragging ? "dragging" : ""} ${activeTargets.length || planningRoute ? "targeting" : ""} ${migrationMobileId ? "migration-targeting" : ""}`}
            {...mapGestures.handlers}
          >
            <div
              className="map-scale"
              style={{ width: mapCanvas.width * mapZoom, height: mapCanvas.height * mapZoom }}
            >
              <div
                className="map-stage"
                style={{ width: mapCanvas.width, height: mapCanvas.height, transform: `scale(${mapZoom})` }}
              >
                <div className="hex-map">
                  {game.hexes.map((hex) => (
                    <button
                      key={hex.id}
                      data-hex-id={hex.id}
                      title={combatHexes.has(hex.id) ? `Combat occurred at ${hex.id}` : `Hex ${hex.id}`}
                      onClick={() => clickHex(hex.id)}
                      className={`hex ${hexColumnClass(hex.col)} ${hex.kind} ${hex.tier === "Arcology" ? "arcology" : ""} ${hex.enhancedCenterIndices?.length ? "enhanced-centers" : ""} ${hex.centers.includes("factory") ? "factory-installed" : ""} ${!hex.revealed ? "concealed" : ""} ${!hex.revealed && hex.surveyedBy?.includes(playerId ?? -1) ? "privately-surveyed" : ""} ${selectedHexId === hex.id ? "selected" : ""} ${activeTargets.includes(hex.id) ? "legal-target" : ""} ${combatHexes.has(hex.id) ? "combat-history" : ""}`}
                      style={
                        {
                          gridColumn: hex.col + 1,
                          gridRow: hex.row + 1,
                          "--owner":
                            hex.owner === undefined
                              ? "transparent"
                              : game.players[hex.owner]?.color,
                        } as React.CSSProperties
                      }
                    >
                      <span className="hex-inner">
                        <img
                          className="tile-art"
                          src={
                            hex.revealed || hex.surveyedBy?.includes(playerId ?? -1)
                              ? tileAssets[hex.kind]
                              : tileAssets.unrevealed
                          }
                          alt=""
                        />
                        {hex.revealed && hex.kind !== "rift" && (
                          <>
                            <small>{hex.id}</small>
                            <b>{labels[hex.kind]}</b>
                            {hex.tier && <em>{hex.tier[0]}</em>}
                            {hex.centers.length > 0 && (
                              <u>{hex.centers.length}C</u>
                            )}
                          </>
                        )}
                        {!hex.revealed && hex.surveyedBy?.includes(playerId ?? -1) && (
                          <><small>{hex.id}</small><b>{labels[hex.kind]}</b><u>PRIVATE</u></>
                        )}
                        {hexDraftIndices(hex.id).map((index) => (
                          <mark key={index} className="hex-order-marker">
                            {index + 1}
                          </mark>
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="unit-layer">
                  {game.hexes.map((hex) => (
                    <div
                      className={`unit-cell ${hexColumnClass(hex.col)}`}
                      key={hex.id}
                      style={{ gridColumn: hex.col + 1, gridRow: hex.row + 1 }}
                    >
                      {game.players
                        .flatMap((owner) =>
                          (owner.explorationVessels || []).map((vessel) => ({
                            owner,
                            vessel,
                          })),
                        )
                        .filter(({ vessel }) => vessel.hex === hex.id)
                        .map(({ owner, vessel }) => {
                          const unit = {
                            kind: "explorer",
                            id: vessel.id,
                            hex: hex.id,
                            icon: explorationIcon(
                              explorationLibrary[vessel.type].tech,
                            ),
                          } as MapUnit;
                          const orderIndex =
                            owner.id === playerId ? unitDraftIndex(unit) : -1;
                          return (
                            <button
                              key={vessel.id}
                              className={`map-unit ${mapUnit?.id === vessel.id ? "selected" : ""} ${orderIndex >= 0 ? "drafted" : ""}`}
                              aria-label={`${owner.name} ${explorationLibrary[vessel.type].name} at ${hex.id}`}
                              onClick={() => planningRoute ? clickHex(hex.id) : owner.id === playerId && selectMapUnit(unit)}
                            >
                              <ShipIcon type={unit.icon} color={owner.color} />
                              {orderIndex >= 0 && (
                                <mark className="unit-order-marker">
                                  {orderIndex + 1}
                                </mark>
                              )}
                            </button>
                          );
                        })}
                      {game.players.flatMap((owner) =>
                        owner.colonyShips
                        .filter((vessel) => vessel.hex === hex.id)
                        .map((vessel) => {
                          const unit = {
                            kind: "colony",
                            id: vessel.id,
                            hex: hex.id,
                            icon: "colonyShip",
                          } as MapUnit;
                          const orderIndex =
                            owner.id === playerId ? unitDraftIndex(unit) : -1;
                          return (
                            <button
                              key={vessel.id}
                              className={`map-unit ${mapUnit?.id === vessel.id ? "selected" : ""} ${orderIndex >= 0 ? "drafted" : ""}`}
                              aria-label={`${owner.name} Colony Ship at ${hex.id}`}
                              onClick={() => planningRoute ? clickHex(hex.id) : owner.id === playerId && selectMapUnit(unit)}
                            >
                              <ShipIcon type="colonyShip" color={owner.color} />
                              {orderIndex >= 0 && (
                                <mark className="unit-order-marker">
                                  {orderIndex + 1}
                                </mark>
                              )}
                            </button>
                          );
                        }))}
                      {game.civilianUnits
                        .filter((unit) => unit.hex === hex.id)
                        .map((unit) => {
                          const mapUnitValue = {
                            kind: "civilian",
                            id: unit.id,
                            hex: hex.id,
                            icon: unit.type,
                          } as MapUnit;
                          const orderIndex =
                            unit.owner === playerId
                              ? unitDraftIndex(mapUnitValue)
                              : -1;
                          return (
                            <button
                              key={unit.id}
                              className={`map-unit ${mapUnit?.id === unit.id ? "selected" : ""} ${orderIndex >= 0 ? "drafted" : ""}`}
                              aria-label={`${civilianLibrary[unit.type].name} at ${hex.id}`}
                              onClick={() => planningRoute ? clickHex(hex.id) : unit.owner === playerId && selectMapUnit(mapUnitValue)}
                            >
                              <ShipIcon
                                type={unit.type}
                                color={game.players[unit.owner].color}
                              />
                              {orderIndex >= 0 && (
                                <mark className="unit-order-marker">
                                  {orderIndex + 1}
                                </mark>
                              )}
                            </button>
                          );
                        })}
                      {game.carriers
                        .filter((carrier) => carrier.hex === hex.id)
                        .map((carrier) => {
                          const orderIndex =
                            carrier.owner === playerId
                              ? carrierDraftIndex(carrier.id)
                              : -1;
                          return (
                            <button
                              key={carrier.id}
                              className={`map-unit carrier ${selectedCarrier?.id === carrier.id ? "selected" : ""} ${orderIndex >= 0 ? "drafted" : ""}`}
                              aria-label={`${carrier.type} with ${carrier.cu} Combat Units at ${hex.id}`}
                              onClick={() => {
                                if (planningRoute) return clickHex(hex.id);
                                if (carrier.owner === playerId) {
                                  setBombardCarrierId(null);
                                  setTaskForceIds([carrier.id]);
                                  setSelectedHexId(hex.id);
                                  setMapUnit(null);
                                  setSelectedReachAssetId(null);
                                  setContextOpen(true);
                                  setPanel("map");
                                  setDockOpen(false);
                                }
                              }}
                            >
                              <ShipIcon
                                type={carrier.type}
                                color={game.players[carrier.owner].color}
                              />
                              <small>{carrier.cu}</small>
                              {orderIndex >= 0 && (
                                <mark className="unit-order-marker">
                                  {orderIndex + 1}
                                </mark>
                              )}
                            </button>
                          );
                        })}
                      {game.mobileHabitats.filter((mobile) => mobile.hex === hex.id).map((mobile) => (
                        <button type="button" key={mobile.id} className={`map-unit reach-asset mobile-habitat mobile-${mobile.type} ${mobile.deployed ? "deployed" : "migrating"} ${selectedReachAssetId === mobile.id ? "selected" : ""}`} style={{ "--unit-color": game.players[mobile.owner].color } as React.CSSProperties} aria-label={`Select ${game.players[mobile.owner].name} ${mobile.type} with ${mobile.centers.length} Centers and ${mobile.caravanGuards} Caravan Guards at ${hex.id}`} title={`${mobileHabitatLibrary[mobile.type].name} · owned by ${game.players[mobile.owner].name} · ${mobile.centers.length} Centers · ${mobile.caravanGuards} Guards`} onClick={() => { if (planningRoute) return clickHex(hex.id); setSelectedReachAssetId(mobile.id); setSelectedHexId(hex.id); setMapUnit(null); setTaskForceIds([]); setPanel("map"); setDockOpen(false); setContextOpen(true); }}>
                          <ShipIcon type={mobile.type} color={game.players[mobile.owner].color} />
                          {mobile.caravanGuards > 0 && <small className="guard-count">G{mobile.caravanGuards}</small>}
                        </button>
                      ))}
                      {game.blockades.filter((blockade) => blockade.hex === hex.id && blockade.active).map((blockade) => (
                        <button type="button" key={blockade.id} className={`map-unit reach-asset blockade-marker ${selectedReachAssetId === blockade.id ? "selected" : ""}`} style={{ "--unit-color": game.players[blockade.owner].color } as React.CSSProperties} aria-label={`Select ${game.players[blockade.owner].name} Blockade Platform at ${hex.id}`} title={`Blockade Platform · owned by ${game.players[blockade.owner].name} · 4 CS`} onClick={() => { if (planningRoute) return clickHex(hex.id); setSelectedReachAssetId(blockade.id); setSelectedHexId(hex.id); setMapUnit(null); setTaskForceIds([]); setPanel("map"); setDockOpen(false); setContextOpen(true); }}><ShipIcon type="blockade" color={game.players[blockade.owner].color}/><small>4</small></button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="selected-card">
            <div>
              <span>SELECTED HEX {selectedHex.id}</span>
              <strong>
                {selectedHex.revealed ? selectedHex.kind : "Uncharted"}
              </strong>
            </div>
            <div>
              {selectedHex.owner !== undefined && (
                <>
                  <span>CONTROL</span>
                  <strong
                    style={{ color: game.players[selectedHex.owner].color }}
                  >
                    {game.players[selectedHex.owner].name}
                  </strong>
                </>
              )}
            </div>
            <div>
              {selectedHex.tier && (
                <>
                  <span>HABITAT</span>
                  <strong>
                    {selectedHex.tier} · {selectedHex.combat} stationed CU
                  </strong>
                </>
              )}
            </div>
            {!!selectedHex.centers.length && <div className="selected-centers"><span>CENTERS</span><strong>{selectedHex.centers.map((center, index) => <span key={`${center}-${index}`} className={`resource-${center}`}><ResourceGlyph resource={center === "factory" || center === "defense" ? "material" : center} label={false}/>{center === "factory" ? "Factory" : center === "defense" ? "Defense Grid" : center}</span>)}</strong></div>}
            <HexDetails game={viewGame} hex={selectedHex} />
          </div>
        </section>
      </div>
      {player && !game.result && <section className="running-orders" aria-label="Your Orders"><header><b>{sealedSubmission ? "Sealed Orders" : "Your Order queue"}</b><small>{displayedOrders.length} Orders</small><small>Total: {formatPurchaseCost(totalOrderCost(viewGame, player.id, displayedOrders))}</small><small className={budget?.error ? "warning" : ""}>Left: {budget?.error || `${budgetResources.map((resource) => `${budget?.remaining.resources[resource] ?? 0}${resource[0].toUpperCase()}`).join(" · ")} · ${budget?.remaining.labor ?? 0}L`}</small></header><div className="running-orders-scroll">{displayedOrders.map((order, index) => <article key={order.id}><span>{index + 1}. {orderLabel(order)}<small>{formatPurchaseCost(displayedCosts[index])}</small></span>{!sealedSubmission && <button aria-label={`Remove ${orderLabel(order)}`} onClick={() => setDraft((current) => current.filter((entry) => entry.id !== order.id))}>Remove</button>}</article>)}{!displayedOrders.length && <span>No Orders queued. Select a vessel or Habitat to begin.</span>}</div>{sealedSubmission ? <button disabled={busy} onClick={() => void unseal()}>Unseal Orders</button> : <button className="running-seal-action" onClick={() => setSealReviewOpen(true)}>Review and seal</button>}</section>}
      {player && session.summary.status === "active" && !game.result && !hiddenRequired && !policyVoteRequired && !fullScreenPanels.includes(panel) && <div className={`network-drawer-system ${rightDrawerOpen && rightPanels.includes(panel) ? "open" : ""}`}>
        <nav className="network-drawer-tabs" aria-label="Right side menus">{rightPanels.map((id) => <button type="button" key={id} data-panel={id} className={panel === id && rightDrawerOpen ? "active" : ""} aria-expanded={panel === id && rightDrawerOpen} onClick={() => { if (panel === id && rightDrawerOpen) { setRightDrawerOpen(false); if (id === "build") setBuildTargeting(false); } else selectPanel(id); }}><CommandIcon name={id}/><span>{panelLabels[id].label}</span>{id === "legacy" && hiddenRequired && <sup aria-label="Hidden objective required">!</sup>}</button>)}</nav>
        {rightDrawerOpen && rightPanels.includes(panel) && <aside className="network-side-drawer" data-panel={panel} aria-label={`${panelLabels[panel].label} menu`}>
          <header><div><span>COMMAND SYSTEM</span><h2>{panelLabels[panel].label}</h2></div><button type="button" aria-label="Collapse right menu" onClick={() => { setRightDrawerOpen(false); if (panel === "build") setBuildTargeting(false); }}>Close ‹</button></header>
          <div className="network-side-drawer-scroll">
            {panel === "build" && <BuildPanel game={viewGame} habitatId={buildHexId} draft={draft} setDraft={setDraft} flash={notify} openDiplomacy={() => openDiplomacy()} selectHabitat={() => { setBuildTargeting(true); setBuildHexId(null); }}/>}
            {panel === "economy" && <NetworkEconomyPanel game={viewGame} playerId={player.id} busy={busy} onCommand={onCommand}/>}
            {panel === "technology" && <TechnologyPanel game={viewGame} draft={draft} setDraft={setDraft} flash={notify}/>}
            {panel === "gate" && <NetworkGatePanel game={viewGame} playerId={player.id} draft={draft} setDraft={setDraft} notify={notify}/>}
            {panel === "legacy" && <NetworkLegacyPanel game={viewGame} playerId={player.id} busy={busy} onCommand={onCommand}/>}
            {panel === "resources" && <NetworkResourcesPanel game={viewGame} playerId={player.id}/>}
          </div>
        </aside>}
      </div>}
      {contextOpen && selectedHex && (
        <aside
          className="map-context-menu"
          aria-label={`Actions for ${selectedHex.id}`}
        >
          <header>
            <div>
              <span>
                {mapUnit || selectedCarrier || selectedMobileHabitat || selectedBlockade
                  ? "SELECTED VESSEL"
                  : `HEX ${selectedHex.id}`}
              </span>
              <b>
                {mapUnit
                  ? selectedUnitName
                  : selectedCarrier
                    ? carrierLibrary[selectedCarrier.type].name
                    : selectedMobileHabitat
                      ? mobileHabitatLibrary[selectedMobileHabitat.type].name
                      : selectedBlockade
                        ? "Blockade Platform"
                    : selectedHex.revealed
                      ? `${selectedHex.kind} sector`
                      : "Uncharted sector"}
              </b>
            </div>
            <button onClick={() => setContextOpen(false)}>Close</button>
          </header>
          {selectedMobileHabitat && (
            <section className="context-primary-actions mobile-habitat-actions">
              <div className="context-unit-title">
                <ShipIcon type={selectedMobileHabitat.type} color={game.players[selectedMobileHabitat.owner].color}/>
                <span><b>{mobileHabitatLibrary[selectedMobileHabitat.type].name}</b><small>{game.players[selectedMobileHabitat.owner].name} · {selectedMobileHabitat.hex} · {selectedMobileHabitat.centers.length}/{mobileHabitatLibrary[selectedMobileHabitat.type].slots} mobile Centers</small></span>
              </div>
              {selectedMobileHabitat.owner === playerId ? <>
                <button className="primary" disabled={!canDraft || selectedMobileHabitat.readyTurn > game.turn || selectedMobileHabitat.movesRemaining < 1} onClick={() => { setMigrationMobileId(selectedMobileHabitat.id); setContextOpen(false); }}>Migrate</button>
                {(["material", "currency", "research", "influence", "labor"] as const).map((center) => {
                  const construction = { type: "mobileCenter" as const, mobileHabitatId: selectedMobileHabitat.id, center };
                  const quote = constructionQuote(viewGame, player!.id, selectedMobileHabitat.hex, construction);
                  return <button key={center} disabled={!canDraft || !quote.available} title={quote.reason} onClick={() => draftMobileConstruction(construction)}>Build {center} Center<small>{formatPurchaseCost(quote.cost)}</small></button>;
                })}
                {(() => { const construction = { type: "caravanGuard" as const, mobileHabitatId: selectedMobileHabitat.id }; const quote = constructionQuote(viewGame, player!.id, selectedMobileHabitat.hex, construction); return <button disabled={!canDraft || !quote.available} title={quote.reason} onClick={() => draftMobileConstruction(construction)}>Build Caravan Guard<small>{formatPurchaseCost(quote.cost)}</small></button>; })()}
                <small className="context-reason">Mobile Habitats construct only mobile Centers and Caravan Guards. Permanent Habitat construction is intentionally unavailable here.</small>
              </> : <small className="context-reason">This mobile Habitat belongs to {game.players[selectedMobileHabitat.owner].name}.</small>}
            </section>
          )}
          {selectedBlockade && (
            <section className="context-primary-actions blockade-actions">
              <div className="context-unit-title"><ShipIcon type="blockade" color={game.players[selectedBlockade.owner].color}/><span><b>Blockade Platform</b><small>Owner: {game.players[selectedBlockade.owner].name} · {selectedBlockade.hex} · 4 defensive CS</small></span></div>
              <small className="context-reason">Open Borders with the owner permits harmless passage. Otherwise entering this hex triggers Blockade combat, which never awards Glory.</small>
              {selectedBlockade.owner === playerId && <>
                <button onClick={() => { openDiplomacy(); setContextOpen(false); }}>Sell in Diplomacy</button>
                {[...new Set(activeAgreements(game).filter((agreement) => agreement.parties.includes(playerId!)).flatMap((agreement) => agreement.parties).filter((id) => id !== playerId))].map((partnerId) => <button key={partnerId} disabled={!canDraft} onClick={() => { setDraft((current) => [...current.filter((order) => order.kind !== "transferBlockade" || order.blockadeId !== selectedBlockade.id), { id: uid("blockade-transfer"), kind: "transferBlockade", blockadeId: selectedBlockade.id, toPlayerId: partnerId }]); notify(`Blockade gift to ${game.players[partnerId].name} added to Orders.`); setContextOpen(false); }}>Gift to {game.players[partnerId].name}</button>)}
              </>}
            </section>
          )}
          {mapUnit && (
            <section className="context-primary-actions">
              <div className="context-unit-title">
                <ShipIcon type={mapUnit.icon} color={player?.color} />
                <span>
                  <b>{selectedUnitName}</b>
                  <small>Currently at {mapUnit.hex}</small>
                </span>
                {unitDraftIndex(mapUnit) >= 0 && (
                  <mark>Order {unitDraftIndex(mapUnit) + 1}</mark>
                )}
              </div>
              <button
                className="primary"
                disabled={!canDraft || !canMoveSelected}
                onClick={() => {
                  setUnitIntent("move");
                  setContextOpen(false);
                }}
              >
                Move
              </button>
              {selectedExplorer &&
                explorationLibrary[selectedExplorer.type].tech >= 2 && (
                  <button
                    disabled={!canDraft}
                    onClick={() => {
                      setUnitIntent("publicScan");
                      setContextOpen(false);
                    }}
                  >
                    Publicly scan adjacent sector
                  </button>
                )}
              {mapUnit.kind === "explorer" &&
                player?.faction === "farbound" && (
                  <button
                    disabled={
                      !canDraft || player.forwardScanUsedTurn === game.turn
                    }
                    onClick={() => {
                      setUnitIntent("farboundScan");
                      setContextOpen(false);
                    }}
                  >
                    {player.forwardScanUsedTurn === game.turn
                      ? "Forward Scan used this Turn"
                      : "Private Forward Scan"}
                  </button>
                )}
              {mapUnit.kind === "explorer" && player?.faction === "wayfarers" && player.tech.Exploration >= 2 && (
                <button disabled={!canDraft || player.deepReconUsedTurn === game.turn} onClick={() => { setUnitIntent("wayfarerRecon"); setContextOpen(false); }}>Private Deep Recon</button>
              )}
              {mapUnit.kind === "colony" && (
                <button
                  disabled={!canDraft || !!establishReason}
                  title={establishReason}
                  onClick={() => {
                    draftEstablish();
                    setContextOpen(false);
                  }}
                >
                  Establish Habitat
                </button>
              )}
              {selectedCivilian?.type === "prospector" && (
                <button
                  disabled={!canDraft || !!prospectReason}
                  title={prospectReason}
                  onClick={() => {
                    draftProspect();
                    setContextOpen(false);
                  }}
                >
                  Prospect this world
                </button>
              )}
              {selectedCivilian?.type === "surveyor" && (
                <button
                  disabled={
                    !canDraft ||
                    player?.surveyUsedTurn === game.turn ||
                    selectedCivilian.usedTurn === game.turn ||
                    selectedCivilian.readyTurn > game.turn
                  }
                  onClick={() => {
                    setUnitIntent("longRangeSurvey");
                    setContextOpen(false);
                  }}
                >
                  Long-Range Survey
                </button>
              )}
              <button
                disabled={!canDraft}
                onClick={() => {
                  setDraft((current) => removeUnitOrders(current, mapUnit));
                  notify(`${selectedUnitName} will Hold.`);
                  setContextOpen(false);
                }}
              >
                Hold and clear Order
              </button>
              {mapUnit.kind === "colony" && establishReason && (
                <small className="context-reason">{establishReason}</small>
              )}
              {selectedCivilian?.type === "prospector" && prospectReason && (
                <small className="context-reason">{prospectReason}</small>
              )}
            </section>
          )}
          {selectedCarrier && (
            <section className="context-primary-actions">
              <div className="context-unit-title">
                <ShipIcon type={selectedCarrier.type} color={player?.color} />
                <span>
                  <b>{carrierLibrary[selectedCarrier.type].name}</b>
                  <small>
                    {selectedCarrier.cu}/
                    {carrierLibrary[selectedCarrier.type].capacity} CU ·{" "}
                    {selectedCarrier.movesRemaining} movement · {selectedCarrierLoadedBlockades.length}/
                    {blockadeCargoCapacity(selectedCarrier)} Blockades
                  </small>
                </span>
                {carrierDraftIndex(selectedCarrier.id) >= 0 && (
                  <mark>Order {carrierDraftIndex(selectedCarrier.id) + 1}</mark>
                )}
              </div>
              {<button
                className="primary"
                disabled={
                  !canDraft ||
                  selectedCarrier.readyTurn > game.turn ||
                  selectedCarrier.movesRemaining < 1 ||
                  selectedCarrier.cu < 1 || selectedCarrierBombardTwo || selectedCarrierCargoDrafted
                }
                onClick={() => {
                  setMilitaryTargeting(true);
                  setContextOpen(false);
                }}
                title={selectedCarrierCargoDrafted ? "Loading or deploying a Blockade requires this vessel to remain stationary." : selectedCarrierBombardTwo ? "Bombardment 2 requires this vessel to remain stationary." : undefined}
              >
                Move vessel
              </button>}
              {(carrierLibrary[selectedCarrier.type].bombard || 0) > 0 && (
                <button
                  className="primary bombard-action"
                  disabled={!canDraft || selectedCarrier.readyTurn > game.turn}
                  onClick={() => {
                    setUnitIntent(null);
                    setMilitaryTargeting(false);
                    setBuildTargeting(false);
                    setBombardCarrierId(selectedCarrier.id);
                    setBombardStrength((carrierLibrary[selectedCarrier.type].bombard || 1) >= 2 && !selectedCarrierMoveDrafted ? 2 : 1);
                    setContextOpen(false);
                  }}
                >
                  {(carrierLibrary[selectedCarrier.type].bombard || 0) >= 2
                    ? selectedCarrierMoveDrafted
                      ? "Bombard 1 (moved)"
                      : "Bombard 2 (hold position)"
                    : "Bombard a highlighted hex"}
                </button>
              )}
              {(carrierLibrary[selectedCarrier.type].bombard || 0) >= 2 && !selectedCarrierMoveDrafted && (
                <button disabled={!canDraft || selectedCarrier.readyTurn > game.turn} onClick={() => { setBombardStrength(1); setBombardCarrierId(selectedCarrier.id); setContextOpen(false); }}>Bombard 1 and retain movement option</button>
              )}
              {selectedCarrier.type === "blockadeTender" && (() => {
                const blockadeConstruction = { type: "blockade" as const };
                const quote = constructionQuote(viewGame, player!.id, selectedCarrier.hex, blockadeConstruction);
                return <button
                  className="primary"
                  disabled={!canDraft || !quote.available}
                  title={quote.reason}
                  onClick={() => {
                    openBuildAt(selectedCarrier.hex);
                  }}
                >Build Blockade Platform<small>{formatPurchaseCost(quote.cost)}</small></button>;
              })()}
              {selectedCarrierLoadableBlockades.map((blockade) => <button
                key={`load-${blockade.id}`}
                className="primary"
                disabled={!canDraft || selectedCarrierMoveDrafted || selectedCarrierBombardDrafted || selectedCarrierProjectedCargo >= blockadeCargoCapacity(selectedCarrier)}
                title={selectedCarrierMoveDrafted || selectedCarrierBombardDrafted ? "Remove this vessel's movement or Bombardment Order first." : selectedCarrierProjectedCargo >= blockadeCargoCapacity(selectedCarrier) ? "This vessel's Blockade cargo is full." : undefined}
                onClick={() => {
                  setDraft((current) => [...current.filter((order) => order.kind !== "blockadeCargo" || order.blockadeId !== blockade.id), { id: uid("blockade-load"), kind: "blockadeCargo", blockadeId: blockade.id, carrierId: selectedCarrier.id, action: "load" }]);
                  notify(`${blockade.id} will load onto ${selectedCarrier.id}.`);
                  setContextOpen(false);
                }}
              >Load Blockade <small>{blockade.id}</small></button>)}
              {selectedCarrierLoadedBlockades.map((blockade) => {
                const alreadyOccupied = game.blockades.some((candidate) => candidate.id !== blockade.id && candidate.active && candidate.hex === selectedCarrier.hex);
                return <button
                  key={`deploy-${blockade.id}`}
                  className="primary"
                  disabled={!canDraft || selectedCarrierMoveDrafted || selectedCarrierBombardDrafted || alreadyOccupied || selectedCarrierDeployDrafted}
                  title={selectedCarrierMoveDrafted || selectedCarrierBombardDrafted ? "Remove this vessel's movement or Bombardment Order first." : alreadyOccupied || selectedCarrierDeployDrafted ? "Only one active Blockade may occupy a hex." : undefined}
                  onClick={() => {
                    setDraft((current) => [...current.filter((order) => order.kind !== "blockadeCargo" || order.blockadeId !== blockade.id), { id: uid("blockade-deploy"), kind: "blockadeCargo", blockadeId: blockade.id, carrierId: selectedCarrier.id, action: "deploy" }]);
                    notify(`${blockade.id} will deploy at ${selectedCarrier.hex}.`);
                    setContextOpen(false);
                  }}
                >Deploy Blockade <small>{blockade.id}</small></button>;
              })}
              <button
                disabled={busy || selectedHex.combat < 1}
                onClick={() =>
                  void onCommand({
                    kind: "transferCombatUnit",
                    carrierId: selectedCarrier.id,
                    direction: "load",
                  })
                }
              >
                Load 1 stationed CU
              </button>
              <button
                disabled={busy || selectedCarrier.cu < 1}
                onClick={() =>
                  void onCommand({
                    kind: "transferCombatUnit",
                    carrierId: selectedCarrier.id,
                    direction: "unload",
                  })
                }
              >
                Station 1 CU
              </button>
              <button
                onClick={() => {
                  setPanel("military");
                  setDockOpen(true);
                  setContextOpen(false);
                }}
              >
                Open Fleet Command
              </button>
            </section>
          )}
          {!mapUnit && !selectedCarrier && !selectedMobileHabitat && !selectedBlockade && (
            <>
              <section className="context-hex-summary">
                <HexDetails game={viewGame} hex={selectedHex} />
                <span>
                  <b>
                    {selectedHex.revealed ? selectedHex.kind : "Unrevealed"}
                  </b>
                  <small>
                    {selectedHex.owner === undefined
                      ? "No controlling faction"
                      : `Controlled by ${game.players[selectedHex.owner].name}`}
                  </small>
                </span>
                {selectedHex.tier && (
                  <span>
                    <b>{selectedHex.tier}</b>
                    <small>
                      {selectedHex.combat} stationed CU ·{" "}
                      {selectedHex.centers.length} Centers
                    </small>
                  </span>
                )}
              </section>
              {selectedHexUnits.length > 0 && (
                <section className="context-unit-stack">
                  <h4>Vessels in this hex</h4>
                  {selectedHexUnits.map((item) => (
                    <button
                      key={item.key}
                      disabled={item.owner !== playerId}
                      onClick={() => {
                        if (item.unit) selectMapUnit(item.unit);
                        else if (item.carrierId) {
                          setTaskForceIds([item.carrierId]);
                          setMapUnit(null);
                          setSelectedReachAssetId(null);
                        }
                      }}
                    >
                      <ShipIcon
                        type={item.icon}
                        color={game.players[item.owner].color}
                      />
                      <span>
                        <b>{item.label}</b>
                        <small>
                          {item.owner === playerId
                            ? "Select for actions"
                            : game.players[item.owner].name}
                        </small>
                      </span>
                    </button>
                  ))}
                </section>
              )}
              {player && selectedHex.owner === player.id && selectedHex.tier && (
                <section className="quick-construction">
                  <h4>Build at this Habitat</h4>
                  <p>
                    Open the complete Build menu for standard construction and
                    every faction-specific unit, upgrade, and operation.
                  </p>
                  <button className="primary" onClick={() => openBuildAt(selectedHex.id)}>
                    <span><b>Open complete Build menu</b><small>All construction options</small></span>
                  </button>
                </section>
              )}
              {selectedHex.owner !== undefined &&
                selectedHex.owner !== playerId &&
                playerId !== undefined && (
                  <button
                    className="context-diplomacy-link"
                    onClick={() => {
                      openDiplomacy(selectedHex.owner);
                      setContextOpen(false);
                    }}
                  >
                    Open Diplomacy with {game.players[selectedHex.owner].name}
                  </button>
                )}
              {!selectedHexUnits.length && !(player && selectedHex.owner === player.id && selectedHex.tier) && (
                <p className="context-empty">
                  No direct actions are available here. Select a friendly vessel
                  or one of your Habitats for contextual actions.
                </p>
              )}
            </>
          )}
        </aside>
      )}
      {fullScreenPanels.includes(panel) && (player || panel === "academy") && (
        <div className="network-workspace-overlay">
          <section className="network-workspace">
            <header className="workspace-bar">
              <div>
                <span>NETWORK COMMAND WORKSPACE</span>
                <b>{panelLabels[panel].label}</b>
              </div>
              <button onClick={() => setPanel("map")}>Return to map</button>
            </header>
            <div className="workspace-scroll">
              {player && panel === "diplomacy" && (
                <NetworkDiplomacyPanel
                  key={diplomacyTargetId ?? "default"}
                  game={viewGame}
                  draft={draft}
                  playerId={player.id}
                  busy={busy}
                  onCommand={async (command) => {
                    if (canDraft && !sealedSubmission && JSON.stringify(session.privateDraft || []) !== JSON.stringify(draft))
                      await onCommand({ kind: "saveDraft", orders: draft });
                    await onCommand(command);
                  }}
                  initialTargetId={diplomacyTargetId}
                />
              )}
              {player && panel === "communications" && (
                <NetworkCommsPanel
                  session={session}
                  busy={busy}
                  selectedHexId={selectedHex.id}
                  onCommand={onCommand}
                  onOpenProposal={(proposalId) => {
                    const proposal = game.proposals.find((candidate) => candidate.id === proposalId);
                    if (proposal) setDiplomacyTargetId(proposal.kind === "technology" ? (proposal.seller === player.id ? proposal.buyer : proposal.seller) : (proposal.from === player.id ? proposal.to : proposal.from));
                    setPanel("diplomacy");
                  }}
                  onOpenHex={(hexId) => focusHex(hexId)}
                />
              )}
              {panel === "academy" && <FactionAcademy selectedFaction={player?.faction} />}
            </div>
          </section>
        </div>
      )}
      {spectator && (
        <div className="spectator-floating">
          {session.summary.mode === "local" && game.spectatorMode && <button onClick={() => void onCommand({ kind: "beginOrders" })}>{game.orderProtocol.phase === "negotiation" ? "Run next Turn" : "Advance simulation"}</button>}
          <button onClick={onToggleSpectator}>
            {spectatorPaused ? "Resume updates" : "Pause updates"}
          </button>
          {[
            [700, "Fast"],
            [1200, "Live"],
            [3000, "Slow"],
          ].map(([milliseconds, label]) => (
            <button
              key={milliseconds}
              className={pollMs === milliseconds ? "active" : ""}
              onClick={() => onPollMs?.(milliseconds as number)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {(hiddenRequired || policyVoteRequired) && player && game.scenarioId !== "first-horizon" && (
        <div className="handoff-overlay hidden-required-overlay">
          <div className="hidden-required-card">
            <p>ERA {game.era} OPENING DECISIONS</p>
            <h1>{hiddenRequired ? "Select your Hidden Legacy" : "Seal your Policy ballot"}</h1>
            <span>
              Choose your private objective and seal a Policy ballot before entering this Era. Abstaining is always allowed.
            </span>
            <NetworkLegacyPanel
              game={viewGame}
              playerId={player.id}
              busy={busy}
              onCommand={onCommand}
            />
          </div>
        </div>
      )}
      {localHandoff && player && <div className="handoff-overlay local-command-handoff"><div className="handoff-card"><p>PRIVATE COMMAND HANDOFF</p><h1>Pass the device to {player.name}</h1><span>The next civilization&apos;s resources, objectives, and Orders remain hidden until they take command.</span><button className="primary" onClick={() => setLocalHandoff(false)}>Take command</button></div></div>}
      {captureOwner === playerId && captureHexId && (
        <div className="handoff-overlay capture-overlay">
          <div className="handoff-card">
            <p>CAPTURE RESOLUTION // {captureHexId}</p>
            <h1>Choose {captureCount} Center to destroy</h1>
            <div className="captured-centers">
              {capturedCenters.map((center, index) => (
                <button
                  key={`${center}-${index}`}
                  disabled={busy}
                  onClick={() =>
                    void onCommand({
                      kind: "removeCapturedCenter",
                      centerIndex: index,
                    })
                  }
                >
                  <b>
                    {center === "defense" ? "Defense Grid" : `${center} Center`}
                  </b>
                  <small>Destroy this Center</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {["lobby", "paused"].includes(session.summary.status) && (
        <div ref={lobbyOverlayRef} className="handoff-overlay beta-room-overlay">
          <div className="beta-room-card">
            <RoomLobby
              session={session}
              busy={busy}
              onCommand={onCommand}
              onRefresh={onRefresh}
              onLeave={onLeave}
              onExportReport={onExportReport}
            />
          </div>
        </div>
      )}
      {game.result && <EndgameResults game={game} newGame={onLeave} onExportReport={session.role === "host" ? onExportReport : undefined} onRematch={session.role === "host" ? onRematch : undefined} initialFeedback={session.feedback} onSubmitFeedback={spectator ? undefined : async (feedback) => { await onCommand({ kind: "submitFeedback", ...feedback }); }} />}
      {sealReviewOpen && player && !sealedSubmission && <div className="seal-review-overlay" role="dialog" aria-modal="true" aria-labelledby="seal-review-title" onClick={(event) => { if (event.target === event.currentTarget) setSealReviewOpen(false); }}>
        <section className="seal-review-card">
          <header><span>TURN {game.turn} · PRIVATE ORDER REVIEW</span><h2 id="seal-review-title">Confirm sealed Orders</h2></header>
          <div className="seal-review-list">{draft.length ? draft.map((order, index) => <div key={order.id}><b>{index + 1}</b><span>{orderLabel(order)} · {formatPurchaseCost(draftCosts[index])}</span></div>) : <p>No Orders queued. Confirming issues Hold for this Turn.</p>}</div>
          <div className="seal-review-summary"><span>Projected cost</span><b>{formatPurchaseCost(totalOrderCost(viewGame, player.id, draft))}</b><span>Remaining</span><b className={budget?.error ? "warning" : ""}>{budget?.error || `${budgetResources.map((resource) => `${budget?.remaining.resources[resource] ?? 0}${resource[0].toUpperCase()}`).join(" · ")} · ${budget?.remaining.labor ?? 0}L`}</b></div>
          {((game.turn - 1) % 4 === 0 && !hidden?.selected) && <p className="seal-review-warning">Select your Hidden Legacy objective before sealing.</p>}
          <footer><button onClick={() => setSealReviewOpen(false)}>Cancel</button><button className="primary" disabled={!canDraft || busy || sealingOrders || !!budget?.error || ((game.turn - 1) % 4 === 0 && !hidden?.selected)} onClick={() => void sealOrders({ kind: "submitOrders", orders: draft })}>{sealingOrders ? "Sealing..." : "Confirm and seal Orders"}</button></footer>
        </section>
      </div>}
      {replayOpen && <TurnReplayOverlay game={game} initialTurn={replayTurn} close={() => setReplayOpen(false)} />}
      {factionStatusId !== null && <FactionStatusOverlay game={game} playerId={factionStatusId} close={() => setFactionStatusId(null)} openDiplomacy={playerId !== undefined && factionStatusId !== playerId ? openDiplomacy : undefined} />}
    </main>
  );
}
