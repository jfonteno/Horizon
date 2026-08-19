import { getNeighbors } from "../engine/geometry";
import { mapLibrary } from "../maps";
import type { CarrierState, CarrierType, GameState, HexState, PlayerState } from "../types";
import { hasBenefit } from "./diplomacy";
import { canPay, spend } from "./economy";

export type CarrierDefinition = {
  type: CarrierType;
  name: string;
  tech: number;
  move: number;
  capacity: number;
  cost: Record<string, number>;
  faction?: "varkesh";
  special: string;
};

export const carrierLibrary: Record<CarrierType, CarrierDefinition> = {
  patrol: { type: "patrol", name: "Patrol Vessel", tech: 1, move: 2, capacity: 2, cost: { material: 1, currency: 1, labor: 1 }, special: "Basic fast patrol." },
  transport: { type: "transport", name: "Transport", tech: 1, move: 1, capacity: 6, cost: { material: 2, currency: 2, labor: 1 }, special: "High early capacity." },
  frigate: { type: "frigate", name: "Frigate", tech: 2, move: 2, capacity: 4, cost: { material: 2, currency: 2, labor: 1 }, special: "Improved general fleet platform." },
  assault: { type: "assault", name: "Assault Vessel", tech: 2, move: 2, capacity: 5, cost: { material: 3, currency: 2, labor: 2 }, special: "Reduces defending Home Guard by 1 CS." },
  cruiser: { type: "cruiser", name: "Cruiser", tech: 3, move: 2, capacity: 6, cost: { material: 4, currency: 3, labor: 2 }, special: "Advanced fleet platform." },
  heavyTransport: { type: "heavyTransport", name: "Heavy Transport", tech: 3, move: 2, capacity: 10, cost: { material: 5, currency: 4, labor: 2 }, special: "Large troop transport." },
  battleship: { type: "battleship", name: "Battleship", tech: 4, move: 3, capacity: 8, cost: { material: 6, currency: 5, labor: 3 }, special: "Fast high-tier platform." },
  fleetTransport: { type: "fleetTransport", name: "Fleet Transport", tech: 4, move: 2, capacity: 14, cost: { material: 7, currency: 5, labor: 3 }, special: "Maximum standard capacity." },
  corvette: { type: "corvette", name: "Corvette", tech: 2, move: 3, capacity: 2, cost: { material: 1, currency: 1, labor: 1 }, faction: "varkesh", special: "Varkesh rapid-response vessel." },
  xebec: { type: "xebec", name: "Xebec", tech: 4, move: 3, capacity: 12, cost: { material: 7, currency: 6, labor: 3 }, faction: "varkesh", special: "Varkesh rapid force projection." },
};

const standardTypes: CarrierType[] = ["patrol", "transport", "frigate", "assault", "cruiser", "heavyTransport", "battleship", "fleetTransport"];

export function carrierCost(player: PlayerState, type: CarrierType): Record<string, number> {
  const definition = carrierLibrary[type];
  const cost = { ...definition.cost };
  if (player.faction === "varkesh" && !definition.faction) cost.material = Math.max(1, (cost.material || 0) - 1);
  return cost;
}

export function availableCarrierTypes(player: PlayerState): CarrierType[] {
  const available = standardTypes.filter(type => carrierLibrary[type].tech <= player.tech.Military);
  if (player.faction === "varkesh" && player.tech.Military >= 2) available.push("corvette");
  if (player.faction === "varkesh" && player.tech.Military >= 4) available.push("xebec");
  return available;
}

export function constructionAvailable(hex: HexState, turn: number): boolean {
  return hex.constructionUsedTurn !== turn;
}

function claimConstruction(hex: HexState, turn: number): boolean {
  if (!constructionAvailable(hex, turn)) return false;
  hex.constructionUsedTurn = turn;
  return true;
}

function uniqueCarrierId(game: GameState, owner: number): string {
  let sequence = game.carriers.length + 1;
  while (game.carriers.some(carrier => carrier.id === `carrier-${owner}-${sequence}`)) sequence++;
  return `carrier-${owner}-${sequence}`;
}

