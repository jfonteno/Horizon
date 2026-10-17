import { carrierLibrary } from "./fleet";
import { civilianLibrary } from "./faction-operations";
import { explorationLibrary } from "./exploration";
import { mobileHabitatLibrary } from "./shattered-reach";
import type { GameState, SecretOrder } from "../types";

export type UncommandedUnit = { id: string; hex: string; label: string; kind: "explorer" | "colony" | "civilian" | "carrier" | "mobile" };

export function uncommandedUnits(game: GameState, playerId: number, orders: SecretOrder[]): UncommandedUnit[] {
  const player = game.players[playerId];
  const used = (id: string, kind: UncommandedUnit["kind"]) => orders.some((order) => {
    if (kind === "carrier") return (order.kind === "carrierMove" && order.carrierIds.includes(id)) || (order.kind === "bombard" && order.carrierId === id) || (order.kind === "blockadeCargo" && order.carrierId === id);
    if (kind === "mobile") return order.kind === "migration" && order.mobileHabitatId === id;
    if (kind === "explorer") return ["explorerMove", "explorerScan", "farboundForwardScan", "wayfarerDeepRecon"].includes(order.kind) && "vesselId" in order && (order.vesselId || player.explorationVessels[0]?.id) === id;
    if (kind === "colony") return (order.kind === "colonyMove" || order.kind === "establish") && (order.vesselId || player.colonyShips[0]?.id) === id;
    return ["civilianMove", "longRangeSurvey", "prospect"].includes(order.kind) && "unitId" in order && order.unitId === id;
  });
  return [
    ...player.explorationVessels.filter((unit) => unit.readyTurn <= game.turn && unit.movesRemaining > 0 && !used(unit.id, "explorer")).map((unit) => ({ id: unit.id, hex: unit.hex, label: explorationLibrary[unit.type].name, kind: "explorer" as const })),
    ...player.colonyShips.filter((unit) => unit.readyTurn <= game.turn && unit.movesRemaining > 0 && !used(unit.id, "colony")).map((unit) => ({ id: unit.id, hex: unit.hex, label: "Colony Ship", kind: "colony" as const })),
    ...game.civilianUnits.filter((unit) => unit.owner === playerId && unit.readyTurn <= game.turn && unit.movesRemaining > 0 && !used(unit.id, "civilian")).map((unit) => ({ id: unit.id, hex: unit.hex, label: civilianLibrary[unit.type].name, kind: "civilian" as const })),
    ...game.carriers.filter((unit) => unit.owner === playerId && unit.readyTurn <= game.turn && unit.movesRemaining > 0 && unit.cu > 0 && !used(unit.id, "carrier")).map((unit) => ({ id: unit.id, hex: unit.hex, label: carrierLibrary[unit.type].name, kind: "carrier" as const })),
    ...game.mobileHabitats.filter((unit) => unit.owner === playerId && unit.readyTurn <= game.turn && unit.movesRemaining > 0 && !used(unit.id, "mobile")).map((unit) => ({ id: unit.id, hex: unit.hex, label: mobileHabitatLibrary[unit.type].name, kind: "mobile" as const })),
  ];
}
