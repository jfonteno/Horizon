import { factionLibrary } from "../factions";
import { getNeighbors } from "../engine/geometry";
import { mapLibrary } from "../maps";
import type { GameState, Resource, SecretOrder } from "../types";
import {
  buildCivilian,
  beginFactionTurn,
  civilianLibrary,
  forwardScan,
  longRangeSurvey,
  moveCivilian,
  prospect,
} from "./faction-operations";
import {
  beginFleetTurn,
  buildCarrier,
  carrierLibrary,
  claimHabitatConstruction,
  recruitCombatUnits,
  resolveSimultaneousCarrierMoves,
} from "./fleet";
import {
  canPay,
  centerCosts,
  economicHexKinds,
  spend,
  tributeCosts,
} from "./economy";
import {
  evaluateLegacy,
  finalizeGame,
  scoreHiddenEra,
} from "./legacy";
import {
  processNewTurnDiplomacy,
  refreshContacts,
  researchAgreementDiscount,
  technologyCost,
} from "./diplomacy";
import { projectedOrderBudget } from "./purchases";
import { recordGameSnapshot } from "../analytics";

export function beginSecretOrders(game: GameState) {
  if (game.result) return { ok: false, message: "The game is complete." };
  game.orderProtocol = {
    phase: "orders",
    turn: game.turn,
    currentPlayer: 0,
    submissions: [],
    lastResolution: game.orderProtocol?.lastResolution || [],
  };
  game.active = 0;
  return { ok: true, message: "Secret Orders Phase begun." };
}

function duplicateVesselOrders(orders: SecretOrder[]) {
  const vessels: string[] = [];
  for (const order of orders) {
    if (order.kind === "carrierMove") vessels.push(...order.carrierIds);
    if (
      order.kind === "civilianMove" ||
      order.kind === "prospect" ||
      order.kind === "longRangeSurvey"
    )
      vessels.push(order.unitId);
    if (order.kind === "explorerMove" || order.kind === "forwardScan")
      vessels.push("explorer");
    if (order.kind === "colonyMove" || order.kind === "establish")
      vessels.push("colony");
  }
  return new Set(vessels).size !== vessels.length;
}

export function submitSecretOrders(
  game: GameState,
  playerId: number,
  orders: SecretOrder[],
) {
  const protocol = game.orderProtocol;
  if (
    protocol.phase !== "orders" ||
    protocol.turn !== game.turn ||
    protocol.currentPlayer !== playerId
  )
    return { ok: false, message: "It is not this civilization's Orders handoff." };
  if (protocol.submissions.some((submission) => submission.playerId === playerId))
    return { ok: false, message: "This civilization already sealed its Orders." };
  if ((game.turn - 1) % 4 === 0 && !game.players[playerId].hiddenLegacy[game.era]?.selected)
    return {
      ok: false,
      message: `Choose an Era ${game.era} Hidden Legacy objective before ending this Turn.`,
    };
  if (duplicateVesselOrders(orders))
    return { ok: false, message: "A vessel may issue only one Order per Turn." };
  const constructionHexes = orders
    .filter((order) => order.kind === "construct")
    .map((order) => order.habitatId);
  if (new Set(constructionHexes).size !== constructionHexes.length)
    return { ok: false, message: "Each Habitat may issue one Construction Order." };
  if (orders.filter((order) => order.kind === "technology").length > 1)
    return { ok: false, message: "A civilization may advance Technology once per Turn." };
  if (
    game.era < 4 &&
    orders.filter((order) => order.kind === "tribute").length > 1
  )
    return {
      ok: false,
      message: "A civilization may submit one Tribute Order per Turn before Era IV.",
    };

  const budget = projectedOrderBudget(game, playerId, orders);
  if (budget.error) return { ok: false, message: budget.error };

  protocol.submissions.push({
    playerId,
    turn: game.turn,
    sealedAt: new Date().toISOString(),
    orders: structuredClone(orders.length ? orders : [{ id: `hold-${playerId}`, kind: "hold" }]),
  });
  const next = game.players.find(
    (player) => !protocol.submissions.some((submission) => submission.playerId === player.id),
  );
  if (next) {
    protocol.currentPlayer = next.id;
    game.active = next.id;
    game.selected = mapLibrary[game.mapId].starts[next.id];
    game.selectedCarrierIds = game.carriers
      .filter((carrier) => carrier.owner === next.id && carrier.hex === game.selected)
      .slice(0, 1)
      .map((carrier) => carrier.id);
    return { ok: true, message: `Orders submitted. Pass play to ${next.name}.` };
  }
  protocol.phase = "ready";
  protocol.currentPlayer = 0;
  game.active = 0;
  return { ok: true, message: "All Orders are sealed and ready to resolve." };
}

