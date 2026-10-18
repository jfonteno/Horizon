import { getNeighbors } from "../engine/geometry";
import { factionRules } from "../factions";
import { mapLibrary } from "../maps";
import type { ExplorationVesselState, ExplorationVesselType, GameState, HexState } from "../types";
import { canPay, spend } from "./economy";
import { claimHabitatConstruction } from "./fleet";
import { portalNeighbors } from "./portals";

export const explorationLibrary: Record<ExplorationVesselType, {
  name: string; tech: number; move: number; reveals: number; cost: Record<string, number>;
}> = {
  exploration: { name: "Exploration Vessel", tech: 1, move: 1, reveals: 1, cost: { material: 1, currency: 1, labor: 1 } },
  survey: { name: "Survey Vessel", tech: 2, move: 1, reveals: 1, cost: { material: 2, currency: 1, labor: 1 } },
  deepSurvey: { name: "Deep Survey Vessel", tech: 3, move: 2, reveals: 1, cost: { material: 3, currency: 2, labor: 1 } },
  pathfinder: { name: "Pathfinder Vessel", tech: 4, move: 3, reveals: 2, cost: { material: 4, currency: 3, labor: 2 } },
};

export function explorationRevealAllowance(level: number) {
  return Math.max(1, Math.min(4, level));
}

export function explorationMovement(game: GameState, playerId: number, vessel: ExplorationVesselState) {
  return explorationLibrary[vessel.type].move + Math.max(0, game.players[playerId].tech.Exploration - 1);
}

export function availableExplorationTypes(game: GameState, playerId: number) {
  const level = game.players[playerId].tech.Exploration;
  return (Object.keys(explorationLibrary) as ExplorationVesselType[])
    .filter((type) => explorationLibrary[type].tech <= level);
}

function uniqueId(game: GameState, owner: number) {
  const all = game.players.flatMap((player) => player.explorationVessels || []);
  let sequence = all.length + 1;
  while (all.some((unit) => unit.id === `exploration-${owner}-${sequence}`)) sequence++;
  return `exploration-${owner}-${sequence}`;
}

export function buildExplorationVessel(game: GameState, playerId: number, habitatId: string, type: ExplorationVesselType) {
  const player = game.players[playerId], habitat = game.hexes.find((hex) => hex.id === habitatId), definition = explorationLibrary[type];
  if (!habitat?.tier || habitat.owner !== playerId) return { ok: false, message: "Select one of your Habitats." };
  if (!availableExplorationTypes(game, playerId).includes(type)) return { ok: false, message: "Requires higher Exploration Technology." };
  if (!canPay(player, definition.cost)) return { ok: false, message: "You cannot afford that exploration vessel." };
  if (!claimHabitatConstruction(game, habitatId)) return { ok: false, message: "That Habitat already used its Construction Order." };
  spend(player, definition.cost);
  player.explorationVessels ||= [];
  player.explorationVessels.push({ id: uniqueId(game, playerId), owner: playerId, type, hex: habitatId, readyTurn: game.turn + 1, movesRemaining: 0 });
  player.legacyMetrics.builtVessels[game.era - 1]++;
  game.log.unshift(`${player.name} constructed a ${definition.name} at ${habitatId}.`);
  return { ok: true, message: `${definition.name} constructed for next Turn.` };
}

export function beginExplorationTurn(game: GameState, playerId: number) {
  const player = game.players[playerId];
  for (const vessel of player.explorationVessels || []) {
    vessel.movesRemaining = vessel.readyTurn <= game.turn ? explorationMovement(game, playerId, vessel) : 0;
    vessel.publicReveals = vessel.publicRevealsTurn === game.turn ? vessel.publicReveals || 0 : 0;
    vessel.publicRevealsTurn = game.turn;
  }
  if (player.explorationVessels?.[0]) player.explorer = player.explorationVessels[0].hex;
}

