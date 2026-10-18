import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../game/engine/create-game";
import { getNeighbors } from "../game/engine/geometry";
import { mapLibrary } from "../game/maps";
import { movementTargets } from "../app/lib/movement-targets";
import { moveExplorationVessel, validateExplorationPath } from "../game/rules/exploration";
import { validateCarrierRoute } from "../game/rules/fleet";
import { projectedOrderBudget } from "../game/rules/purchases";

function setup() {
  return createGame(4, ["varkesh", "foundry", "helix", "meridian"], "standard-board-61", "horizon-base", 819);
}

test("moving an explorer still highlights fog after its public scan allowance is used", () => {
  const game = setup(), vessel = game.players[0].explorationVessels[0];
  vessel.publicReveals = 1;
  vessel.movesRemaining = 2;
  const destination = getNeighbors(vessel.hex, mapLibrary[game.mapId]).find((id) =>
    game.hexes.some((hex) => hex.id === id && hex.kind !== "rift" && !hex.revealed))!;
  assert.ok(destination);
  const path = movementTargets(game, 0, vessel.hex, vessel.movesRemaining, "explorer").get(destination);
  assert.deepEqual(path, [destination]);
  assert.equal(moveExplorationVessel(game, 0, vessel.id, destination, path).ok, true);
  assert.equal(game.hexes.find((hex) => hex.id === destination)?.revealed, true);
});

test("a direct fleet destination uses the safe known intermediate hex when possible", () => {
  const game = setup(), carrier = game.carriers.find((candidate) => candidate.owner === 0)!;
  carrier.cu = 1;
  carrier.movesRemaining = 2;
  const map = mapLibrary[game.mapId];
  const adjacent = getNeighbors(carrier.hex, map);
  const choice = adjacent.flatMap((safe) => getNeighbors(safe, map).map((destination) => ({ safe, destination })))
    .find(({ safe, destination }) => destination !== carrier.hex && !adjacent.includes(destination) &&
      adjacent.some((other) => other !== safe && getNeighbors(other, map).includes(destination)));
  assert.ok(choice);
  const dangerous = adjacent.find((id) => id !== choice.safe && getNeighbors(id, map).includes(choice.destination))!;
  for (const id of [choice.safe, choice.destination, dangerous]) game.hexes.find((hex) => hex.id === id)!.revealed = true;
  game.carriers.find((candidate) => candidate.owner !== 0)!.hex = dangerous;
  const path = movementTargets(game, 0, carrier.hex, 2, "military").get(choice.destination);
  assert.deepEqual(path, [choice.safe, choice.destination]);
  assert.equal(validateCarrierRoute(game, 0, [carrier.id], choice.destination, path).ok, true);
});

test("highlighted vessel destinations match the routes accepted by the game rules", () => {
  const game = setup(), player = game.players[0];
  const explorer = player.explorationVessels[0], colony = player.colonyShips[0];
  const carrier = game.carriers.find((candidate) => candidate.owner === 0)!;
  carrier.cu = 1;
  for (const [destination, path] of movementTargets(game, 0, explorer.hex, explorer.movesRemaining, "explorer"))
    assert.equal(validateExplorationPath(game, 0, explorer.id, destination, path).ok, true);
  for (const [destination, path] of movementTargets(game, 0, colony.hex, colony.movesRemaining, "colony"))
    assert.equal(projectedOrderBudget(game, 0, [{ id: "colony", kind: "colonyMove", vesselId: colony.id, destination, path }]).error, undefined);
  for (const [destination, path] of movementTargets(game, 0, carrier.hex, carrier.movesRemaining, "military"))
    assert.equal(validateCarrierRoute(game, 0, [carrier.id], destination, path).ok, true);
});
