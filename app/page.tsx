"use client";
/* eslint-disable react/jsx-no-comment-textnodes, react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DiplomacyHandoff from "./components/DiplomacyHandoff";
import DiplomacyPanel from "./components/DiplomacyPanel";
import {
  FleetCommandPanel,
} from "./components/FleetOperations";
import BuildPanel from "./components/BuildPanel";
import TechnologyPanel from "./components/TechnologyPanel";
import CaptureDecision from "./components/CaptureDecision";
import LegacyPanel from "./components/LegacyPanel";
import EndgameResults from "./components/EndgameResults";
import FactionOperations from "./components/FactionOperations";
import OrdersPanel from "./components/OrdersPanel";
import BotIntelligencePanel from "./components/BotIntelligencePanel";
import SimulationControls from "./components/SimulationControls";
import ShipIcon from "./components/ShipIcon";
import {
  RemoteRoomView,
  RoomConsole,
} from "./components/MultiplayerRooms";
import ApplicationShell from "./components/ApplicationShell";
import StartupScreen from "./components/StartupScreen";
import FirstHorizonGuide from "./components/FirstHorizonGuide";
import { hexColumnClass, mapCanvasDimensions } from "./lib/map-geometry";
import HorizonCodex from "./components/HorizonCodex";
import TurnResolutionSummary from "./components/TurnResolutionSummary";
import { tributeCosts } from "../game/rules/economy";
import {
  clearGame,
  carrierLibrary,
  beginSecretOrders,
  civilianLibrary,
  createGame,
  evaluateLegacy,
  factionIds,
  factionLibrary,
  getNeighbors,
  hasBenefit,
  loadGame,
  marketExchange,
  mapLibrary,
  mapIds,
  moveCarriers,
  orderLabel,
  formatPurchaseCost,
  projectedOrderBudget,
  refreshContacts,
  resolveBotCaptureDecision,
  resolveSecretOrders,
  saveGame,
  takeBotTurn,
  totalCombatUnits,
  gameFormats,
  finalEra,
  gateTarget,
  totalTurns,
  createFirstHorizon,
  createFactionAcademy,
} from "../game";
import { getBotProfile } from "../bots";
import { explorationIcon, tileAssetFor, type ShipIconType } from "../game/themes/assets";
import { loadInstalledContent } from "./lib/content-client";
import { recordOnboardingEvent } from "./lib/onboarding-telemetry";
import { downloadCloudSave, listCloudSaves, uploadCloudSave } from "./lib/cloud-client";
import { createLocalRoom } from "./lib/room-client";
import type {
  CommandMode as Mode,
  ContentCatalog,
  FactionId,
  GameState as Game,
  HexKind as Kind,
  HexState as Hex,
  Resource,
  RoomSession,
  SecretOrder,
  ThemeId,
  PlayerController,
  GameFormatId,
} from "../game";

const LABEL: Record<Kind, string> = {
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

type MapUnitSelection =
  | { kind: "explorer"; id: "explorer"; hexId: string }
  | { kind: "colony"; id: "colony"; hexId: string }
  | { kind: "carrier"; id: string; hexId: string }
  | { kind: "civilian"; id: string; hexId: string };

type MapOrderAction =
  | "move"
  | "hold"
  | "establish"
  | "prospect"
  | "longRangeSurvey";

function createMapOrderId(kind: string) {
  return `map-${kind}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`}`;
}

export default function Home() {
  const router = useRouter();
  const launchInProgress = useRef(false);
  const [launchBusy, setLaunchBusy] = useState(false);
  const [started, setStarted] = useState(false),
    [startupReady, setStartupReady] = useState(false),
    [startupMinimumElapsed, setStartupMinimumElapsed] = useState(false),
    [count, setCount] = useState(6),
    [chosen, setChosen] = useState<FactionId[]>(factionIds),
    [selectedMapId, setSelectedMapId] = useState("standard-board"),
    [gameFormat, setGameFormat] = useState<GameFormatId>("four-era"),
    [contentCatalog, setContentCatalog] = useState<ContentCatalog | null>(null),
    [contentError, setContentError] = useState(""),
    [theme, setTheme] = useState<ThemeId>("horizon-base"),
    [seatControllers, setSeatControllers] = useState<string[]>(Array(6).fill("human")),
    [simulationPaused, setSimulationPaused] = useState(false),
    [simulationSpeed, setSimulationSpeed] = useState(650),
    [game, setGame] = useState<Game | null>(null),
    [remoteRoom, setRemoteRoom] = useState<RoomSession | null>(null),
    [panel, setPanel] = useState("orders"),
    [orderDraft, setOrderDraft] = useState<SecretOrder[]>([]),
    [mapUnit, setMapUnit] = useState<MapUnitSelection | null>(null),
    [mapIntent, setMapIntent] = useState<MapOrderAction | null>(null),
    [buildTargeting, setBuildTargeting] = useState(false),
    [buildHexId, setBuildHexId] = useState<string | null>(null),
    [mapZoom, setMapZoom] = useState(1),
    [mapDragging, setMapDragging] = useState(false),
    [launchError, setLaunchError] = useState(""),
    [notice, setNotice] = useState(""),
    [codexEntry, setCodexEntry] = useState<string | null>(null),
    [briefDismissedTurn, setBriefDismissedTurn] = useState(0),
    [cloudReady, setCloudReady] = useState(false),
    mapViewportRef = useRef<HTMLDivElement>(null),
    mapDragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null),
    [handoff, setHandoff] = useState<{
      proposalId: string;
      stage: "pass" | "review" | "return";
    } | null>(null);
  // Loading a device-local playtest is intentionally a one-time hydration step.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => setStartupMinimumElapsed(true), 1500);
    void loadInstalledContent()
      .then((catalog) => {
        if (cancelled) return;
        setContentCatalog(catalog);
        const saved = loadGame();
        if (saved) {
          if (!mapLibrary[saved.mapId] || saved.players.some((player) => !factionLibrary[player.faction])) {
            setContentError("A saved game requires a content pack that is not installed.");
            return;
          }
          setGame(saved);
          setTheme(saved.themeId);
        }
        void listCloudSaves().then(async(saves)=>{
          if(saved){setCloudReady(true);return;}
          const current=saves.filter(save=>!save.conflictOf).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
          if(current){const cloud=await downloadCloudSave(current.id);setGame(cloud.payload);setTheme(cloud.payload.themeId);localStorage.setItem(`horizon-cloud-revision:${current.slotId}`,String(current.revision));}
          setCloudReady(true);
        }).catch(()=>setCloudReady(true));
      })
      .catch((error) => !cancelled && setContentError(error instanceof Error ? error.message : "Content catalog failed to load."))
      .finally(() => !cancelled && setStartupReady(true));
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);
  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);
  useEffect(()=>{
    if(!game||!cloudReady)return;
    const slot=game.scenarioId==="first-horizon"?"first-horizon":game.scenarioId==="faction-academy"?"academy":"solo",timer=window.setTimeout(()=>{
      const revision=Number(localStorage.getItem(`horizon-cloud-revision:${slot}`)||0);
      void uploadCloudSave(game,revision).then(result=>{if(result.status==="saved"&&result.save)localStorage.setItem(`horizon-cloud-revision:${slot}`,String(result.save.revision));else if(result.status==="conflict"&&result.current)localStorage.setItem(`horizon-cloud-revision:${slot}`,String(result.current.revision));}).catch(()=>undefined);
    },1200);
    return()=>window.clearTimeout(timer);
  },[game,cloudReady]);
  function advanceBotAutomation() {
    setPanel("orders");
    setOrderDraft([]);
    setGame((current) => {
      if (!current || current.result) return current;
      const next = structuredClone(current);
      if (next.pendingCenterLoss) {
        const controller = next.players[next.pendingCenterLoss.playerId].controller;
        if (controller.kind === "bot") {
          const profile = getBotProfile(controller.profileId);
          if (profile) resolveBotCaptureDecision(next, profile);
        }
        return next;
      }
      const allBots = next.players.every((player) => player.controller.kind === "bot");
      if (next.orderProtocol.phase === "negotiation" && allBots) {
        beginSecretOrders(next);
        return next;
      }
      if (next.orderProtocol.phase === "ready" && allBots) {
        resolveSecretOrders(next);
        return next;
      }
      const controller = next.players[next.active].controller;
      if (next.orderProtocol.phase !== "orders" || controller.kind !== "bot") return current;
      const profile = getBotProfile(controller.profileId);
      if (!profile) {
        next.log.unshift(`Bot profile ${controller.profileId} could not be loaded; the seat is paused.`);
        return next;
      }
      takeBotTurn(next, next.active, profile);
      return next;
    });
  }
  useEffect(() => {
    if (!game || game.result) return;
    const activePlayer = game.players[game.active];
    const allBots = game.players.every((player) => player.controller.kind === "bot");
    const pendingBotCapture = game.pendingCenterLoss && game.players[game.pendingCenterLoss.playerId].controller.kind === "bot";
    const shouldNegotiate = game.orderProtocol.phase === "negotiation" && allBots;
    const shouldPlan = game.orderProtocol.phase === "orders" &&
      game.orderProtocol.currentPlayer === game.active && activePlayer.controller.kind === "bot";
    const shouldResolve = game.orderProtocol.phase === "ready" && allBots;
    if (!shouldNegotiate && !shouldPlan && !shouldResolve && !pendingBotCapture) return;
    if (game.spectatorMode && simulationPaused) return;
    const timer = window.setTimeout(() => {
      advanceBotAutomation();
    }, game.spectatorMode ? simulationSpeed : shouldResolve ? 700 : 450);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.active, game?.turn, game?.orderProtocol.phase, game?.orderProtocol.submissions.length, game?.result, game?.spectatorMode, simulationPaused, simulationSpeed]);
  useEffect(() => {
    setMapUnit(null);
    setMapIntent(null);
    setBuildTargeting(false);
    setBuildHexId(null);
  }, [game?.active, game?.orderProtocol.phase]);
  const update = (fn: (g: Game) => void) =>
    setGame((old) => {
      if (!old) return old;
      const g = structuredClone(old);
      fn(g);
      return g;
    });
  const flash = (s: string) => {
    setNotice(s);
    window.setTimeout(() => setNotice(""), 2200);
  };
  const configuredFactions = () => {
    const next = chosen.slice(0, count);
    while (next.length < count) {
      const available = factionIds.find((id) => !next.includes(id));
      next.push(available || factionIds[next.length % factionIds.length]);
    }
    return next;
  };
  const configuredControllers = () => Array.from({ length: count }, (_, index) => seatControllers[index] || "human")
    .map<PlayerController>((id) => id === "human" ? { kind: "human" } : { kind: "bot", profileId: id });
  const launchLocalRoom = async (nextGame: Game) => {
    if (launchInProgress.current) return;
    launchInProgress.current = true;
    setLaunchBusy(true);
    setLaunchError("");
    try {
      const session = await createLocalRoom(nextGame);
      router.push(`/room/${session.code}`);
    } catch (cause) {
      launchInProgress.current = false;
      setLaunchBusy(false);
      setLaunchError(cause instanceof Error ? cause.message : "The room could not be created.");
    }
  };
  const map = mapLibrary[game?.mapId || selectedMapId] || mapLibrary["shattered-reach"],
    mapCanvas = mapCanvasDimensions(map.columns, map.rows),
    p = game?.players[game.active],
    selected = game?.hexes.find((h) => h.id === game.selected),
    goal = game ? gateTarget(game) : (gameFormats[gameFormat].eras - 1) * count;
  const description = (h: Hex) =>
    h.kind === "rift"
      ? "Fractured void"
      : !h.revealed
        ? !game?.spectatorMode && p?.privateSurveys.find((survey) => survey.hexId === h.id)
          ? `Private survey: ${p.privateSurveys.find((survey) => survey.hexId === h.id)!.kind} sector`
          : "Uncharted"
        : h.kind === "home"
          ? map.regions[h.id] || "Homeworld"
          : `${h.kind[0].toUpperCase() + h.kind.slice(1)} sector`;

  const mapUnitKey = (unit: MapUnitSelection) =>
    unit.kind === "carrier" || unit.kind === "civilian"
      ? `${unit.kind}:${unit.id}`
      : unit.kind;

  function orderBelongsToUnit(order: SecretOrder, unit: MapUnitSelection) {
    const key = mapUnitKey(unit);
    if (order.kind === "hold") return order.id.startsWith(`map-hold-${key}--`);
    if (unit.kind === "explorer") return order.kind === "explorerMove";
    if (unit.kind === "colony")
      return order.kind === "colonyMove" || order.kind === "establish";
    if (unit.kind === "carrier")
      return order.kind === "carrierMove" && order.carrierIds.includes(unit.id);
    return (
      (order.kind === "civilianMove" ||
        order.kind === "prospect" ||
        order.kind === "longRangeSurvey") &&
      order.unitId === unit.id
    );
  }

  function addMapOrder(order: SecretOrder, unit: MapUnitSelection) {
    setOrderDraft((current) => [
      ...current.filter((candidate) => !orderBelongsToUnit(candidate, unit)),
      order,
    ]);
    setMapIntent(null);
    flash("Order added to the private draft.");
  }

  function legalMapTargets(action: MapOrderAction, unit = mapUnit) {
    if (!game || !p || !unit) return [] as string[];
    const at = game.hexes.find((hex) => hex.id === unit.hexId);
    if (!at) return [] as string[];
    if (action === "establish") {
      return unit.kind === "colony" &&
        p.modules > 0 &&
        at.revealed &&
        at.owner === undefined &&
        !["rift", "hazard", "anomaly", "empty"].includes(at.kind)
        ? [at.id]
        : [];
    }
    if (action === "prospect") {
      const vessel = game.civilianUnits.find((candidate) => candidate.id === unit.id);
      return unit.kind === "civilian" &&
        vessel?.type === "prospector" &&
        vessel.readyTurn <= game.turn &&
        vessel.movesRemaining > 0 &&
        at.revealed &&
        at.owner === undefined &&
        !at.prospected &&
        ["material", "currency", "research", "influence", "labor", "barren"].includes(at.kind)
        ? [at.id]
        : [];
    }
    if (action === "longRangeSurvey") {
      const vessel = unit.kind === "civilian"
        ? game.civilianUnits.find((candidate) => candidate.id === unit.id)
        : undefined;
      if (vessel?.type !== "surveyor" || vessel.readyTurn > game.turn || p.surveyUsedTurn === game.turn)
        return [] as string[];
      return game.hexes
        .filter((hex) => !hex.revealed && hex.kind !== "rift" && !p.privateSurveys.some((survey) => survey.hexId === hex.id))
        .map((hex) => hex.id);
    }
    if (unit.kind === "carrier") {
      const carrier = game.carriers.find((candidate) => candidate.id === unit.id);
      if (!carrier || carrier.readyTurn > game.turn || carrier.movesRemaining < 1 || carrier.cu < 1)
        return [] as string[];
    }
    if (unit.kind === "civilian") {
      const civilian = game.civilianUnits.find((candidate) => candidate.id === unit.id);
      if (!civilian || civilian.readyTurn > game.turn || civilian.movesRemaining < 1)
        return [] as string[];
    }
    const neighbors = getNeighbors(unit.hexId, map);
    if (action !== "move") return [] as string[];
    return neighbors.filter((id) => {
      const hex = game.hexes.find((candidate) => candidate.id === id);
      if (!hex || hex.kind === "rift") return false;
      if (unit.kind === "explorer") return true;
      return hex.revealed;
    });
  }

  function selectMapUnit(unit: MapUnitSelection) {
    setMapUnit(unit);
    setMapIntent(null);
    setBuildTargeting(false);
    setBuildHexId(null);
    setPanel("orders");
    update((draft) => {
      draft.selected = unit.hexId;
    });
    if (game?.orderProtocol.phase !== "orders")
      flash("Vessel Orders become available after beginning the secret Orders handoff.");
  }

  function chooseMapAction(action: MapOrderAction) {
    if (!game || !p || !mapUnit) return;
    if (game.orderProtocol.phase !== "orders") {
      setPanel("orders");
      flash("Begin secret Orders before assigning vessel actions.");
      return;
    }
    if (action === "hold") {
      const key = mapUnitKey(mapUnit);
      addMapOrder(
        {
          id: `map-hold-${key}--${createMapOrderId("hold")}`,
          kind: "hold",
          label: `${mapUnitName(mapUnit)} Hold`,
        },
        mapUnit,
      );
      return;
    }
    const targets = legalMapTargets(action);
    if (!targets.length) {
      const reason = (() => {
        if (action === "establish") {
          const hex = game.hexes.find((candidate) => candidate.id === mapUnit.hexId);
          if (mapUnit.kind !== "colony") return "Only a Colony Ship can establish a Habitat.";
          if (!p.modules) return "Construct a Habitat Module before establishing another Habitat.";
          if (!hex?.revealed) return "Reveal this sector before attempting settlement.";
          if (hex.owner !== undefined) return "That world is already controlled.";
          return "Habitats require a revealed resource or barren world. Empty space and Anomalies cannot be settled.";
        }
        if (mapUnit.kind === "carrier") {
          const carrier = game.carriers.find((candidate) => candidate.id === mapUnit.id);
          if (!carrier?.cu) return "Load at least 1 Combat Unit before this carrier can move.";
          if (carrier.readyTurn > game.turn) return `This vessel becomes ready on Turn ${carrier.readyTurn}.`;
          if (carrier.movesRemaining < 1) return "This vessel has no movement remaining this Turn.";
        }
        if (mapUnit.kind === "civilian") {
          const civilian = game.civilianUnits.find((candidate) => candidate.id === mapUnit.id);
          if (civilian && civilian.readyTurn > game.turn) return `This vessel becomes ready on Turn ${civilian.readyTurn}.`;
          if (civilian && civilian.movesRemaining < 1) return "This vessel has already acted this Turn.";
        }
        return "No legal target is in range. Select a highlighted adjacent sector or choose Hold.";
      })();
      flash(reason);
      return;
    }
    setMapIntent(action);
    flash(targets.length === 1 ? "Click the highlighted hex to confirm." : "Select a highlighted target hex.");
  }

  function mapUnitName(unit: MapUnitSelection) {
    if (!game) return "Vessel";
    if (unit.kind === "explorer") return "Exploration Vessel";
    if (unit.kind === "colony") return "Colony Ship";
    if (unit.kind === "carrier") {
      const carrier = game.carriers.find((candidate) => candidate.id === unit.id);
      return carrier ? carrierLibrary[carrier.type].name : "Carrier";
    }
    const civilian = game.civilianUnits.find((candidate) => candidate.id === unit.id);
    return civilian ? civilianLibrary[civilian.type].name : "Civilian Vessel";
  }

  function setBoundedZoom(next: number) {
    setMapZoom(Math.min(1.6, Math.max(0.4, Number(next.toFixed(2)))));
  }

  function fitBoard() {
    const viewport = mapViewportRef.current;
    if (!viewport) return;
    setBoundedZoom(
      Math.min(
        (viewport.clientWidth - 28) / mapCanvas.width,
        (viewport.clientHeight - 28) / mapCanvas.height,
        1.12,
      ),
    );
    viewport.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  function centerSelected() {
    const viewport = mapViewportRef.current;
    const target = viewport?.querySelector<HTMLElement>(
      `[data-hex-id="${game?.selected}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }

  useEffect(() => {
    if (!started || !game) return;
    setMapZoom(1);
    const timer = window.setTimeout(centerSelected, 50);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, game?.mapId, game?.active]);

  function clickHex(id: string) {
    if (!game || !p) return;
    const h = game.hexes.find((x) => x.id === id)!;
    if (panel === "build" && (buildTargeting || !buildHexId) && game.orderProtocol.phase === "orders") {
      if (h.owner !== p.id || !h.tier) {
        flash("Choose one of the highlighted Habitats with an available Construction Order.");
        return;
      }
      setBuildHexId(id);
      setBuildTargeting(false);
      update((draft) => { draft.selected = id; });
      flash(`Construction location selected: ${id}.`);
      return;
    }
    if (mapUnit && mapIntent && game.orderProtocol.phase === "orders") {
      if (!legalMapTargets(mapIntent, mapUnit).includes(id)) {
        flash("Choose one of the highlighted legal targets.");
        return;
      }
      const stamp = createMapOrderId("target");
      let order: SecretOrder;
      if (mapIntent === "move" && mapUnit.kind === "explorer")
        order = { id: `map-explorer-${stamp}`, kind: "explorerMove", destination: id };
      else if (mapIntent === "move" && mapUnit.kind === "colony")
        order = { id: `map-colony-${stamp}`, kind: "colonyMove", destination: id };
      else if (mapIntent === "move" && mapUnit.kind === "carrier")
        order = { id: `map-carrier-${stamp}`, kind: "carrierMove", carrierIds: [mapUnit.id], destination: id };
      else if (mapIntent === "move" && mapUnit.kind === "civilian")
        order = { id: `map-civilian-${stamp}`, kind: "civilianMove", unitId: mapUnit.id, destination: id };
      else if (mapIntent === "longRangeSurvey" && mapUnit.kind === "civilian")
        order = { id: `map-survey-${stamp}`, kind: "longRangeSurvey", unitId: mapUnit.id, hexId: id };
      else if (mapIntent === "establish")
        order = { id: `map-establish-${stamp}`, kind: "establish", hexId: id };
      else if (mapIntent === "prospect" && mapUnit.kind === "civilian")
        order = { id: `map-prospect-${stamp}`, kind: "prospect", unitId: mapUnit.id };
      else {
        flash("That vessel cannot perform the selected action.");
        return;
      }
      addMapOrder(order, mapUnit);
      update((draft) => {
        draft.selected = id;
      });
      return;
    }
    if (game.mode === "inspect") {
      update((g) => {
        g.selected = id;
      });
      return;
    }
    if (game.mode === "establish") {
      if (
        id !== p.colonyShip ||
        !h.revealed ||
        ["rift", "hazard", "anomaly", "empty"].includes(h.kind) ||
        h.owner !== undefined
      ) {
        flash("The Colony Ship must occupy a revealed, claimable world.");
        return;
      }
      if (!p.modules) {
        flash("No Habitat Module is loaded.");
        return;
      }
      update((g) => {
        const pp = g.players[g.active],
          hh = g.hexes.find((x) => x.id === id)!;
        pp.modules--;
        hh.owner = pp.id;
        hh.tier = "Outpost";
        pp.legacyMetrics.habitatsEstablished[g.era - 1]++;
        if (pp.faction === "farbound" && hh.surveyedBy?.includes(pp.id)) {
          pp.resources.material++;
          pp.resources.currency++;
          if (
            !pp.legacyMetrics.discountedHabitats.some((x) =>
              x.startsWith(`era-${g.era}:`),
            )
          )
            pp.labor = Math.min(pp.laborCap, pp.labor + 1);
          pp.legacyMetrics.discountedHabitats.push(`era-${g.era}:${id}`);
          g.log.unshift(
            `${pp.name} applied its Surveyed Habitat discount at ${id}.`,
          );
        }
        g.selected = id;
        g.mode = "inspect";
        g.log.unshift(`${pp.name} established an Outpost at ${id}.`);
        evaluateLegacy(g);
      });
      return;
    }
    if (game.mode === "fleet") {
      const draft = structuredClone(game),
        result = moveCarriers(draft, p.id, game.selectedCarrierIds, id);
      flash(result.message);
      if (result.ok) {
        evaluateLegacy(draft);
        setGame(draft);
      }
      return;
    }
    const key = game.mode === "explore" ? "explorer" : "colonyShip",
      origin = p[key],
      remaining =
        game.mode === "explore" ? game.moves.explorer : game.moves.colony;
    if (
      !remaining ||
      !getNeighbors(origin, map).includes(id) ||
      h.kind === "rift"
    ) {
      flash("That vessel cannot move there now.");
      return;
    }
    if (game.mode !== "explore" && !h.revealed) {
      flash("Only Exploration vessels may enter unrevealed hexes.");
      return;
    }
    if (
      h.owner !== undefined &&
      h.owner !== p.id &&
      !hasBenefit(game, p.id, h.owner, "openBorders")
    ) {
      flash(
        "Open Borders is required to enter another civilization's Habitat.",
      );
      return;
    }
    update((g) => {
      const pp = g.players[g.active],
        hh = g.hexes.find((x) => x.id === id)!;
      if (g.mode === "explore") {
        pp.explorer = id;
        g.moves.explorer--;
        if (!hh.revealed) {
          hh.revealed = true;
          pp.legacyMetrics.revealedHexes[g.era - 1]++;
          if (hh.kind === "anomaly") {
            pp.resources.research++;
            hh.anomalyResolvedBy = pp.id;
            g.log.unshift(
              `${pp.name} revealed an Anomaly and gained 1 Research.`,
            );
          }
        }
      } else if (g.mode === "colony") {
        pp.colonyShip = id;
        g.moves.colony--;
      }
      g.selected = id;
      refreshContacts(g);
      evaluateLegacy(g);
    });
  }

  function addTributeOrder() {
    if (!game || !p || game.gate >= goal) return;
    const order: SecretOrder = {
      id: `tribute-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
      kind: "tribute",
    };
    const nextDraft = game.era === finalEra(game)
      ? [...orderDraft, order]
      : [...orderDraft.filter((candidate) => candidate.kind !== "tribute"), order];
    const budget = projectedOrderBudget(game, p.id, nextDraft);
    if (budget.error) {
      flash(budget.error);
      return;
    }
    setOrderDraft(nextDraft);
    flash("Gate Tribute added to the private draft.");
  }
  function market(give: Resource, get: Resource) {
    if (!game || !p) return;
    update((g) => {
      const result = marketExchange(g, g.active, give, get);
      flash(result.message);
      if (result.ok) evaluateLegacy(g);
    });
  }
  const stats = useMemo(
    () =>
      game
        ? [...game.players]
            .map((x) => ({
              id: x.id,
              name: x.name,
              lp: x.lp,
              habitats: game.hexes.filter((h) => h.owner === x.id && h.tier)
                .length,
              cu: totalCombatUnits(game, x.id),
              color: x.color,
            }))
            .sort((a, b) => b.lp - a.lp)
        : [],
    [game],
  );
  if (!startupReady || !startupMinimumElapsed) return <StartupScreen stage={!startupReady ? "Loading content registry" : "Connecting command interface"} />;
  if (remoteRoom)
    return (
      <RemoteRoomView
        initial={remoteRoom}
        close={() => setRemoteRoom(null)}
      />
    );
  if (!started || !game)
    return (
      <ApplicationShell
        launchBusy={launchBusy}
        contentCatalog={contentCatalog}
        contentError={launchError || contentError || (contentCatalog?.issues.length ? `${contentCatalog.issues.length} content pack(s) were rejected. Check server logs.` : "")}
        hasLocalGame={Boolean(game)}
        count={count}
        setCount={setCount}
        chosen={chosen}
        setChosen={setChosen}
        selectedMapId={selectedMapId}
        setSelectedMapId={setSelectedMapId}
        gameFormat={gameFormat}
        setGameFormat={setGameFormat}
        theme={theme}
        setTheme={setTheme}
        seatControllers={seatControllers}
        setSeatControllers={setSeatControllers}
        createLocal={() => void launchLocalRoom(createGame(count, configuredFactions(), selectedMapId, theme, undefined, configuredControllers(), false, gameFormat))}
        startTutorial={() => {
          setCount(3);
          setChosen(["foundry", "helix", "varkesh"]);
          setSeatControllers(["human", "tutorial-guide", "tutorial-guide"]);
          recordOnboardingEvent("tutorial-started", 0);
          void launchLocalRoom(createFirstHorizon(theme));
        }}
        startFactionTraining={(factionId) => {
          const rivals = factionIds.filter((id) => id !== factionId).slice(0, 2);
          setCount(3);
          setChosen([factionId, ...rivals]);
          setSeatControllers(["human", "tutorial-guide", "tutorial-guide"]);
          void launchLocalRoom(createFactionAcademy(factionId, theme));
        }}
        quickStart={() => {
          recordOnboardingEvent("quick-start");
          const random = crypto.getRandomValues(new Uint32Array(32));
          const quickCount = 4 + random[0] % 3;
          const compatibleMaps = mapIds.filter((id) => {
            const candidate = mapLibrary[id];
            return quickCount >= (candidate.minPlayers || 1) && quickCount <= (candidate.maxPlayers || candidate.starts.length);
          });
          const quickMap = compatibleMaps[random[1] % compatibleMaps.length];
          const shuffled = [...factionIds];
          for (let index = shuffled.length - 1; index > 0; index--) {
            const swap = random[index + 2] % (index + 1);
            [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
          }
          const quickFactions = shuffled.slice(0, quickCount);
          const quickControllers: PlayerController[] = quickFactions.map((_, index) => index === 0 ? { kind: "human" } : { kind: "bot", profileId: "ai-medium" });
          const quickSeed = random[20] % 1_000_000;
          setCount(quickCount);
          setChosen(quickFactions);
          setSelectedMapId(quickMap);
          setSeatControllers(quickControllers.map((controller) => controller.kind === "human" ? "human" : controller.profileId));
          void launchLocalRoom(createGame(quickCount, quickFactions, quickMap, theme, quickSeed, quickControllers, false, "four-era"));
        }}
        runSimulation={() => {
          const controllers = factionIds.slice(0, 6).map<PlayerController>(() => ({ kind: "bot", profileId: "ai-emperor" }));
          setCount(6);
          setChosen(factionIds.slice(0, 6));
          setSeatControllers(Array(6).fill("ai-emperor"));
          setSimulationPaused(false);
          setSimulationSpeed(650);
          void launchLocalRoom(createGame(6, factionIds.slice(0, 6), "standard-board", theme, undefined, controllers, true, gameFormat));
        }}
        gameFactory={() => createGame(count, configuredFactions(), selectedMapId, theme, undefined, configuredControllers(), false, gameFormat)}
        startHost={(session) => router.push(`/room/${session.code}`)}
        openRemote={setRemoteRoom}
        continueLocal={() => { if(game){if(game.scenarioId==="first-horizon") recordOnboardingEvent("tutorial-resumed",game.tutorial?.step);void launchLocalRoom(game);} }}
      />
    );

  const buildSelectionActive = panel === "build" && (buildTargeting || !buildHexId),
    buildableHabitats = game.hexes
      .filter((hex) => hex.owner === p!.id && hex.tier)
      .map((hex) => hex.id),
    activeMapTargets = buildSelectionActive ? buildableHabitats : mapIntent ? legalMapTargets(mapIntent) : [],
    selectedMapCarrier = mapUnit?.kind === "carrier"
      ? game.carriers.find((carrier) => carrier.id === mapUnit.id)
      : undefined,
    selectedMapCivilian = mapUnit?.kind === "civilian"
      ? game.civilianUnits.find((unit) => unit.id === mapUnit.id)
      : undefined,
    selectedMapShipType: ShipIconType | null = !mapUnit
      ? null
      : mapUnit.kind === "explorer"
        ? explorationIcon(p!.tech.Exploration)
        : mapUnit.kind === "colony"
          ? "colonyShip"
          : mapUnit.kind === "carrier"
            ? selectedMapCarrier?.type || null
            : selectedMapCivilian?.type || null,
    selectedMapOrder = mapUnit
      ? orderDraft.find((order) => orderBelongsToUnit(order, mapUnit))
      : undefined;

  return (
    <main
      className="game-shell"
      data-theme={game.themeId}
      data-spectator={game.spectatorMode}
      data-map-columns={map.columns}
      data-map-rows={map.rows}
      style={{
        "--player": p!.color,
        "--map-columns": map.columns,
        "--map-rows": map.rows,
      } as React.CSSProperties}
    >
      <header className="topbar">
        <img src="/horizon-logo.png" alt="Horizon" />
        <div className="turn-id">
          <span>ERA {game.era}</span>
          <strong>TURN {game.turn} / {totalTurns(game)}</strong>
        </div>
        <div className="gate-mini">
          <div>
            <span>HORIZON GATE</span>
            <strong>
              {game.gate} / {goal}
            </strong>
          </div>
          <div className="gate-track">
            <i
              style={{ width: `${Math.min(100, (game.gate / goal) * 100)}%` }}
            />
          </div>
        </div>
        <button className="ghost" onClick={() => setCodexEntry("getting-started")}>Rules</button>
        <button
          className="ghost"
          onClick={() => {
            if (confirm("Start a new game?")) {
              clearGame();
              setStarted(false);
              setGame(null);
            }
          }}
        >
          New game
        </button>
      </header>
      {game.spectatorMode && <SimulationControls game={game} paused={simulationPaused} speed={simulationSpeed} setPaused={setSimulationPaused} setSpeed={setSimulationSpeed} step={advanceBotAutomation}/>} 
      {notice && <div className="notice">{notice}</div>}
      {game.resolutionBriefs?.find((brief) => brief.playerId === p!.id && brief.turn > briefDismissedTurn) && <TurnResolutionSummary brief={game.resolutionBriefs.find((brief) => brief.playerId === p!.id && brief.turn > briefDismissedTurn)!} close={() => setBriefDismissedTurn(game.resolutionBriefs!.find((brief) => brief.playerId === p!.id)!.turn)} />}
      {codexEntry && <div className="game-codex-overlay" role="dialog" aria-modal="true" aria-label="Horizon Codex"><div><header><span>HORIZON CODEX</span><button onClick={() => setCodexEntry(null)}>Close</button></header><HorizonCodex initialEntryId={codexEntry} compact /></div></div>}
      <section className="play-area">
        <aside className="left-rail">
          <div className="identity">
            <span>ACTIVE CIVILIZATION</span>
            <h2>{p!.name}</h2>
            <p>{factionLibrary[p!.faction].role}</p>
          </div>
          <div className="resources">
            {(
              ["material", "currency", "research", "influence"] as Resource[]
            ).map((r) => (
              <div key={r}>
                <i className={r}>{r[0].toUpperCase()}</i>
                <small>{r}</small>
                <strong>{p!.resources[r]}</strong>
              </div>
            ))}
            <div>
              <i className="labor">L</i>
              <small>Labor</small>
              <strong>
                {p!.labor}/{p!.laborCap}
              </strong>
            </div>
          </div>
          <nav>
            {[
              ["orders", "Orders"],
              ["command", "Military"],
              ["build", "Build"],
              ["tech", "Tech"],
              ["gate", "Gate"],
              ["market", "Market"],
              ["diplomacy", "Diplomacy"],
              ["faction", "Faction"],
              ["network", "Network"],
              ["legacy", "Legacy"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={panel === id ? "active" : ""}
                disabled={game.spectatorMode}
                onClick={() => {
                  setPanel(id);
                  setMapIntent(null);
                  setMapUnit(null);
                  if (id === "build") {
                    setBuildHexId(null);
                    setBuildTargeting(true);
                  } else setBuildTargeting(false);
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <fieldset className="action-panel" disabled={game.spectatorMode}>
            {panel === "orders" && (
              <OrdersPanel
                game={game}
                commit={setGame}
                flash={flash}
                draft={orderDraft}
                setDraft={setOrderDraft}
                openDiplomacy={() => setPanel("diplomacy")}
                openLegacy={() => setPanel("legacy")}
              />
            )}
            {panel === "command" && (
              <>
                <div className="mode-grid">
                  {(
                    [
                      ["inspect", "Inspect"],
                      ["explore", `Explorer ${game.moves.explorer}`],
                      ["colony", `Colony ${game.moves.colony}`],
                      ["fleet", "Task Force"],
                      ["establish", "Establish"],
                    ] as [Mode, string][]
                  ).map(([m, l]) => (
                    <button
                      className={game.mode === m ? "selected" : ""}
                      onClick={() =>
                        update((g) => {
                          g.mode = m;
                        })
                      }
                      key={m}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {game.mode === "fleet" ? (
                  <FleetCommandPanel
                    game={game}
                    commit={setGame}
                    flash={flash}
                  />
                ) : (
                  <>
                    <h3 className="subhead">Civilian command</h3>
                    <p>
                      Select a vessel and click an adjacent hex. Only
                      Exploration vessels may enter uncharted space.
                    </p>
                    <div className="unit-readout">
                      <span>
                        Explorer <b>{p!.explorer}</b>
                      </span>
                      <span>
                        Colony ship <b>{p!.colonyShip}</b>
                      </span>
                      <span>
                        Habitat Modules <b>{p!.modules}</b>
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
            {panel === "build" && (
              <BuildPanel
                game={game}
                habitatId={buildHexId}
                draft={orderDraft}
                setDraft={setOrderDraft}
                flash={flash}
                selectHabitat={() => {
                  setBuildHexId(null);
                  setBuildTargeting(true);
                }}
              />
            )}
            {panel === "tech" && (
              <TechnologyPanel
                game={game}
                draft={orderDraft}
                setDraft={setOrderDraft}
                flash={flash}
              />
            )}
            {panel === "gate" && (
              <>
                <h3>Horizon Gate</h3>
                <div className="gate-number">
                  {game.gate}
                  <span>/ {goal}</span>
                </div>
                <p>
                  Era {game.era} cost:{" "}
                  {game.era === 1
                    ? "1M · 1C"
                    : game.era === 2
                      ? "1M · 1C · 1R"
                      : game.era === 3
                        ? "2M · 1C · 1R · 1L"
                        : "2M · 2C · 2R · 1L · 1I"}
                </p>
                <button className="primary" disabled={game.gate >= goal} onClick={addTributeOrder}>
                  {game.gate >= goal ? "Gate Complete" : "Add Tribute Order"}
                </button>
                <small className="muted">{formatPurchaseCost(tributeCosts[game.era])}</small>
                <small className="muted">
                  {p!.tributes} contributed by {p!.name}
                </small>
                <small className="muted">
                  Simultaneous overflow Tributes are all paid and credited. The shared Gate total stops at {goal}.
                </small>
              </>
            )}
            {panel === "market" && (
              <>
                <h3>System Market</h3>
                <p>
                  Economy {p!.tech.Economy}. Labor cannot enter the Market.
                  Aurelians at Policy II can exchange 2 Influence for 1 Material,
                  Currency, or Research.
                </p>
                <div className="market-list">
                  <button onClick={() => market("currency", "material")}>
                    Currency → Material
                  </button>
                  <button onClick={() => market("currency", "research")}>
                    Currency → Research
                  </button>
                  <button onClick={() => market("material", "currency")}>
                    Material → Currency
                  </button>
                  <button onClick={() => market("research", "currency")}>
                    Research → Currency
                  </button>
                  {p!.faction === "aurelians" && p!.tech.Policy >= 2 && (["material", "currency", "research"] as const).map((resource) =>
                    <button key={`influence-${resource}`} onClick={() => market("influence", resource)}>
                      Influence → {resource}
                    </button>)}
                </div>
                <label className="score-adjust">
                  Manual LP{" "}
                  <button
                    onClick={() =>
                      update((g) => {
                        const pp = g.players[g.active];
                        if (pp.legacy.manual > 0) {
                          pp.legacy.manual--;
                          pp.lp--;
                        }
                      })
                    }
                  >
                    −
                  </button>
                  <strong>{p!.legacy.manual}</strong>
                  <button
                    onClick={() =>
                      update((g) => {
                        const pp = g.players[g.active];
                        pp.legacy.manual++;
                        pp.lp++;
                      })
                    }
                  >
                    +
                  </button>
                </label>
              </>
            )}
            {panel === "diplomacy" && (
              <>
                <h3>Diplomacy console</h3>
                <p>
                  Negotiate direct trades, establish formal agreements, and
                  privately hand proposals to another player.
                </p>
                <div className="unit-readout">
                  <span>
                    Contacts <b>{p!.diplomacy.contacts.length}</b>
                  </span>
                  <span>
                    Agreements{" "}
                    <b>
                      {
                        game.agreements.filter((a) => a.parties.includes(p!.id))
                          .length
                      }
                    </b>
                  </span>
                  <span>
                    Incoming{" "}
                    <b>
                      {
                        game.proposals.filter(
                          (x) =>
                            x.status === "pending" &&
                            (x.kind === "technology"
                              ? x.buyer === p!.id
                              : x.to === p!.id),
                        ).length
                      }
                    </b>
                  </span>
                </div>
              </>
            )}
            {panel === "faction" && (
              <FactionOperations
                game={game}
                commit={setGame}
                flash={flash}
                negotiationOnly
              />
            )}
            {panel === "network" && <RoomConsole game={game} />}
          </fieldset>
          <button className="end-turn" disabled={game.spectatorMode} onClick={() => setPanel("orders")}>
            Open Orders console
          </button>
        </aside>
        {panel === "legacy" ? (
          <LegacyPanel game={game} commit={setGame} flash={flash} />
        ) : panel === "diplomacy" ? (
          <DiplomacyPanel
            game={game}
            commit={setGame}
            flash={flash}
            review={(proposalId) => setHandoff({ proposalId, stage: "pass" })}
          />
        ) : (
          <section className="map-wrap">
            <div className="map-header">
              <div>
                <p>
                  {map.name.toUpperCase()} // CARTOGRAPHY SEED {game.seed}
                </p>
                <h1>{description(selected!)}</h1>
              </div>
              <div className="legend">
                <span>
                  <i className="world-key" />
                  World
                </span>
                <span>
                  <i className="fleet-key" />
                  Fleet
                </span>
                <span>
                  <i className="anomaly-key" />
                  Anomaly
                </span>
                <span>
                  <i className="unknown-key" />
                  Uncharted
                </span>
              </div>
              <div className="map-controls" aria-label="Map view controls">
                <button onClick={() => setBoundedZoom(mapZoom - 0.1)} aria-label="Zoom out">−</button>
                <span>{Math.round(mapZoom * 100)}%</span>
                <button onClick={() => setBoundedZoom(mapZoom + 0.1)} aria-label="Zoom in">+</button>
                <button onClick={fitBoard}>Fit</button>
                <button onClick={centerSelected}>Center</button>
              </div>
            </div>
            {panel === "build" && (
              <div className={`build-map-prompt ${buildSelectionActive ? "targeting" : "selected"}`}>
                <div><span>BUILD ORDER</span><b>{buildSelectionActive ? "Select a highlighted Habitat" : `Construction at ${buildHexId}`}</b></div>
                <small>{buildSelectionActive ? `${buildableHabitats.length} legal construction location${buildableHabitats.length === 1 ? "" : "s"}` : "Choose an available construction option in the Build panel"}</small>
              </div>
            )}
            {mapUnit && selectedMapShipType && (
              <div className={`map-order-bar ${mapIntent ? "targeting" : ""}`}>
                <ShipIcon
                  type={selectedMapShipType}
                  color={p!.color}
                  title={mapUnitName(mapUnit)}
                />
                <div className="map-order-unit">
                  <span>SELECTED VESSEL</span>
                  <b>{mapUnitName(mapUnit)}</b>
                  <small>{mapUnit.hexId}{selectedMapOrder ? ` · ${orderLabel(selectedMapOrder)}` : " · No Order drafted"}</small>
                </div>
                <div className="map-order-actions" aria-label="Vessel actions">
                  <button className={mapIntent === "move" ? "active" : ""} onClick={() => chooseMapAction("move")}>Move</button>
                  {mapUnit.kind === "colony" && <button className={mapIntent === "establish" ? "active" : ""} onClick={() => chooseMapAction("establish")}>Establish</button>}
                  {selectedMapCivilian?.type === "prospector" && <button className={mapIntent === "prospect" ? "active" : ""} onClick={() => chooseMapAction("prospect")}>Prospect</button>}
                  {selectedMapCivilian?.type === "surveyor" && <button className={mapIntent === "longRangeSurvey" ? "active" : ""} onClick={() => chooseMapAction("longRangeSurvey")}>Long-Range Survey</button>}
                  <button onClick={() => chooseMapAction("hold")}>Hold</button>
                  <button className="cancel" onClick={() => { setMapUnit(null); setMapIntent(null); }}>Close</button>
                </div>
                {mapIntent && <div className="map-target-prompt"><b>Select target hex</b><span>{activeMapTargets.length} legal target{activeMapTargets.length === 1 ? "" : "s"} highlighted</span></div>}
              </div>
            )}
            <div
              className={`map-viewport ${mapDragging ? "dragging" : ""} ${mapIntent || buildSelectionActive ? "targeting" : ""}`}
              ref={mapViewportRef}
              onPointerDown={(event) => {
                const target = event.target as HTMLElement;
                if (event.button !== 1 && target.closest(".hex, .map-unit")) return;
                const viewport = mapViewportRef.current;
                if (!viewport) return;
                mapDragRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                  left: viewport.scrollLeft,
                  top: viewport.scrollTop,
                };
                setMapDragging(true);
                viewport.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const start = mapDragRef.current;
                const viewport = mapViewportRef.current;
                if (!start || !viewport) return;
                viewport.scrollLeft = start.left - (event.clientX - start.x);
                viewport.scrollTop = start.top - (event.clientY - start.y);
              }}
              onPointerUp={() => {
                mapDragRef.current = null;
                setMapDragging(false);
              }}
              onPointerCancel={() => {
                mapDragRef.current = null;
                setMapDragging(false);
              }}
              onWheel={(event) => {
                if (!event.ctrlKey && !event.metaKey) return;
                event.preventDefault();
                setBoundedZoom(mapZoom + (event.deltaY < 0 ? 0.08 : -0.08));
              }}
            >
              <div
                className="map-scale"
                style={{
                  width: mapCanvas.width * mapZoom,
                  height: mapCanvas.height * mapZoom,
                }}
              >
                <div className="map-stage" style={{ width: mapCanvas.width, height: mapCanvas.height, transform: `scale(${mapZoom})` }}>
                  <div className="sector-orbit orbit-one" />
                  <div className="sector-orbit orbit-two" />
                  <div className="hex-map">
                {game.hexes.map((h) => {
                  const fleets = game.carriers.filter(
                      (carrier) => carrier.hex === h.id,
                    ),
                    fleetCU = fleets.reduce(
                      (sum, carrier) => sum + carrier.cu,
                      0,
                    ),
                    privateSurvey = !game.spectatorMode && !h.revealed
                      ? p!.privateSurveys.find((survey) => survey.hexId === h.id)
                      : undefined,
                    visibleKind = h.revealed ? h.kind : privateSurvey?.kind;
                  return (
                    <button
                      key={h.id}
                      data-hex-id={h.id}
                      aria-label={`${h.id} ${description(h)}${fleets.length ? ` ${fleets.length} carriers ${fleetCU} CU` : ""}`}
                      onClick={() => clickHex(h.id)}
                      className={`hex ${hexColumnClass(h.col)} ${h.kind} ${!h.revealed ? "concealed" : ""} ${privateSurvey ? "privately-surveyed" : ""} ${game.selected === h.id ? "selected" : ""} ${activeMapTargets.includes(h.id) ? "legal-target" : ""}`}
                      style={
                        {
                          gridColumn: h.col + 1,
                          gridRow: h.row + 1,
                          "--owner":
                            h.owner !== undefined
                              ? game.players[h.owner]?.color
                              : "transparent",
                        } as React.CSSProperties
                      }
                    >
                      <span className="hex-inner">
                        <img
                          className="tile-art"
                          src={tileAssetFor(map, visibleKind || "empty", Boolean(visibleKind))}
                          alt=""
                          aria-hidden="true"
                          draggable={false}
                        />
                        {h.revealed && h.kind !== "rift" && (
                          <>
                            <small>{h.id}</small>
                            <b>{LABEL[h.kind]}</b>
                            {h.tier && <em>{h.tier[0]}</em>}
                            {h.centers.length > 0 && <u>{h.centers.length}C</u>}
                          </>
                        )}
                        {!h.revealed && privateSurvey && (
                          <span className="private-survey-badge">PRIVATE SURVEY</span>
                        )}
                      </span>
                    </button>
                  );
                })}
                  </div>
                  <div className={`unit-layer ${buildSelectionActive ? "build-targeting" : ""}`} aria-label="Vessels">
                    {game.hexes.map((h) => {
                      const explorers = game.players.filter((owner) => owner.explorer === h.id),
                        colonies = game.players.filter((owner) => owner.colonyShip === h.id),
                        civilians = game.civilianUnits.filter((unit) => unit.hex === h.id),
                        carriers = game.carriers.filter((carrier) => carrier.hex === h.id);
                      return (
                        <div
                          className={`unit-cell ${hexColumnClass(h.col)}`}
                          key={`units-${h.id}`}
                          style={{ gridColumn: h.col + 1, gridRow: h.row + 1 }}
                        >
                          {explorers.map((owner) => (
                            <button
                              key={`map-explorer-${owner.id}`}
                              className={`map-unit explorer ${mapUnit?.kind === "explorer" && owner.id === p!.id ? "selected" : ""}`}
                              style={{ "--unit-color": owner.color } as React.CSSProperties}
                              aria-label={`${owner.name} Exploration Vessel`}
                              onClick={() => owner.id === p!.id ? selectMapUnit({ kind: "explorer", id: "explorer", hexId: h.id }) : flash(`${owner.name} Exploration Vessel`)}
                              title={`${owner.name} Exploration Vessel`}
                            >
                              <ShipIcon type={explorationIcon(owner.tech.Exploration)} color={owner.color} />
                            </button>
                          ))}
                          {colonies.map((owner) => (
                            <button
                              key={`map-colony-${owner.id}`}
                              className={`map-unit colony ${mapUnit?.kind === "colony" && owner.id === p!.id ? "selected" : ""}`}
                              style={{ "--unit-color": owner.color } as React.CSSProperties}
                              aria-label={`${owner.name} Colony Ship`}
                              onClick={() => owner.id === p!.id ? selectMapUnit({ kind: "colony", id: "colony", hexId: h.id }) : flash(`${owner.name} Colony Ship`)}
                              title={`${owner.name} Colony Ship`}
                            >
                              <ShipIcon type="colonyShip" color={owner.color} />
                            </button>
                          ))}
                          {civilians.map((unit) => {
                            const owner = game.players[unit.owner];
                            return (
                              <button
                                key={`map-${unit.id}`}
                                className={`map-unit civilian ${mapUnit?.kind === "civilian" && mapUnit.id === unit.id ? "selected" : ""}`}
                                style={{ "--unit-color": owner.color } as React.CSSProperties}
                                aria-label={`${owner.name} ${civilianLibrary[unit.type].name}`}
                                onClick={() => owner.id === p!.id ? selectMapUnit({ kind: "civilian", id: unit.id, hexId: h.id }) : flash(`${owner.name} ${civilianLibrary[unit.type].name}`)}
                                title={`${owner.name} ${civilianLibrary[unit.type].name}`}
                              >
                                <ShipIcon type={unit.type} color={owner.color} />
                              </button>
                            );
                          })}
                          {carriers.map((carrier) => {
                            const owner = game.players[carrier.owner];
                            return (
                              <button
                                key={`map-${carrier.id}`}
                                className={`map-unit carrier ${mapUnit?.kind === "carrier" && mapUnit.id === carrier.id ? "selected" : ""}`}
                                style={{ "--unit-color": owner.color } as React.CSSProperties}
                                aria-label={`${owner.name} ${carrierLibrary[carrier.type].name}, ${carrier.cu} CU`}
                                onClick={() => owner.id === p!.id ? selectMapUnit({ kind: "carrier", id: carrier.id, hexId: h.id }) : flash(`${owner.name} ${carrierLibrary[carrier.type].name} · ${carrier.cu} CU`)}
                                title={`${owner.name} ${carrierLibrary[carrier.type].name}, ${carrier.cu} CU`}
                              >
                                <ShipIcon type={carrier.type} color={owner.color} />
                                <small>{carrier.cu}</small>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="selected-card">
              <div>
                <span>SELECTED HEX {selected!.id}</span>
                <strong>{description(selected!)}</strong>
              </div>
              <div>
                {selected!.owner !== undefined && (
                  <>
                    <span>CONTROL</span>
                    <strong
                      style={{ color: game.players[selected!.owner].color }}
                    >
                      {game.players[selected!.owner].name}
                    </strong>
                  </>
                )}
              </div>
              <div>
                {selected!.tier && (
                  <>
                    <span>HABITAT</span>
                    <strong>
                      {selected!.tier} · {selected!.centers.length} Centers ·{" "}
                      {selected!.combat} stationed CU
                    </strong>
                  </>
                )}
                <span>FLEETS</span>
                <strong>
                  {
                    game.carriers.filter(
                      (carrier) => carrier.hex === selected!.id,
                    ).length
                  }{" "}
                  carriers ·{" "}
                  {game.carriers
                    .filter((carrier) => carrier.hex === selected!.id)
                    .reduce((sum, carrier) => sum + carrier.cu, 0)}{" "}
                  CU
                </strong>
              </div>
            </div>
          </section>
        )}
        <aside className="right-rail">
          {game.scenarioId === "first-horizon" && <FirstHorizonGuide game={game} commit={setGame} openPanel={setPanel} openCodex={setCodexEntry} />}
          <section>
            <div className="section-title">
              <span>Standing</span>
              <small>LP</small>
            </div>
            {stats.map((s, i) => (
              <div className="standing" key={s.id}>
                <i style={{ background: s.color }} />
                <b>{i + 1}</b>
                <span>{s.name.replace("The ", "")}</span>
                <small>
                  {s.habitats} Hab · {s.cu} CU
                </small>
                <strong>{s.lp}</strong>
              </div>
            ))}
          </section>
          <section>
            <div className="section-title">
              <span>Legacy profile</span>
              <small>{p!.lp} LP</small>
            </div>
            <p className="faction-blurb">{factionLibrary[p!.faction].blurb}</p>
            <div className="legacy-mini">
              <span>
                Universal <b>{p!.legacy.universal}</b>
              </span>
              <span>
                Hidden <b>{p!.legacy.hidden}</b>
              </span>
              <span>
                Civilization <b>{p!.legacy.civilization}</b>
              </span>
              <span>
                Faction <b>{p!.legacy.faction}</b>
              </span>
            </div>
            <button className="wide" disabled={game.spectatorMode} onClick={() => setPanel("legacy")}>
              {p!.hiddenLegacy[game.era]?.selected
                ? "Open Legacy Archive"
                : "Choose Era Hidden Legacy"}
            </button>
          </section>
          <BotIntelligencePanel game={game}/>
          <section className="log">
            <div className="section-title">
              <span>System record</span>
            </div>
            {game.log.slice(0, 7).map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </section>
        </aside>
      </section>
      {handoff && (
        <DiplomacyHandoff
          game={game}
          proposalId={handoff.proposalId}
          stage={handoff.stage}
          setStage={(stage) => setHandoff({ ...handoff, stage })}
          commit={setGame}
          close={() => setHandoff(null)}
          flash={flash}
        />
      )}
      {game.pendingCenterLoss && (
        <CaptureDecision game={game} commit={setGame} flash={flash} />
      )}
      <EndgameResults
        game={game}
        newGame={() => {
          clearGame();
          setStarted(false);
          setGame(null);
        }}
      />
    </main>
  );
}
