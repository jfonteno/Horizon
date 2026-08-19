"use client";
/* eslint-disable react/jsx-no-comment-textnodes, react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
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
  RoomSetup,
} from "./components/MultiplayerRooms";
import { tributeCosts } from "../game/rules/economy";
import {
  clearGame,
  carrierLibrary,
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
  moveCarriers,
  orderLabel,
  formatPurchaseCost,
  projectedOrderBudget,
  refreshContacts,
  resolveBotCaptureDecision,
  resolveSecretOrders,
  saveGame,
  takeBotTurn,
  themeIds,
  themeLibrary,
  totalCombatUnits,
} from "../game";
import { botProfiles, getBotProfile } from "../bots";
import { explorationIcon, tileAssets, type ShipIconType } from "../game/themes/assets";
import type {
  CommandMode as Mode,
  FactionId,
  GameState as Game,
  HexKind as Kind,
  HexState as Hex,
  Resource,
  RoomSession,
  SecretOrder,
  ThemeId,
  PlayerController,
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

const MAP_CANVAS_WIDTH = 1420;
const MAP_CANVAS_HEIGHT = 1260;

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
  | "forwardScan"
  | "longRangeSurvey";

function createMapOrderId(kind: string) {
  return `map-${kind}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`}`;
}

export default function Home() {
  const [started, setStarted] = useState(false),
    [count, setCount] = useState(6),
    [chosen, setChosen] = useState<FactionId[]>(factionIds),
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
    [notice, setNotice] = useState(""),
    mapViewportRef = useRef<HTMLDivElement>(null),
    mapDragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null),
    [handoff, setHandoff] = useState<{
      proposalId: string;
      stage: "pass" | "review" | "return";
    } | null>(null);
  // Loading a device-local playtest is intentionally a one-time hydration step.
  useEffect(() => {
    const saved = loadGame();
    if (saved) {
      setGame(saved);
      setTheme(saved.themeId);
      setStarted(true);
    }
  }, []);
  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);
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
    const shouldPlan = game.orderProtocol.phase === "orders" &&
      game.orderProtocol.currentPlayer === game.active && activePlayer.controller.kind === "bot";
    const shouldResolve = game.orderProtocol.phase === "ready" && allBots;
    if (!shouldPlan && !shouldResolve && !pendingBotCapture) return;
    if (game.spectatorMode && simulationPaused) return;
    const timer = window.setTimeout(() => {
      advanceBotAutomation();
    }, game.spectatorMode ? simulationSpeed : shouldResolve ? 700 : 450);
    return () => window.clearTimeout(timer);
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
  const configuredControllers = () => seatControllers.slice(0, count).map<PlayerController>((id) =>
    id === "human" ? { kind: "human" } : { kind: "bot", profileId: id },
  );
  const map = mapLibrary[game?.mapId || "shattered-reach"],
    p = game?.players[game.active],
    selected = game?.hexes.find((h) => h.id === game.selected),
    goal = (game?.players.length || count) * 3;
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
    if (unit.kind === "explorer")
      return order.kind === "explorerMove" || order.kind === "forwardScan";
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
        .filter((hex) => !hex.revealed && hex.kind !== "rift")
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
    if (action === "forwardScan") {
      if (p.faction !== "farbound" || p.forwardScanUsedTurn === game.turn)
        return [] as string[];
      return neighbors.filter((id) => {
        const hex = game.hexes.find((candidate) => candidate.id === id);
        return hex && !hex.revealed && hex.kind !== "rift";
      });
    }
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
    if (!game || !mapUnit) return;
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
      flash("That action has no legal target right now.");
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
        (viewport.clientWidth - 28) / MAP_CANVAS_WIDTH,
        (viewport.clientHeight - 28) / MAP_CANVAS_HEIGHT,
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
  }, [started, game?.mapId, game?.active]);

  function clickHex(id: string) {
    if (!game || !p) return;
    const h = game.hexes.find((x) => x.id === id)!;
    if (panel === "build" && (buildTargeting || !buildHexId) && game.orderProtocol.phase === "orders") {
      if (h.owner !== p.id || !h.tier || h.constructionUsedTurn === game.turn) {
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
      else if (mapIntent === "forwardScan")
        order = { id: `map-scan-${stamp}`, kind: "forwardScan", hexId: id };
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
    const nextDraft = game.era === 4
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
  if (remoteRoom)
    return (
      <RemoteRoomView
        initial={remoteRoom}
        close={() => setRemoteRoom(null)}
      />
    );
  if (!started || !game)
    return (
      <main className="setup" data-theme={theme}>
        <div className="stars" />
        <section className="setup-card">
          <img src="/horizon-logo.png" alt="Horizon" className="logo" />
          <p className="kicker">SHATTERED REACH PLAYTEST // VERSION 0.13.0</p>
          <h1>Command the fleets of a broken system.</h1>
          <p className="lede">
            A deterministic strategy playtest with secret simultaneous Orders,
            edge-conflict resolution, Era-end Hidden Legacy reveals, private
            player views, and server-backed rooms.
          </p>
          <div className="setup-row">
            <div>
              <label>Players</label>
              <div className="segmented">
                {[4, 5, 6].map((n) => (
                  <button
                    key={n}
                    className={count === n ? "active" : ""}
                    onClick={() => setCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label>Visual package</label>
              <div className="segmented">
                {themeIds.map((id) => (
                  <button
                    key={id}
                    className={theme === id ? "active" : ""}
                    onClick={() => setTheme(id)}
                  >
                    {themeLibrary[id].name}
                  </button>
                ))}
              </div>
            </div>
            <p>
              Worlds reshuffle each game. Routes, regions, and chokepoints
              remain.
            </p>
          </div>
          <div className="faction-grid">
            {chosen.slice(0, count).map((id, i) => {
              const controllerId=seatControllers[i],controller=controllerId==="human"?undefined:getBotProfile(controllerId);
              return <div className="seat-choice" key={i} style={{ "--f": factionLibrary[id].color } as React.CSSProperties}>
                <button
                  className="faction-choice"
                  onClick={() => {
                    const n = [...chosen];
                    n[i] = factionIds[(factionIds.indexOf(id) + 1) % factionIds.length];
                    setChosen(n);
                  }}
                >
                  <span>Seat {i + 1}</span>
                  <strong>{factionLibrary[id].name}</strong>
                  <small>{factionLibrary[id].role}</small>
                </button>
                <button className={`controller-choice ${controller?"bot":""}`} onClick={()=>{
                  const options=["human",...botProfiles.map((profile)=>profile.id)],current=options.indexOf(controllerId),next=[...seatControllers];
                  next[i]=options[(current+1)%options.length];setSeatControllers(next);
                }}><span>{controller?"AI CONTROLLER":"PLAYER CONTROL"}</span><b>{controller?.name||"Human"}</b></button>
              </div>;
            })}
          </div>
          <button
            className="primary launch"
            onClick={() => {
              setGame(createGame(count, chosen, "shattered-reach", theme, undefined, configuredControllers()));
              setStarted(true);
            }}
          >
            Enter the Reach
          </button>
          <button
            className="simulation-launch"
            onClick={() => {
              const controllers = factionIds.slice(0, 6).map<PlayerController>(() => ({ kind: "bot", profileId: "meta-analyst" }));
              setCount(6);
              setChosen(factionIds.slice(0, 6));
              setSeatControllers(Array(6).fill("meta-analyst"));
              setSimulationPaused(false);
              setSimulationSpeed(650);
              setGame(createGame(6, factionIds.slice(0, 6), "shattered-reach", theme, undefined, controllers, true));
              setStarted(true);
            }}
          ><span>WATCH ALL SIX FACTIONS</span><b>Run spectator simulation</b><small>Meta Analyst controls every civilization. Pause, step, or change speed at any time.</small></button>
          <RoomSetup
            gameFactory={() =>
              createGame(count, chosen, "shattered-reach", theme, undefined, configuredControllers())
            }
            startHost={(session) => {
              setGame(session.game);
              setTheme(session.game.themeId);
              setStarted(true);
            }}
            openRemote={setRemoteRoom}
          />
          <small className="fineprint">
            Progress saves automatically. Version 0.13.0 migrates earlier
            playtest saves.
          </small>
        </section>
      </main>
    );

  const buildSelectionActive = panel === "build" && (buildTargeting || !buildHexId),
    buildableHabitats = game.hexes
      .filter((hex) => hex.owner === p!.id && hex.tier && hex.constructionUsedTurn !== game.turn)
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
      style={{ "--player": p!.color } as React.CSSProperties}
    >
      <header className="topbar">
        <img src="/horizon-logo.png" alt="Horizon" />
        <div className="turn-id">
          <span>ERA {game.era}</span>
          <strong>TURN {game.turn} / 16</strong>
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
              ["command", "Command"],
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
                disabled={id === "command" || game.spectatorMode}
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
                  Economy {p!.tech.Economy}. Influence and Labor cannot enter
                  the Market.
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
                  {mapUnit.kind === "explorer" && p!.faction === "farbound" && <button className={mapIntent === "forwardScan" ? "active" : ""} onClick={() => chooseMapAction("forwardScan")}>Forward Scan</button>}
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
                  width: MAP_CANVAS_WIDTH * mapZoom,
                  height: MAP_CANVAS_HEIGHT * mapZoom,
                }}
              >
                <div className="map-stage" style={{ transform: `scale(${mapZoom})` }}>
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
                      className={`hex ${h.kind} ${!h.revealed ? "concealed" : ""} ${privateSurvey ? "privately-surveyed" : ""} ${game.selected === h.id ? "selected" : ""} ${activeMapTargets.includes(h.id) ? "legal-target" : ""}`}
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
                          src={visibleKind ? tileAssets[visibleKind] : tileAssets.unrevealed}
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
                          className={`unit-cell ${h.col % 2 ? "offset" : ""}`}
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
