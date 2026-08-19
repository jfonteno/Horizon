import { getNeighbors } from "../engine/geometry";
import { mapLibrary } from "../maps";
import type { CivilianUnitType, GameState, Resource, TradeBundle } from "../types";
import { canPay, spend } from "./economy";
import { claimHabitatConstruction } from "./fleet";

export const civilianLibrary: Record<
  CivilianUnitType,
  {
    name: string;
    faction: string;
    move: number;
    cost: Record<string, number>;
    special: string;
  }
> = {
  prospector: {
    name: "Prospector",
    faction: "foundry",
    move: 1,
    cost: { material: 2, currency: 1, labor: 1 },
    special:
      "Prospect one eligible unclaimed world for 1 Material, once per hex.",
  },
  envoy: {
    name: "Envoy",
    faction: "aurelians",
    move: 2,
    cost: { material: 1, currency: 2, labor: 1 },
    special: "Hosted trades generate 1 Influence for the Aurelians.",
  },
  surveyor: {
    name: "Long-Range Surveyor",
    faction: "farbound",
    move: 1,
    cost: { material: 3, currency: 2, labor: 1 },
    special: "Privately survey any unrevealed hex once per Turn.",
  },
};

function unitId(game: GameState, owner: number) {
  let i = game.civilianUnits.length + 1;
  while (game.civilianUnits.some((u) => u.id === `civilian-${owner}-${i}`)) i++;
  return `civilian-${owner}-${i}`;
}
export function availableCivilianType(
  game: GameState,
  playerId: number,
): CivilianUnitType | undefined {
  const p = game.players[playerId];
  if (p.tech.Exploration < 2) return;
  return p.faction === "foundry"
    ? "prospector"
    : p.faction === "aurelians"
      ? "envoy"
      : p.faction === "farbound"
        ? "surveyor"
        : undefined;
}
export function buildCivilian(
  game: GameState,
  playerId: number,
  habitatId: string,
  type: CivilianUnitType,
) {
  const p = game.players[playerId],
    h = game.hexes.find((x) => x.id === habitatId),
    d = civilianLibrary[type];
  if (!h?.tier || h.owner !== playerId)
    return { ok: false, message: "Select one of your Habitats." };
  if (p.faction !== d.faction || p.tech.Exploration < 2)
    return {
      ok: false,
      message: `${d.name} requires its matching faction at Exploration II.`,
    };
  if (!canPay(p, d.cost))
    return { ok: false, message: "You cannot afford that civilian vessel." };
  if (!claimHabitatConstruction(game, habitatId))
    return {
      ok: false,
      message: "That Habitat already used its Construction Order this Turn.",
    };
  spend(p, d.cost);
  game.civilianUnits.push({
    id: unitId(game, playerId),
    owner: playerId,
    type,
    hex: habitatId,
    readyTurn: game.turn + 1,
    movesRemaining: 0,
  });
  game.log.unshift(`${p.name} constructed a ${d.name} at ${habitatId}.`);
  return { ok: true, message: `${d.name} constructed for next Turn.` };
}
export function beginFactionTurn(game: GameState, playerId: number) {
  for (const u of game.civilianUnits.filter((x) => x.owner === playerId))
    u.movesRemaining =
      u.readyTurn <= game.turn ? civilianLibrary[u.type].move : 0;
}
export function moveCivilian(
  game: GameState,
  playerId: number,
  unitIdValue: string,
  destination: string,
) {
  const u = game.civilianUnits.find((x) => x.id === unitIdValue),
    target = game.hexes.find((x) => x.id === destination);
  if (!u || u.owner !== playerId)
    return { ok: false, message: "Select one of your faction vessels." };
  if (u.readyTurn > game.turn || u.movesRemaining < 1)
    return { ok: false, message: "That vessel cannot move again this Turn." };
  if (!target || target.kind === "rift" || !target.revealed)
    return {
      ok: false,
      message: "Faction vessels require a revealed navigable destination.",
    };
  if (!getNeighbors(u.hex, mapLibrary[game.mapId]).includes(destination))
    return {
      ok: false,
      message: "Faction vessels move through adjacent hexes.",
    };
  u.hex = destination;
  u.movesRemaining--;
  game.selected = destination;
  return {
    ok: true,
    message: `${civilianLibrary[u.type].name} moved to ${destination}.`,
  };
}
export function prospect(
  game: GameState,
  playerId: number,
  unitIdValue: string,
) {
  const p = game.players[playerId],
    u = game.civilianUnits.find((x) => x.id === unitIdValue),
    h = u && game.hexes.find((x) => x.id === u.hex);
  if (p.faction !== "foundry" || u?.type !== "prospector")
    return { ok: false, message: "Select a Foundry Prospector." };
  if (u.usedTurn === game.turn)
    return { ok: false, message: "That Prospector already acted this Turn." };
  if (u.movesRemaining < civilianLibrary.prospector.move)
    return {
      ok: false,
      message: "Prospecting replaces this vessel's movement for the Turn.",
    };
  if (
    !h ||
    !h.revealed ||
    h.owner !== undefined ||
    h.prospected ||
    ![
      "material",
      "currency",
      "research",
      "influence",
      "labor",
      "barren",
    ].includes(h.kind)
  )
    return {
      ok: false,
      message:
        "Prospect requires an eligible revealed, unclaimed, unprospected world.",
    };
  h.prospected = true;
  u.usedTurn = game.turn;
  p.resources.material++;
  p.legacyMetrics.prospectedHexes.push(h.id);
  game.log.unshift(`${p.name} Prospected ${h.id} and gained 1 Material.`);
  return { ok: true, message: "Prospecting complete. Gained 1 Material." };
}
function recordSurvey(game: GameState, playerId: number, hexId: string) {
  const p = game.players[playerId],
    h = game.hexes.find((x) => x.id === hexId);
  if (!h || h.revealed || h.kind === "rift") return false;
  if (!p.privateSurveys.some((s) => s.hexId === hexId))
    p.privateSurveys.push({
      hexId,
      kind: h.kind,
      surveyedTurn: game.turn,
      soldTo: [],
    });
  h.surveyedBy ||= [];
  if (!h.surveyedBy.includes(playerId)) h.surveyedBy.push(playerId);
  return true;
}
export function forwardScan(game: GameState, playerId: number, hexId: string) {
  const p = game.players[playerId];
  if (p.faction !== "farbound")
    return { ok: false, message: "Forward Scanning is a Farbound ability." };
  if (p.forwardScanUsedTurn === game.turn)
    return {
      ok: false,
      message: "Forward Scanning is limited to once per Turn.",
    };
  if (
    !getNeighbors(p.explorer, mapLibrary[game.mapId]).includes(hexId) ||
    !recordSurvey(game, playerId, hexId)
  )
    return {
      ok: false,
      message: "Choose an unrevealed hex adjacent to the Exploration vessel.",
    };
  p.forwardScanUsedTurn = game.turn;
  return { ok: true, message: `Private survey recorded for ${hexId}.` };
}
export function longRangeSurvey(
  game: GameState,
  playerId: number,
  unitIdValue: string,
  hexId: string,
) {
  const p = game.players[playerId],
    u = game.civilianUnits.find((x) => x.id === unitIdValue);
  if (p.faction !== "farbound" || u?.type !== "surveyor")
    return { ok: false, message: "Select a Long-Range Surveyor." };
  if (p.surveyUsedTurn === game.turn || u.readyTurn > game.turn)
    return {
      ok: false,
      message: "Long-Range Survey is unavailable this Turn.",
    };
  if (!recordSurvey(game, playerId, hexId))
    return { ok: false, message: "Choose a publicly unrevealed hex." };
  p.surveyUsedTurn = game.turn;
  u.usedTurn = game.turn;
  return {
    ok: true,
    message: `Private long-range survey recorded for ${hexId}.`,
  };
}
export function surveyExchange(
  game: GameState,
  farboundId: number,
  buyerId: number,
  hexId: string,
  price: number,
) {
  const seller = game.players[farboundId],
    buyer = game.players[buyerId],
    survey = seller.privateSurveys.find((s) => s.hexId === hexId),
    h = game.hexes.find((x) => x.id === hexId);
  if (seller.tech.Policy < 2)
    return {
      ok: false,
      message: "Survey Exchange requires Policy II.",
    };
  if (seller.faction !== "farbound" || !survey || h?.revealed)
    return {
      ok: false,
      message: "Only unrevealed Farbound survey data may be sold.",
    };
  if (price < 0 || buyer.resources.currency < price)
    return {
      ok: false,
      message: "The buyer cannot pay the agreed Currency price.",
    };
  buyer.resources.currency -= price;
  seller.resources.currency += price;
  if (!survey.soldTo.includes(buyerId)) survey.soldTo.push(buyerId);
  if (!seller.legacyMetrics.surveySales.includes(buyerId))
    seller.legacyMetrics.surveySales.push(buyerId);
  game.log.unshift(
    `${seller.name} sold survey data for ${hexId} to ${buyer.name}.`,
  );
  return {
    ok: true,
    message: `Survey sold. The buyer privately learns ${hexId} is ${survey.kind}.`,
    privateDetail: `${hexId}: ${survey.kind}`,
  };
}
export function brokerTrade(
  game: GameState,
  meridianId: number,
  a: number,
  b: number,
  aGives: TradeBundle,
  bGives: TradeBundle,
) {
  const broker = game.players[meridianId],
    pa = game.players[a],
    pb = game.players[b];
  if (broker.faction !== "meridian" || new Set([meridianId, a, b]).size < 3)
    return {
      ok: false,
      message: "Brokerage requires the Meridian and two other civilizations.",
    };
  const pair = [a, b].sort((x, y) => x - y).join("-");
  if (broker.legacyMetrics.brokeragePairs.includes(`${game.turn}:${pair}`))
    return {
      ok: false,
      message: "That civilization pair was already brokered this Turn.",
    };
  if (aGives.labor || bGives.labor)
    return {
      ok: false,
      message:
        "Brokerage currently handles Material, Currency, and Research. Labor requires direct agreements.",
    };
  for (const r of ["material", "currency", "research"] as Resource[])
    if (pa.resources[r] < aGives[r] || pb.resources[r] < bGives[r])
      return {
        ok: false,
        message: "One civilization cannot provide the agreed exchange.",
      };
  for (const r of ["material", "currency", "research"] as Resource[]) {
    pa.resources[r] -= aGives[r];
    pb.resources[r] += aGives[r];
    pb.resources[r] -= bGives[r];
    pa.resources[r] += bGives[r];
  }
  broker.resources.currency++;
  broker.legacyMetrics.marketCurrencyEarned++;
  broker.legacyMetrics.brokeragePairs.push(`${game.turn}:${pair}`);
  game.log.unshift(
    `${broker.name} brokered a trade between ${pa.name} and ${pb.name}, gaining 1 Currency.`,
  );
  return {
    ok: true,
    message: "Brokered trade completed. Meridian gained 1 Currency.",
  };
}
export function economicSalvage(game: GameState, playerId: number) {
  const p = game.players[playerId];
  if (p.faction !== "meridian" || p.tech.Economy < 3)
    return {
      ok: false,
      message: "Economic Salvage requires the Meridian at Economy III.",
    };
  if (game.hexes.filter((x) => x.owner === playerId).reduce((sum, h) => sum + h.combat, 0) < 4)
    return { ok: false, message: "Station at least 4 CU across your Habitats to salvage." };
  let remaining = 4;
  for (const h of game.hexes.filter(
    (x) => x.owner === playerId && x.combat > 0,
  )) {
    const n = Math.min(remaining, h.combat);
    h.combat -= n;
    remaining -= n;
    if (!remaining) break;
  }
  p.resources.currency++;
  p.legacyMetrics.marketCurrencyEarned++;
  return { ok: true, message: "Removed 4 CU and gained 1 Currency." };
}