function resolveScans(game: GameState, orders: Array<{ playerId: number; order: SecretOrder }>) {
  for (const { playerId, order } of orders) {
    if (order.kind === "forwardScan") forwardScan(game, playerId, order.hexId);
    if (order.kind === "longRangeSurvey")
      longRangeSurvey(game, playerId, order.unitId, order.hexId);
  }
}

function resolveCivilianMovement(
  game: GameState,
  orders: Array<{ playerId: number; order: SecretOrder }>,
) {
  const map = mapLibrary[game.mapId];
  for (const { playerId, order } of orders) {
    const player = game.players[playerId];
    if (order.kind === "explorerMove") {
      const target = game.hexes.find((hex) => hex.id === order.destination);
      if (
        getNeighbors(player.explorer, map).includes(order.destination) &&
        target?.kind !== "rift"
      ) {
        player.explorer = order.destination;
        if (target && !target.revealed) {
          target.revealed = true;
          player.legacyMetrics.revealedHexes[game.era - 1]++;
          if (target.kind === "anomaly") {
            player.resources.research++;
            target.anomalyResolvedBy = playerId;
          }
        }
      }
    }
    if (order.kind === "colonyMove") {
      const target = game.hexes.find((hex) => hex.id === order.destination);
      if (
        getNeighbors(player.colonyShip, map).includes(order.destination) &&
        target?.revealed &&
        target.kind !== "rift"
      )
        player.colonyShip = order.destination;
    }
    if (order.kind === "civilianMove")
      moveCivilian(game, playerId, order.unitId, order.destination);
  }
}

function resolveLocations(
  game: GameState,
  orders: Array<{ playerId: number; order: SecretOrder }>,
) {
  for (const { playerId, order } of orders) {
    const player = game.players[playerId];
    if (order.kind === "prospect") prospect(game, playerId, order.unitId);
    if (order.kind !== "establish") continue;
    const hex = game.hexes.find((candidate) => candidate.id === order.hexId);
    if (
      !hex ||
      player.colonyShip !== hex.id ||
      !hex.revealed ||
      !player.modules ||
      hex.owner !== undefined ||
      ["rift", "hazard", "anomaly", "empty"].includes(hex.kind)
    )
      continue;
    player.modules--;
    hex.owner = playerId;
    hex.tier = "Outpost";
    player.legacyMetrics.habitatsEstablished[game.era - 1]++;
    if (player.faction === "farbound" && hex.surveyedBy?.includes(playerId)) {
      player.resources.material++;
      player.resources.currency++;
      if (
        !player.legacyMetrics.discountedHabitats.some((entry) =>
          entry.startsWith(`era-${game.era}:`),
        )
      )
        player.labor = Math.min(player.laborCap, player.labor + 1);
      player.legacyMetrics.discountedHabitats.push(`era-${game.era}:${hex.id}`);
    }
    game.log.unshift(`${player.name} established an Outpost at ${hex.id}.`);
  }
}

function constructionCost(
  game: GameState,
  playerId: number,
  habitatId: string,
  order: Extract<SecretOrder, { kind: "construct" }>,
) {
  const player = game.players[playerId],
    habitat = game.hexes.find((hex) => hex.id === habitatId),
    construction = order.construction;
  if (!habitat?.tier || habitat.owner !== playerId) return null;
  if (construction.type === "module")
    return { material: 3, currency: 2, labor: player.faction === "foundry" ? 0 : 2 };
  if (construction.type === "upgrade")
    return habitat.tier === "Outpost"
      ? { material: 2, currency: 2, labor: 2 }
      : habitat.tier === "Colony"
        ? { material: 3, currency: 3, labor: 3 }
        : null;
  if (construction.type === "center") {
    if (construction.center === "defense") return { material: 2, currency: 1, labor: 1 };
    if (player.faction === "helix" && construction.center === "research")
      return { material: 1, currency: 1, labor: 1 };
    return centerCosts[construction.center];
  }
  return {};
}