export function buildCarrier(game: GameState, playerId: number, habitatId: string, type: CarrierType): { ok: boolean; message: string } {
  const player = game.players[playerId], habitat = game.hexes.find(hex => hex.id === habitatId);
  if (!habitat?.tier || habitat.owner !== playerId) return { ok: false, message: "Select one of your Habitats." };
  if (!availableCarrierTypes(player).includes(type)) return { ok: false, message: "Your Military Technology does not unlock that vessel." };
  if (!constructionAvailable(habitat, game.turn)) return { ok: false, message: "That Habitat already used its Construction Order this Turn." };
  const cost = carrierCost(player, type);
  if (!canPay(player, cost)) return { ok: false, message: "You cannot afford that vessel." };
  claimConstruction(habitat, game.turn);
  spend(player, cost);
  game.carriers.push({ id: uniqueCarrierId(game, playerId), owner: playerId, type, hex: habitatId, cu: 0, readyTurn: game.turn + 1, movesRemaining: 0 });
  player.legacyMetrics.builtVessels[game.era - 1]++;
  game.log.unshift(`${player.name} began construction of a ${carrierLibrary[type].name} at ${habitatId}. It becomes available next Turn and must be crewed with at least 1 CU.`);
  return { ok: true, message: `${carrierLibrary[type].name} constructed for next Turn.` };
}

export function recruitCombatUnits(game: GameState, playerId: number, habitatId: string, pairs: number): { ok: boolean; message: string } {
  const player = game.players[playerId], habitat = game.hexes.find(hex => hex.id === habitatId);
  if (!habitat?.tier || habitat.owner !== playerId) return { ok: false, message: "Select one of your Habitats." };
  if (!Number.isInteger(pairs) || pairs < 1) return { ok: false, message: "Recruit at least one pair of Combat Units." };
  if (!constructionAvailable(habitat, game.turn)) return { ok: false, message: "That Habitat already used its Construction Order this Turn." };
  const cost = { currency: pairs, labor: pairs };
  if (!canPay(player, cost)) return { ok: false, message: "You cannot afford that recruitment order." };
  claimConstruction(habitat, game.turn);
  spend(player, cost);
  habitat.pendingCombat ||= [];
  habitat.pendingCombat.push({ amount: pairs * 2, readyTurn: game.turn + 1 });
  player.legacyMetrics.recruitedCU[game.era - 1] += pairs * 2;
  game.log.unshift(`${player.name} recruited ${pairs * 2} CU at ${habitatId}; they become available next Turn.`);
  return { ok: true, message: `${pairs * 2} Combat Units recruited for next Turn.` };
}

export function claimHabitatConstruction(game: GameState, habitatId: string): boolean {
  const habitat = game.hexes.find(hex => hex.id === habitatId);
  return !!habitat && claimConstruction(habitat, game.turn);
}

export function beginFleetTurn(game: GameState, playerId: number): void {
  game.hexes.forEach(hex => {
    const arriving = (hex.pendingCombat || []).filter(force => force.readyTurn <= game.turn).reduce((sum, force) => sum + force.amount, 0);
    if (arriving) hex.combat += arriving;
    hex.pendingCombat = (hex.pendingCombat || []).filter(force => force.readyTurn > game.turn);
  });
  const playerCarriers = game.carriers.filter(carrier => carrier.owner === playerId);
  playerCarriers.forEach(carrier => {
    const definition = carrierLibrary[carrier.type];
    if (carrier.readyTurn <= game.turn && carrier.cu === 0) {
      const habitat = game.hexes.find(hex => hex.id === carrier.hex && hex.owner === playerId && hex.combat > 0);
      if (habitat) { habitat.combat--; carrier.cu = 1; }
    }
    carrier.movesRemaining = carrier.readyTurn <= game.turn && carrier.cu > 0 ? definition.move : 0;
  });
  const destroyed = game.carriers.filter(carrier => carrier.owner === playerId && carrier.readyTurn <= game.turn && carrier.cu === 0);
  destroyed.forEach(carrier => game.log.unshift(`${game.players[playerId].name}'s uncrewed ${carrierLibrary[carrier.type].name} was destroyed when it activated without a CU.`));
  game.carriers = game.carriers.filter(carrier => carrier.readyTurn > game.turn || carrier.cu > 0);
  game.selectedCarrierIds = game.carriers.filter(carrier => carrier.owner === playerId && carrier.readyTurn <= game.turn).slice(0, 1).map(carrier => carrier.id);
}