function publicReveal(game: GameState, playerId: number, vessel: ExplorationVesselState, hex: HexState) {
  if (hex.revealed || hex.kind === "rift") return false;
  const player = game.players[playerId];
  const limit = explorationRevealAllowance(player.tech.Exploration);
  if ((vessel.publicReveals || 0) >= limit) return false;
  hex.revealed = true;
  vessel.publicReveals = (vessel.publicReveals || 0) + 1;
  vessel.publicRevealsTurn = game.turn;
  player.legacyMetrics.revealedHexes[game.era - 1]++;
  player.legacyMetrics.publicReveals++;
  if (factionRules(player) === "farbound") {
    hex.surveyedBy ||= [];
    if (!hex.surveyedBy.includes(playerId)) hex.surveyedBy.push(playerId);
    if (hex.kind === "empty") player.resources.influence++;
    else if (hex.kind === "barren") player.resources.material++;
  }
  resolveAnomaly(game, playerId, hex);
  game.log.unshift(`${player.name} publicly revealed ${hex.id}: ${hex.kind}.`);
  return true;
}

export function resolveAnomaly(game: GameState, playerId: number, hex: HexState) {
  if (hex.kind !== "anomaly" || hex.anomalyResolvedBy !== undefined) return;
  const player = game.players[playerId];
  // Stable across replay, save/load and server implementations.
  let roll = (game.seed ^ 0x78c2ab47) >>> 0;
  for (const char of hex.id) roll = (Math.imul(roll ^ char.charCodeAt(0), 16777619)) >>> 0;
  const rewards = ["material", "currency", "research", "influence", "neighbors", "material", "currency", "lp"] as const;
  const reward = rewards[roll % rewards.length];
  hex.anomalyResolvedBy = playerId;
  hex.anomalyReward = reward;
  if (reward === "neighbors") {
    const neighbors = getNeighbors(hex.id, mapLibrary[game.mapId]);
    let count = 0;
    for (const id of neighbors) {
      const adjacent = game.hexes.find((candidate) => candidate.id === id);
      if (!adjacent || adjacent.revealed || adjacent.kind === "rift") continue;
      adjacent.revealed = true;
      count++;
      player.legacyMetrics.revealedHexes[game.era - 1]++;
      player.legacyMetrics.publicReveals++;
    }
    game.log.unshift(`${player.name} resolved the anomaly at ${hex.id} and revealed ${count} neighboring hexes.`);
  } else if (reward === "lp") {
    player.lp++;
    player.legacy.universal++;
    game.log.unshift(`${player.name} resolved the anomaly at ${hex.id} and gained 1 LP.`);
  } else {
    player.resources[reward] += 2;
    game.log.unshift(`${player.name} resolved the anomaly at ${hex.id} and gained 2 ${reward}.`);
  }
  if (factionRules(player) === "farbound") player.resources.research += 2;
}

function normalizedPath(origin: string, destination: string, path?: string[]) {
  const steps = path?.length ? [...path] : [destination];
  if (steps[0] === origin) steps.shift();
  return steps;
}

function findExplorationVessel(player: GameState["players"][number], vesselId?: string) {
  // Older orders without an ID refer to the primary vessel. An explicit ID
  // must never silently select a different vessel after a room update.
  return vesselId && vesselId !== "explorer"
    ? player.explorationVessels?.find((unit) => unit.id === vesselId)
    : player.explorationVessels?.[0];
}

export function validateExplorationPath(game: GameState, playerId: number, vesselId: string | undefined, destination: string, path?: string[]) {
  const player = game.players[playerId], vessel = findExplorationVessel(player, vesselId);
  if (!vessel || vessel.readyTurn > game.turn) return { ok: false, message: "Select a ready Exploration vessel." };
  const steps = normalizedPath(vessel.hex, destination, path), map = mapLibrary[game.mapId];
  if (!steps.length || steps.length > vessel.movesRemaining) return { ok: false, message: "That path exceeds this vessel's movement." };
  let validated = vessel.hex;
  let newReveals = 0;
  let portalSteps = 0;
  for (const id of steps) {
    const hex = game.hexes.find((candidate) => candidate.id === id);
    if (!hex || hex.kind === "rift" || !(getNeighbors(validated, map).includes(id) || portalNeighbors(game, playerId, validated).includes(id))) return { ok: false, message: "The selected path is not contiguous and navigable." };
    if (!getNeighbors(validated, map).includes(id)) portalSteps++;
    if (!hex.revealed) newReveals++;
    validated = id;
  }
  if (portalSteps + Number(vessel.portalUsedTurn === game.turn) > 1) return { ok: false, message: "An Exploration vessel may traverse one portal per Turn." };
  if (newReveals + (vessel.publicReveals || 0) > explorationRevealAllowance(player.tech.Exploration)) return { ok: false, message: "This vessel has reached its public reveal limit." };
  return { ok: true, message: "Valid exploration path." };
}

