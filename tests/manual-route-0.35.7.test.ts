import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../game/engine/create-game";
import { getNeighbors } from "../game/engine/geometry";
import { mapLibrary } from "../game/maps";
import { resolveSimultaneousCarrierMoves, validateCarrierRoute } from "../game/rules/fleet";
import { projectedOrderBudget } from "../game/rules/purchases";
import { orderLabel } from "../game/rules/orders";

const setup = () => {
  const game = createGame(4, ["varkesh", "foundry", "helix", "meridian"], "standard-board-61", "horizon-base", 819);
  const carrier = game.carriers.find((candidate) => candidate.owner === 0)!;
  carrier.movesRemaining = 2;
  carrier.cu = Math.max(1, carrier.cu);
  const map = mapLibrary[game.mapId];
  const first = getNeighbors(carrier.hex, map).find((id) =>
    getNeighbors(id, map).some((next) => next !== carrier.hex && !getNeighbors(carrier.hex, map).includes(next)))!;
  const destination = getNeighbors(first, map).find((id) => id !== carrier.hex && !getNeighbors(carrier.hex, map).includes(id))!;
  game.hexes.find((hex) => hex.id === first)!.revealed = true;
  game.hexes.find((hex) => hex.id === destination)!.revealed = true;
  return { game, carrier, first, destination };
};

test("manual fleet route traverses the chosen intermediate hex", () => {
  const { game, carrier, first, destination } = setup();
  const path = [first, destination];
  assert.equal(validateCarrierRoute(game, 0, [carrier.id], destination, path).ok, true);
  resolveSimultaneousCarrierMoves(game, [{ playerId: 0, carrierIds: [carrier.id], destination, path }]);
  assert.equal(carrier.lastHex, first);
  assert.equal(carrier.hex, destination);
  assert.equal(carrier.movesRemaining, 0);
  assert.match(orderLabel({ id: "move", kind: "carrierMove", carrierIds: [carrier.id], destination, path }), new RegExp(`via ${first} → ${destination}`));
});

test("server rejects discontinuous, overlong, or destination-mismatched fleet routes", () => {
  const { game, carrier, first, destination } = setup();
  for (const path of [[destination], [first, destination, first], [first]]) {
    const order = { id: "bad", kind: "carrierMove" as const, carrierIds: [carrier.id], destination, path };
    assert.equal(validateCarrierRoute(game, 0, order.carrierIds, destination, path).ok, false);
    assert.ok(projectedOrderBudget(game, 0, [order]).error);
  }
});

test("a manual route bypasses a hostile shortest-path alternative without combat", () => {
  const { game, carrier } = setup();
  const map = mapLibrary[game.mapId];
  const options = getNeighbors(carrier.hex, map);
  const choice = options.flatMap((safe) => getNeighbors(safe, map).map((destination) => ({ safe, destination })))
    .find(({ safe, destination }) => destination !== carrier.hex && !options.includes(destination) &&
      options.some((other) => other !== safe && getNeighbors(other, map).includes(destination)));
  assert.ok(choice);
  const dangerous = options.find((other) => other !== choice.safe && getNeighbors(other, map).includes(choice.destination))!;
  const rival = game.carriers.find((candidate) => candidate.owner !== 0)!;
  rival.hex = dangerous;
  for (const id of [choice.safe, choice.destination, dangerous]) game.hexes.find((hex) => hex.id === id)!.revealed = true;
  const originalCU = carrier.cu;
  resolveSimultaneousCarrierMoves(game, [{ playerId: 0, carrierIds: [carrier.id], destination: choice.destination, path: [choice.safe, choice.destination] }]);
  assert.equal(carrier.hex, choice.destination);
  assert.equal(carrier.cu, originalCU);
  assert.equal(rival.hex, dangerous);
  assert.equal(game.log.some((entry) => entry.includes(`combat at ${dangerous}`)), false);
});
