import type { CarrierState, GameState, SecretOrder } from "../types";

export const blockadeConstructionCost = { material: 3, currency: 2, labor: 2 } as const;

export function blockadeCargoCapacity(carrier: Pick<CarrierState, "type">) {
  return carrier.type === "blockadeTender" ? 3 : 1;
}

export function loadedBlockades(game: GameState, carrierId: string) {
  return game.blockades.filter((blockade) => blockade.carrierId === carrierId && !blockade.active);
}

export function syncLoadedBlockades(game: GameState) {
  for (const blockade of game.blockades.filter((candidate) => candidate.carrierId)) {
    const carrier = game.carriers.find((candidate) => candidate.id === blockade.carrierId);
    if (!carrier) {
      blockade.carrierId = undefined;
      blockade.active = false;
      continue;
    }
    blockade.owner = carrier.owner;
    blockade.hex = carrier.hex;
    blockade.active = false;
  }
}

export function destroyLoadedBlockades(game: GameState, carrierIds: Iterable<string>) {
  const destroyedCarriers = new Set(carrierIds);
  const destroyed = game.blockades.filter((blockade) => blockade.carrierId && destroyedCarriers.has(blockade.carrierId));
  for (const blockade of destroyed) {
    blockade.carrierId = undefined;
    blockade.active = false;
    game.log.unshift(`${game.players[blockade.owner].name}'s carried Blockade was destroyed with its military vessel at ${blockade.hex}.`);
  }
}

export function resolveBlockadeCargoOrder(
  game: GameState,
  playerId: number,
  order: Extract<SecretOrder, { kind: "blockadeCargo" }>,
) {
  const carrier = game.carriers.find((candidate) => candidate.id === order.carrierId && candidate.owner === playerId);
  const blockade = game.blockades.find((candidate) => candidate.id === order.blockadeId && candidate.owner === playerId);
  if (!carrier || !blockade || carrier.readyTurn > game.turn || carrier.cu < 1) return false;

  if (order.action === "load") {
    if (!blockade.active || blockade.carrierId || blockade.readyTurn > game.turn || blockade.hex !== carrier.hex) return false;
    if (loadedBlockades(game, carrier.id).length >= blockadeCargoCapacity(carrier)) return false;
    blockade.active = false;
    blockade.carrierId = carrier.id;
    blockade.hex = carrier.hex;
    game.log.unshift(`${game.players[playerId].name} loaded ${blockade.id} onto ${carrier.id}.`);
    return true;
  }

  if (blockade.carrierId !== carrier.id || blockade.active) return false;
  if (game.blockades.some((candidate) => candidate.id !== blockade.id && candidate.active && candidate.hex === carrier.hex)) return false;
  blockade.carrierId = undefined;
  blockade.active = true;
  blockade.hex = carrier.hex;
  blockade.readyTurn = game.turn;
  game.log.unshift(`${game.players[playerId].name} deployed ${blockade.id} from ${carrier.id} at ${carrier.hex}.`);
  return true;
}

export function legalBlockadeSaleDestinations(game: GameState, buyerId: number) {
  return game.hexes.filter((hex) =>
    hex.owner === buyerId &&
    hex.kind !== "rift" &&
    !game.blockades.some((blockade) => blockade.active && blockade.hex === hex.id),
  );
}

export function placeSoldBlockade(game: GameState, blockadeId: string, buyerId: number, destinationHexId: string) {
  const blockade = game.blockades.find((candidate) => candidate.id === blockadeId);
  const destination = legalBlockadeSaleDestinations(game, buyerId).find((hex) => hex.id === destinationHexId);
  if (!blockade || !destination) return false;
  blockade.owner = buyerId;
  blockade.hex = destination.id;
  blockade.active = true;
  blockade.carrierId = undefined;
  blockade.readyTurn = game.turn;
  return true;
}

export function placeCommissionedBlockade(game: GameState, sellerId: number, buyerId: number, destinationHexId: string) {
  const destination = legalBlockadeSaleDestinations(game, buyerId).find((hex) => hex.id === destinationHexId);
  if (!destination) return false;
  game.blockades.push({ id: `blockade-commission-${sellerId}-${game.turn}-${game.blockades.length + 1}`,
    owner: buyerId, hex: destination.id, active: true, readyTurn: game.turn, originFaction: "aegis" });
  return true;
}