export function transferCombatUnit(game: GameState, playerId: number, carrierId: string, direction: "load" | "unload", amount = 1): { ok: boolean; message: string } {
  const carrier = game.carriers.find(item => item.id === carrierId && item.owner === playerId);
  if (!carrier) return { ok: false, message: "Carrier not found." };
  const habitat = game.hexes.find(hex => hex.id === carrier.hex && hex.owner === playerId && hex.tier);
  if (!habitat) return { ok: false, message: "CU transfers require one of your Habitats in the carrier's hex." };
  const definition = carrierLibrary[carrier.type];
  const count = Math.max(1, Math.floor(amount));
  if (direction === "load") {
    const moved = Math.min(count, habitat.combat, definition.capacity - carrier.cu);
    if (!moved) return { ok: false, message: "No stationed CU or carrier capacity is available." };
    habitat.combat -= moved; carrier.cu += moved;
    return { ok: true, message: `${moved} CU loaded onto ${definition.name}.` };
  }
  const moved = Math.min(count, Math.max(0, carrier.cu - 1));
  if (!moved) return { ok: false, message: "A military vessel must retain at least 1 CU." };
  carrier.cu -= moved; habitat.combat += moved;
  return { ok: true, message: `${moved} CU stationed at ${habitat.id}.` };
}

function trimCarriers(game: GameState, carriers: CarrierState[], survivors: number): void {
  const ordered = [...carriers].sort((a, b) => carrierLibrary[b.type].capacity - carrierLibrary[a.type].capacity || a.id.localeCompare(b.id));
  const kept = ordered.slice(0, Math.min(ordered.length, survivors));
  const keepIds = new Set(kept.map(carrier => carrier.id));
  game.carriers = game.carriers.filter(carrier => !carriers.some(candidate => candidate.id === carrier.id) || keepIds.has(carrier.id));
  kept.forEach(carrier => { carrier.cu = 1; });
  let extra = survivors - kept.length;
  kept.forEach(carrier => {
    const add = Math.min(extra, carrierLibrary[carrier.type].capacity - 1);
    carrier.cu += add; extra -= add;
  });
}

function defenderCasualties(game: GameState, hostileCarriers: CarrierState[], habitat: HexState | undefined, casualties: number): void {
  let remaining = casualties;
  if (habitat && habitat.combat) {
    const loss = Math.min(habitat.combat, remaining);
    habitat.combat -= loss; remaining -= loss;
  }
  if (!remaining) return;
  const totalCarrierCU = hostileCarriers.reduce((sum, carrier) => sum + carrier.cu, 0);
  trimCarriers(game, hostileCarriers, Math.max(0, totalCarrierCU - remaining));
}

function tierSlots(tier: HexState["tier"]): number {
  return tier === "Metropolis" ? 3 : tier === "Colony" ? 2 : tier === "Outpost" ? 1 : 0;
}

function captureHabitat(game: GameState, habitat: HexState, attackerId: number): void {
  const attacker = game.players[attackerId], oldOwner = habitat.owner!;
  const capturedTier = habitat.tier;
  habitat.owner = attackerId;
  habitat.combat = 0;
  habitat.pendingCombat = [];
  if (attacker.faction !== "varkesh") habitat.tier = habitat.tier === "Metropolis" ? "Colony" : habitat.tier === "Colony" ? "Outpost" : habitat.tier;
  const excess = Math.max(0, habitat.centers.length - tierSlots(habitat.tier));
  if (excess) game.pendingCenterLoss = { hexId: habitat.id, playerId: attackerId, removeCount: excess };
  attacker.legacyMetrics.habitatsCaptured[game.era - 1]++;
  if (capturedTier === "Metropolis") attacker.legacyMetrics.metropolisCaptured[game.era - 1]++;
  if (habitat.originalOwner !== undefined && habitat.originalOwner !== attackerId && !attacker.legacyMetrics.originalHabitatsCaptured.includes(habitat.originalOwner)) attacker.legacyMetrics.originalHabitatsCaptured.push(habitat.originalOwner);
  game.log.unshift(`${attacker.name} captured ${habitat.id} from ${game.players[oldOwner].name}${attacker.faction === "varkesh" ? " without tier loss" : ""}.`);
}