function resolveConstruction(
  game: GameState,
  orders: Array<{ playerId: number; order: SecretOrder }>,
) {
  for (const { playerId, order } of orders) {
    if (order.kind !== "construct") continue;
    const player = game.players[playerId],
      habitat = game.hexes.find((hex) => hex.id === order.habitatId),
      construction = order.construction;
    if (construction.type === "carrier") {
      buildCarrier(game, playerId, order.habitatId, construction.carrier);
      continue;
    }
    if (construction.type === "recruit") {
      recruitCombatUnits(game, playerId, order.habitatId, construction.pairs);
      continue;
    }
    if (construction.type === "civilian") {
      buildCivilian(game, playerId, order.habitatId, construction.civilian);
      continue;
    }
    const cost = constructionCost(game, playerId, order.habitatId, order);
    if (!habitat?.tier || !cost || !canPay(player, cost)) continue;
    if (
      construction.type === "upgrade" &&
      ((habitat.tier === "Outpost" && player.tech.Resource < 2) ||
        (habitat.tier === "Colony" && player.tech.Resource < 3))
    )
      continue;
    if (construction.type === "center") {
      const cap = habitat.tier === "Outpost" ? 1 : habitat.tier === "Colony" ? 2 : 3;
      if (habitat.centers.length >= cap) continue;
      if (construction.center === "defense" && habitat.centers.includes("defense")) continue;
    }
    if (!claimHabitatConstruction(game, habitat.id)) continue;
    spend(player, cost);
    if (construction.type === "module") player.modules++;
    else if (construction.type === "upgrade") {
      habitat.tier = habitat.tier === "Outpost" ? "Colony" : "Metropolis";
      player.legacyMetrics.upgradedHabitats[game.era - 1]++;
    } else {
      habitat.centers.push(construction.center);
      player.legacyMetrics.builtCenters[game.era - 1]++;
    }
  }
}

function resolveTechnology(
  game: GameState,
  orders: Array<{ playerId: number; order: SecretOrder }>,
) {
  for (const { playerId, order } of orders) {
    if (order.kind !== "technology") continue;
    const player = game.players[playerId],
      next = player.tech[order.branch] + 1;
    if (next > 4) continue;
    const cost = technologyCost(game, playerId, order.branch, next);
    if (!canPay(player, cost)) continue;
    const discount = researchAgreementDiscount(game, player);
    spend(player, cost);
    player.tech[order.branch] = next;
    player.techAdvancedTurn = game.turn;
    player.legacyMetrics.technologyAdvances[game.era - 1].push(order.branch);
    if (discount) player.diplomacy.researchDiscountEras.push(game.era);
  }
}

function resolveTributes(
  game: GameState,
  orders: Array<{ playerId: number; order: SecretOrder }>,
) {
  const target = game.players.length * 3,
    cost = tributeCosts[game.era],
    remaining = new Map(
      game.players.map((player) => [player.id, structuredClone(player)]),
    ),
    accepted = new Map<number, number>(),
    valid: Array<{ playerId: number; order: SecretOrder }> = [];
  for (const entry of orders) {
    if (entry.order.kind !== "tribute") continue;
    const player = game.players[entry.playerId],
      budget = remaining.get(entry.playerId)!,
      count = accepted.get(entry.playerId) || 0;
    if (
      (game.era < 4 && (player.eraTributes[game.era - 1] || count > 0)) ||
      !canPay(budget, cost)
    )
      continue;
    spend(budget, cost);
    accepted.set(entry.playerId, count + 1);
    valid.push(entry);
  }
  for (const { playerId } of valid) {
    const player = game.players[playerId];
    spend(player, cost);
    player.tributes++;
    player.eraTributes[game.era - 1]++;
    game.log.unshift(`${player.name} fulfilled a sealed Horizon Gate Tribute Order.`);
  }
  game.gate = Math.min(target, game.gate + valid.length);
}

