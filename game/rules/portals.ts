import type { GameState, HexState, PlayerState } from "../types";
const habitatSlots = (tier: HexState["tier"]) => tier === "Arcology" ? 4 : tier === "Metropolis" ? 3 : tier === "Colony" ? 2 : tier === "Outpost" ? 1 : 0;

export function portalNeighbors(game: GameState, playerId: number, fromHex: string): string[] {
  const home = game.hexes.find((hex) => hex.kind === "home" && hex.originalOwner === playerId && hex.owner === playerId);
  if (!home) return [];
  const destinations = home.portalDestinations || [];
  return fromHex === home.id ? destinations : destinations.includes(fromHex) ? [home.id] : [];
}

export function removeCenterAt(habitat: HexState, index: number, owner?: PlayerState) {
  if (habitat.enhancedCenterIndices?.includes(index) && owner && (owner.laborPenalty || 0) > 0) {
    owner.laborPenalty = (owner.laborPenalty || 0) - 1;
    owner.laborCap++;
    owner.labor = Math.min(owner.laborCap, owner.labor + 1);
  }
  const [removed] = habitat.centers.splice(index, 1);
  habitat.enhancedCenterIndices = (habitat.enhancedCenterIndices || [])
    .filter((position) => position !== index)
    .map((position) => position > index ? position - 1 : position);
  if (habitat.factoryOutputs) {
    habitat.factoryOutputs = Object.fromEntries(Object.entries(habitat.factoryOutputs)
      .filter(([position]) => Number(position) !== index)
      .map(([position, output]) => [Number(position) > index ? Number(position) - 1 : Number(position), output])) as typeof habitat.factoryOutputs;
  }
  if (removed === "defense") habitat.defenseGridOrigin = undefined;
  return removed;
}

export function resolvePortalOrder(game: GameState, playerId: number, vesselId: string, replaceCenterIndex?: number) {
  const player = game.players[playerId];
  const vessel = player.explorationVessels.find((unit) => unit.id === vesselId && unit.readyTurn <= game.turn);
  const home = game.hexes.find((hex) => hex.kind === "home" && hex.originalOwner === playerId && hex.owner === playerId);
  const destination = game.hexes.find((hex) => hex.id === vessel?.hex && hex.revealed && hex.kind !== "rift");
  if (player.tech.Exploration < 4 || !vessel || !home || !destination || destination.id === home.id || (home.portalDestinations || []).includes(destination.id)) return false;
  if (home.centers.length + (home.portalDestinations || []).length >= habitatSlots(home.tier)) {
    if (!Number.isInteger(replaceCenterIndex) || replaceCenterIndex! < 0 || replaceCenterIndex! >= home.centers.length) return false;
    removeCenterAt(home, replaceCenterIndex!, player);
  } else if (replaceCenterIndex !== undefined) {
    if (!Number.isInteger(replaceCenterIndex) || replaceCenterIndex < 0 || replaceCenterIndex >= home.centers.length) return false;
    removeCenterAt(home, replaceCenterIndex, player);
  }
  home.portalDestinations = [...(home.portalDestinations || []), destination.id];
  player.explorationVessels = player.explorationVessels.filter((unit) => unit.id !== vesselId);
  player.explorer = player.explorationVessels[0]?.hex || home.id;
  game.log.unshift(`${player.name} consumed an Exploration vessel to open a Homeworld portal to ${destination.id}.`);
  return true;
}