export function removeCapturedCenter(game: GameState, playerId: number, centerIndex: number): { ok: boolean; message: string } {
  const pending = game.pendingCenterLoss;
  if (!pending || pending.playerId !== playerId) return { ok: false, message: "No captured Center decision is pending." };
  const habitat = game.hexes.find(hex => hex.id === pending.hexId);
  if (!habitat || centerIndex < 0 || centerIndex >= habitat.centers.length) return { ok: false, message: "That Center is unavailable." };
  const [removed] = habitat.centers.splice(centerIndex, 1);
  pending.removeCount--;
  game.log.unshift(`${game.players[playerId].name} destroyed the excess ${removed === "defense" ? "Defense Grid" : `${removed} Center`} at ${habitat.id}.`);
  if (pending.removeCount <= 0) game.pendingCenterLoss = undefined;
  return { ok: true, message: "Captured Center removed." };
}

function awardVarkesh(game: GameState, winnerId: number, opponents: number[]): void {
  const winner = game.players[winnerId] as PlayerState & { gloryAwards?: { turn: number; opponents: number[] } };
  if (winner.faction !== "varkesh") return;
  if (!winner.gloryAwards || winner.gloryAwards.turn !== game.turn) winner.gloryAwards = { turn: game.turn, opponents: [] };
  opponents.forEach(opponent => {
    if (!winner.gloryAwards!.opponents.includes(opponent)) {
      winner.gloryAwards!.opponents.push(opponent);
      winner.lp += game.era;
      winner.legacy.faction += game.era;
      game.log.unshift(`${winner.name} gained ${game.era} LP from Glory in Battle against ${game.players[opponent].name}.`);
    }
  });
}

type SimultaneousCarrierMove = {
  playerId: number;
  carrierIds: string[];
  origin: string;
  destination: string;
};

function carrierForce(game: GameState, ids: string[]) {
  return game.carriers.filter((carrier) => ids.includes(carrier.id));
}

function hostile(game: GameState, a: number, b: number) {
  return (
    a !== b &&
    !hasBenefit(game, a, b, "defensive")
  );
}

function removeForce(game: GameState, force: CarrierState[]) {
  const ids = new Set(force.map((carrier) => carrier.id));
  game.carriers = game.carriers.filter((carrier) => !ids.has(carrier.id));
}

function resolveEdgePair(
  game: GameState,
  first: SimultaneousCarrierMove,
  second: SimultaneousCarrierMove,
) {
  const a = carrierForce(game, first.carrierIds),
    b = carrierForce(game, second.carrierIds),
    aCS = a.reduce((sum, carrier) => sum + carrier.cu, 0),
    bCS = b.reduce((sum, carrier) => sum + carrier.cu, 0);
  if (aCS === bCS) {
    removeForce(game, [...a, ...b]);
    game.log.unshift(
      `Edge combat between ${first.origin} and ${first.destination} destroyed both ${aCS} CS forces.`,
    );
    return;
  }
  const winner = aCS > bCS ? a : b,
    loser = aCS > bCS ? b : a,
    winningMove = aCS > bCS ? first : second,
    losingMove = aCS > bCS ? second : first,
    survivors = Math.abs(aCS - bCS);
  removeForce(game, loser);
  trimCarriers(game, winner, survivors);
  carrierForce(game, winningMove.carrierIds).forEach((carrier) => {
    carrier.hex = winningMove.destination;
    carrier.movesRemaining--;
  });
  awardVarkesh(game, winningMove.playerId, [losingMove.playerId]);
  game.log.unshift(
    `${game.players[winningMove.playerId].name} won edge combat ${aCS} CS to ${bCS} CS and completed movement.`,
  );
}