function produce(game: GameState, playerId: number) {
  const player = game.players[playerId],
    owned = game.hexes.filter((hex) => hex.owner === playerId),
    multiplier = player.tech.Resource === 4 ? 2 : 1,
    before = { ...player.resources };
  player.laborCap = Math.max(
    1,
    3 +
      player.laborBonus +
      owned.reduce(
        (sum, hex) =>
          sum +
          (hex.kind === "labor" ? multiplier : 0) +
          hex.centers.filter((center) => center === "labor").length * multiplier,
        0,
      ),
  );
  player.labor = player.laborCap;
  player.resources[factionLibrary[player.faction].homeProduction]++;
  for (const hex of owned) {
    if (
      economicHexKinds.includes(hex.kind as (typeof economicHexKinds)[number]) &&
      hex.kind !== "labor"
    )
      player.resources[hex.kind as Resource] += multiplier;
    for (const center of hex.centers)
      if (
        center !== "labor" &&
        economicHexKinds.includes(center as (typeof economicHexKinds)[number])
      )
        player.resources[center as Resource] += multiplier;
  }
  const eraIndex = game.era - 1,
    amounts = player.legacyMetrics.productionAmounts[eraIndex],
    types: (Resource | "labor")[] = [];
  let total = 0;
  for (const resource of ["material", "currency", "research", "influence"] as Resource[]) {
    const gain = player.resources[resource] - before[resource];
    amounts[resource] = Math.max(amounts[resource], gain);
    total += gain;
    if (gain > 0) types.push(resource);
  }
  player.legacyMetrics.productionTotals[eraIndex] = Math.max(
    player.legacyMetrics.productionTotals[eraIndex],
    total,
  );
  if (owned.some((hex) => hex.kind === "labor" || hex.centers.includes("labor")))
    types.push("labor");
  if (types.length > player.legacyMetrics.productionTypes[eraIndex].length)
    player.legacyMetrics.productionTypes[eraIndex] = types;
}

export function resolveSecretOrders(game: GameState) {
  if (game.orderProtocol.phase !== "ready")
    return { ok: false, message: "Every civilization must seal Orders first." };
  const all = game.orderProtocol.submissions.flatMap((submission) =>
    submission.orders.map((order) => ({ playerId: submission.playerId, order })),
  );
  const before = game.log.length;
  game.orderProtocol.phase = "resolved";
  resolveScans(game, all);
  resolveSimultaneousCarrierMoves(
    game,
    all
      .filter(
        (entry): entry is { playerId: number; order: Extract<SecretOrder, { kind: "carrierMove" }> } =>
          entry.order.kind === "carrierMove",
      )
      .map(({ playerId, order }) => ({
        playerId,
        carrierIds: order.carrierIds,
        destination: order.destination,
      })),
  );
  resolveCivilianMovement(game, all);
  resolveLocations(game, all);
  resolveConstruction(game, all);
  resolveTechnology(game, all);
  resolveTributes(game, all);
  refreshContacts(game);
  evaluateLegacy(game);
  recordGameSnapshot(game, game.turn);

  if (game.turn % 4 === 0) scoreHiddenEra(game, game.era);
  if (game.turn >= 16) finalizeGame(game);
  else {
    game.turn++;
    game.era = Math.min(4, Math.ceil(game.turn / 4));
    processNewTurnDiplomacy(game, game.turn);
    for (const player of game.players) {
      player.disabled = false;
      produce(game, player.id);
      beginFleetTurn(game, player.id);
      beginFactionTurn(game, player.id);
    }
    game.active = 0;
    game.selected = mapLibrary[game.mapId].starts[0];
    game.orderProtocol = {
      phase: "orders",
      turn: game.turn,
      currentPlayer: 0,
      submissions: [],
      lastResolution: game.log.slice(0, game.log.length - before),
    };
  }
  return { ok: true, message: "All sealed Orders resolved simultaneously." };
}

export function orderLabel(order: SecretOrder) {
  switch (order.kind) {
    case "hold":
      return order.label || "Hold";
    case "carrierMove":
      return `Move ${order.carrierIds.length} carrier${order.carrierIds.length === 1 ? "" : "s"} to ${order.destination}`;
    case "explorerMove":
      return `Explorer to ${order.destination}`;
    case "colonyMove":
      return `Colony Ship to ${order.destination}`;
    case "civilianMove":
      return `Faction vessel to ${order.destination}`;
    case "forwardScan":
      return `Forward Scan ${order.hexId}`;
    case "longRangeSurvey":
      return `Long-Range Survey ${order.hexId}`;
    case "establish":
      return `Establish Habitat at ${order.hexId}`;
    case "prospect":
      return "Prospect current world";
    case "construct":
      return `${order.construction.type === "module"
        ? "Habitat Module"
        : order.construction.type === "upgrade"
          ? "Habitat Upgrade"
          : order.construction.type === "center"
            ? order.construction.center === "defense" ? "Defense Grid" : `${order.construction.center[0].toUpperCase()}${order.construction.center.slice(1)} Center`
            : order.construction.type === "carrier"
              ? carrierLibrary[order.construction.carrier].name
              : order.construction.type === "civilian"
                ? civilianLibrary[order.construction.civilian].name
                : `${order.construction.pairs * 2} Combat Units`} at ${order.habitatId}`;
    case "technology":
      return `Advance ${order.branch}`;
    case "tribute":
      return "Horizon Gate Tribute";
  }
}