export function moveExplorationVessel(game: GameState, playerId: number, vesselId: string | undefined, destination: string, path?: string[]) {
  const validation = validateExplorationPath(game, playerId, vesselId, destination, path);
  if (!validation.ok) return validation;
  const player = game.players[playerId], vessel = findExplorationVessel(player, vesselId)!;
  const steps = normalizedPath(vessel.hex, destination, path), map = mapLibrary[game.mapId];
  const portalSteps = steps.reduce((count, id, index) => count + Number(!getNeighbors(index ? steps[index - 1] : vessel.hex, map).includes(id)), 0);
  let current = vessel.hex;
  for (let index = 0; index < steps.length; index++) {
    const hex = game.hexes.find((candidate) => candidate.id === steps[index]);
    if (!hex || hex.kind === "rift" || !(getNeighbors(current, map).includes(hex.id) || portalNeighbors(game, playerId, current).includes(hex.id))) return { ok: false, message: "The selected path is not contiguous and navigable." };
    if (!hex.revealed && !publicReveal(game, playerId, vessel, hex)) return { ok: false, message: "This vessel has reached its public reveal limit." };
    resolveAnomaly(game, playerId, hex);
    current = hex.id;
  }
  vessel.hex = current;
  if (portalSteps) vessel.portalUsedTurn = game.turn;
  vessel.movesRemaining -= steps.length;
  if (player.explorationVessels[0].id === vessel.id) player.explorer = current;
  return { ok: true, message: `${explorationLibrary[vessel.type].name} moved to ${current}.` };
}

export function scanWithExplorationVessel(game: GameState, playerId: number, vesselId: string | undefined, hexIds: string[]) {
  const player = game.players[playerId], vessel = findExplorationVessel(player, vesselId);
  if (!vessel || explorationLibrary[vessel.type].tech < 2 || vessel.readyTurn > game.turn) return { ok: false, message: "Scanning requires a ready Survey Vessel or better." };
  if (hexIds.length < 1 || hexIds.length + (vessel.publicReveals || 0) > explorationRevealAllowance(player.tech.Exploration)) return { ok: false, message: "That scan exceeds this vessel's reveal limit." };
  const neighbors = getNeighbors(vessel.hex, mapLibrary[game.mapId]);
  if (hexIds.some((id) => !neighbors.includes(id))) return { ok: false, message: "Public scans must target adjacent hexes." };
  let revealed = 0;
  for (const id of hexIds) {
    const hex = game.hexes.find((candidate) => candidate.id === id);
    if (hex && publicReveal(game, playerId, vessel, hex)) revealed++;
  }
  if (!revealed) return { ok: false, message: "Choose an adjacent unrevealed hex." };
  vessel.movesRemaining = 0;
  return { ok: true, message: `${revealed} hex${revealed === 1 ? "" : "es"} publicly scanned.` };
}

export function farboundForwardScan(game: GameState, playerId: number, vesselId: string | undefined, hexId: string) {
  const player = game.players[playerId], vessel = findExplorationVessel(player, vesselId), hex = game.hexes.find((candidate) => candidate.id === hexId);
  if (factionRules(player) !== "farbound" || !vessel) return { ok: false, message: "Forward Scanning is a Farbound Exploration ability." };
  if (vessel.readyTurn > game.turn) return { ok: false, message: "Select a ready Exploration vessel." };
  if (player.forwardScanUsedTurn === game.turn) return { ok: false, message: "Forward Scanning was already used this Turn." };
  if (!getNeighbors(vessel.hex, mapLibrary[game.mapId]).includes(hexId) || !hex || hex.revealed) return { ok: false, message: "Choose an adjacent unrevealed hex." };
  if (player.privateSurveys.some((survey) => survey.hexId === hexId)) return { ok: false, message: "That hex is already in the Farbound survey archive." };
  player.privateSurveys.push({ hexId, kind: hex.kind, surveyedTurn: game.turn, soldTo: [] });
  hex.surveyedBy ||= [];
  if (!hex.surveyedBy.includes(playerId)) hex.surveyedBy.push(playerId);
  player.forwardScanUsedTurn = game.turn;
  return { ok: true, message: `Forward Scan privately identified ${hexId}.` };
}