function resolveSimultaneousHex(game: GameState, destination: string) {
  const carriers = game.carriers.filter((carrier) => carrier.hex === destination),
    habitat = game.hexes.find((hex) => hex.id === destination && hex.tier),
    owners = new Set(carriers.map((carrier) => carrier.owner));
  if (habitat?.owner !== undefined) owners.add(habitat.owner);
  const involved = [...owners];
  if (
    involved.length < 2 ||
    !involved.some((a) => involved.some((b) => hostile(game, a, b)))
  )
    return;

  const forces = involved.map((owner) => {
    const fleet = carriers.filter((carrier) => carrier.owner === owner),
      stationed = habitat?.owner === owner ? habitat.combat : 0,
      assaultReduction =
        habitat?.owner === owner &&
        carriers.some(
          (carrier) =>
            carrier.owner !== owner &&
            hostile(game, carrier.owner, owner) &&
            carrier.type === "assault",
        )
          ? 1
          : 0,
      guard =
        habitat?.owner === owner
          ? Math.max(
              0,
              (habitat.centers.includes("defense") ? 3 : 1) -
                assaultReduction,
            )
          : 0;
    return {
      owner,
      fleet,
      unitCS: fleet.reduce((sum, carrier) => sum + carrier.cu, 0) + stationed,
      totalCS:
        fleet.reduce((sum, carrier) => sum + carrier.cu, 0) + stationed + guard,
    };
  });
  const strongest = [...forces].sort(
    (a, b) => b.totalCS - a.totalCS || a.owner - b.owner,
  )[0];
  const opposition = forces
    .filter((force) => force.owner !== strongest.owner)
    .reduce((sum, force) => sum + force.totalCS, 0);
  const tiedStrongest =
    forces.filter((force) => force.totalCS === strongest.totalCS).length > 1;
  if (tiedStrongest || strongest.totalCS <= opposition) {
    removeForce(game, carriers);
    if (habitat) habitat.combat = 0;
    game.log.unshift(
      `Simultaneous combat at ${destination} destroyed every participating force.`,
    );
    return;
  }

  const survivingUnits = Math.max(1, strongest.unitCS - opposition);
  for (const force of forces)
    if (force.owner !== strongest.owner) removeForce(game, force.fleet);
  if (habitat?.owner === strongest.owner) {
    habitat.combat = Math.min(habitat.combat, survivingUnits);
    trimCarriers(
      game,
      strongest.fleet,
      Math.max(0, survivingUnits - habitat.combat),
    );
  } else {
    trimCarriers(game, strongest.fleet, survivingUnits);
    if (habitat) captureHabitat(game, habitat, strongest.owner);
  }
  awardVarkesh(
    game,
    strongest.owner,
    forces.filter((force) => force.owner !== strongest.owner).map((force) => force.owner),
  );
  game.log.unshift(
    `${game.players[strongest.owner].name} won simultaneous combat at ${destination} against ${opposition} combined opposition CS.`,
  );
}

