import { getNeighbors } from "../engine/geometry";
import { portalNeighbors } from "./portals";
import { mapLibrary } from "../maps";
import type { ColonyShipState, GameState, PlayerState } from "../types";
import { canPay, spend } from "./economy";
import { claimHabitatConstruction } from "./fleet";

export const colonyShipDefinition = {
  name: "Colony Ship",
  move: 1,
  cost: { material: 2, currency: 2, labor: 1 },
  special: "Noncombatant. Ordinary military forces cannot damage or capture it.",
} as const;

export function primaryColonyShip(player: PlayerState) {
  return player.colonyShips[0];
}

export function findColonyShip(player: PlayerState, vesselId?: string) {
  return vesselId ? player.colonyShips.find((unit) => unit.id === vesselId) : primaryColonyShip(player);
}

export function syncPrimaryColonyShip(player: PlayerState) {
  player.colonyShip = primaryColonyShip(player)?.hex || "";
}

function uniqueId(game: GameState, owner: number) {
  const all = game.players.flatMap((player) => player.colonyShips);
  let sequence = all.length + 1;
  while (all.some((unit) => unit.id === `colony-${owner}-${sequence}`)) sequence++;
  return `colony-${owner}-${sequence}`;
}

export function buildColonyShip(game: GameState, playerId: number, habitatId: string) {
  const player = game.players[playerId];
  const habitat = game.hexes.find((hex) => hex.id === habitatId);
  if (!habitat?.tier || habitat.owner !== playerId)
    return { ok: false, message: "Select one of your Habitats." };
  if (!canPay(player, colonyShipDefinition.cost))
    return { ok: false, message: "You cannot afford that Colony Ship." };
  if (!claimHabitatConstruction(game, habitatId))
    return { ok: false, message: "That Habitat already used its Construction Order." };
  spend(player, colonyShipDefinition.cost);
  player.colonyShips.push({
    id: uniqueId(game, playerId),
    owner: playerId,
    hex: habitatId,
    readyTurn: game.turn + 1,
    movesRemaining: 0,
  });
  syncPrimaryColonyShip(player);
  player.legacyMetrics.builtVessels[game.era - 1]++;
  game.log.unshift(`${player.name} constructed a Colony Ship at ${habitatId}. It becomes available next Turn.`);
  return { ok: true, message: "Colony Ship constructed for next Turn." };
}

export function beginColonyTurn(game: GameState, playerId: number) {
  const player = game.players[playerId];
  for (const vessel of player.colonyShips)
    vessel.movesRemaining = vessel.readyTurn <= game.turn ? colonyShipDefinition.move : 0;
  syncPrimaryColonyShip(player);
}

function normalizedPath(origin: string, destination: string, path?: string[]) {
  const steps = path?.length ? [...path] : [destination];
  if (steps[0] === origin) steps.shift();
  return steps;
}

export function moveColonyShip(
  game: GameState,
  playerId: number,
  vesselId: string | undefined,
  destination: string,
  path?: string[],
) {
  const player = game.players[playerId];
  const vessel: ColonyShipState | undefined = findColonyShip(player, vesselId);
  if (!vessel || vessel.readyTurn > game.turn)
    return { ok: false, message: "Select a ready Colony Ship." };
  const steps = normalizedPath(vessel.hex, destination, path);
  if (!steps.length || steps.length > vessel.movesRemaining)
    return { ok: false, message: "That path exceeds this Colony Ship's movement." };
  const map = mapLibrary[game.mapId];
  let current = vessel.hex;
  let portalSteps = 0;
  for (const step of steps) {
    const hex = game.hexes.find((candidate) => candidate.id === step);
    if (!hex || !hex.revealed || hex.kind === "rift" || !(getNeighbors(current, map).includes(step) || portalNeighbors(game, playerId, current).includes(step)))
      return { ok: false, message: "Colony Ships may move only through contiguous revealed sectors." };
    if (!getNeighbors(current, map).includes(step)) portalSteps++;
    current = step;
  }
  if (portalSteps + Number(vessel.portalUsedTurn === game.turn) > 1) return { ok: false, message: "A Colony Ship may traverse one portal per Turn." };
  vessel.hex = destination;
  if (portalSteps) vessel.portalUsedTurn = game.turn;
  vessel.movesRemaining -= steps.length;
  syncPrimaryColonyShip(player);
  return { ok: true, message: `Colony Ship moved to ${destination}.` };
}