export function resolveSimultaneousCarrierMoves(
  game: GameState,
  requested: Array<{
    playerId: number;
    carrierIds: string[];
    destination: string;
  }>,
) {
  const map = mapLibrary[game.mapId],
    used = new Set<string>(),
    moves: SimultaneousCarrierMove[] = [];
  for (const order of requested) {
    const force = carrierForce(game, order.carrierIds),
      origin = force[0]?.hex;
    if (
      !force.length ||
      !origin ||
      force.some(
        (carrier) =>
          carrier.owner !== order.playerId ||
          carrier.hex !== origin ||
          carrier.readyTurn > game.turn ||
          carrier.movesRemaining < 1 ||
          carrier.cu < 1 ||
          used.has(carrier.id),
      ) ||
      !getNeighbors(origin, map).includes(order.destination) ||
      game.hexes.find((hex) => hex.id === order.destination)?.revealed !== true ||
      game.hexes.find((hex) => hex.id === order.destination)?.kind === "rift"
    ) {
      game.log.unshift(
        `${game.players[order.playerId].name} submitted an invalid fleet movement order; the force held position.`,
      );
      continue;
    }
    force.forEach((carrier) => used.add(carrier.id));
    moves.push({ ...order, origin });
  }

  const edgeResolved = new Set<number>();
  for (let i = 0; i < moves.length; i++)
    for (let j = i + 1; j < moves.length; j++)
      if (
        !edgeResolved.has(i) &&
        !edgeResolved.has(j) &&
        moves[i].origin === moves[j].destination &&
        moves[i].destination === moves[j].origin &&
        hostile(game, moves[i].playerId, moves[j].playerId)
      ) {
        resolveEdgePair(game, moves[i], moves[j]);
        edgeResolved.add(i);
        edgeResolved.add(j);
      }

  moves.forEach((move, index) => {
    if (edgeResolved.has(index)) return;
    carrierForce(game, move.carrierIds).forEach((carrier) => {
      carrier.hex = move.destination;
      carrier.movesRemaining--;
    });
  });
  new Set(moves.map((move) => move.destination)).forEach((destination) =>
    resolveSimultaneousHex(game, destination),
  );
  game.selectedCarrierIds = game.selectedCarrierIds.filter((id) =>
    game.carriers.some((carrier) => carrier.id === id),
  );
}

function resolveCombat(game: GameState, attackerId: number, destination: string): void {
  const attackers = game.carriers.filter(carrier => carrier.hex === destination && carrier.owner === attackerId);
  const habitat = game.hexes.find(hex => hex.id === destination && hex.tier && hex.owner !== attackerId && hex.owner !== undefined && !hasBenefit(game, attackerId, hex.owner, "openBorders"));
  const hostileOwners = new Set<number>();
  game.carriers.filter(carrier => carrier.hex === destination && carrier.owner !== attackerId && !hasBenefit(game, attackerId, carrier.owner, "defensive")).forEach(carrier => hostileOwners.add(carrier.owner));
  if (habitat?.owner !== undefined) hostileOwners.add(habitat.owner);
  if (!hostileOwners.size) return;
  const hostileCarriers = game.carriers.filter(carrier => carrier.hex === destination && hostileOwners.has(carrier.owner));
  const attackCS = attackers.reduce((sum, carrier) => sum + carrier.cu, 0);
  const defendingCU = hostileCarriers.reduce((sum, carrier) => sum + carrier.cu, 0) + (habitat?.combat || 0);
  const assaultReduction = habitat && attackers.some(carrier => carrier.type === "assault") ? 1 : 0;
  const homeGuard = habitat ? Math.max(0, (habitat.centers.includes("defense") ? 3 : 1) - assaultReduction) : 0;
  const defenseCS = defendingCU + homeGuard;
  const opponentIds = [...hostileOwners];
  if (attackCS > defenseCS) {
    trimCarriers(game, attackers, attackCS - defenseCS);
    game.carriers = game.carriers.filter(carrier => !hostileCarriers.some(hostile => hostile.id === carrier.id));
    if (habitat) captureHabitat(game, habitat, attackerId);
    awardVarkesh(game, attackerId, opponentIds);
    game.log.unshift(`${game.players[attackerId].name} won fleet combat at ${destination}, ${attackCS} CS to ${defenseCS} CS.`);
    return;
  }
  game.carriers = game.carriers.filter(carrier => !attackers.some(attacker => attacker.id === carrier.id));
  if (attackCS === defenseCS) {
    if (habitat) habitat.combat = 0;
    game.carriers = game.carriers.filter(carrier => !hostileCarriers.some(hostile => hostile.id === carrier.id));
    game.log.unshift(`Fleet combat at ${destination} ended in mutual destruction at ${attackCS} CS each.`);
    return;
  }
  defenderCasualties(game, hostileCarriers, habitat, attackCS);
  opponentIds.forEach(owner => awardVarkesh(game, owner, [attackerId]));
  game.log.unshift(`${game.players[attackerId].name} lost fleet combat at ${destination}, ${attackCS} CS to ${defenseCS} CS.`);
}

export function moveCarriers(game: GameState, playerId: number, carrierIds: string[], destination: string): { ok: boolean; message: string } {
  const carriers = carrierIds.map(id => game.carriers.find(carrier => carrier.id === id)).filter((carrier): carrier is CarrierState => !!carrier);
  if (!carriers.length || carriers.some(carrier => carrier.owner !== playerId)) return { ok: false, message: "Select at least one of your carriers." };
  const origin = carriers[0].hex;
  if (carriers.some(carrier => carrier.hex !== origin)) return { ok: false, message: "A task force must begin in one hex." };
  if (carriers.some(carrier => carrier.readyTurn > game.turn || carrier.movesRemaining < 1 || carrier.cu < 1)) return { ok: false, message: "Every selected carrier must be ready, crewed, and have movement remaining." };
  if (!getNeighbors(origin, mapLibrary[game.mapId]).includes(destination)) return { ok: false, message: "Task forces move one adjacent hex at a time." };
  const target = game.hexes.find(hex => hex.id === destination);
  if (!target || target.kind === "rift" || !target.revealed) return { ok: false, message: "Military carriers cannot enter that hex." };
  const encounteredOwners = new Set<number>();
  game.carriers.filter(carrier => carrier.hex === destination && carrier.owner !== playerId).forEach(carrier => encounteredOwners.add(carrier.owner));
  if (target.owner !== undefined && target.owner !== playerId) encounteredOwners.add(target.owner);
  for (const owner of encounteredOwners) {
    const peacefulHabitatPassage = target.owner === owner && hasBenefit(game, playerId, owner, "openBorders");
    const peacefulFleetPresence = hasBenefit(game, playerId, owner, "defensive");
    if (!peacefulHabitatPassage && !peacefulFleetPresence && hasBenefit(game, playerId, owner, "nonAggression")) return { ok: false, message: `Your agreement with ${game.players[owner].name} blocks hostile movement.` };
  }
  if ([...encounteredOwners].some(owner => {
    const peacefulHabitatPassage = target.owner === owner && hasBenefit(game, playerId, owner, "openBorders");
    const peacefulFleetPresence = hasBenefit(game, playerId, owner, "defensive");
    return !peacefulHabitatPassage && !peacefulFleetPresence;
  })) game.players[playerId].legacyMetrics.combatInitiated[game.era - 1]++;
  carriers.forEach(carrier => { carrier.hex = destination; carrier.movesRemaining--; });
  resolveCombat(game, playerId, destination);
  game.selected = destination;
  game.selectedCarrierIds = game.selectedCarrierIds.filter(id => game.carriers.some(carrier => carrier.id === id));
  return { ok: true, message: `Task force moved to ${destination}.` };
}

export function taskForceSummary(game: GameState, carrierIds: string[]): { carriers: number; cu: number; movement: number } {
  const carriers = game.carriers.filter(carrier => carrierIds.includes(carrier.id));
  return { carriers: carriers.length, cu: carriers.reduce((sum, carrier) => sum + carrier.cu, 0), movement: carriers.length ? Math.min(...carriers.map(carrier => carrier.movesRemaining)) : 0 };
}

export function formatCost(cost: Record<string, number>): string {
  const labels: Record<string, string> = { material: "M", currency: "C", research: "R", influence: "I", labor: "L" };
  return Object.entries(cost).filter(([, amount]) => amount).map(([resource, amount]) => `${amount}${labels[resource] || resource[0].toUpperCase()}`).join(" · ");
}

export function totalCombatUnits(game: GameState, playerId: number): number {
  return game.carriers.filter(carrier => carrier.owner === playerId).reduce((sum, carrier) => sum + carrier.cu, 0) + game.hexes.filter(hex => hex.owner === playerId).reduce((sum, hex) => sum + hex.combat + (hex.pendingCombat || []).reduce((pending, force) => pending + force.amount, 0), 0);
}
