import test from "node:test";
import assert from "node:assert/strict";
import { mapLibrary } from "../game/maps";
import { getNeighbors } from "../game/engine/geometry";
import { routeUsesPortal } from "../app/lib/route-steps";
import { createGame } from "../game/engine/create-game";
import { validateExplorationPath, moveExplorationVessel } from "../game/rules/exploration";
import { validateCarrierRoute } from "../game/rules/fleet";

test("an explorer waypoint does not dereference an absent military selection, or vice versa", () => {
  const map = mapLibrary["standard-board-61"];
  const origin = "2-2";
  const next = getNeighbors(origin, map)[0];
  assert.ok(next);
  assert.equal(routeUsesPortal(undefined, [next], map), false);
  assert.equal(routeUsesPortal(origin, [next], map), false);
});

test("a selected vessel removed by a room update cannot become another vessel's move", () => {
  const game = createGame(4, ["varkesh", "foundry", "helix", "meridian"], "standard-board-61", "horizon-base", 819);
  const explorer = game.players[0].explorationVessels[0];
  const destination = getNeighbors(explorer.hex, mapLibrary[game.mapId])[0];
  const originalHex = explorer.hex;
  assert.equal(validateExplorationPath(game, 0, "removed-explorer", destination, [destination]).ok, false);
  assert.equal(moveExplorationVessel(game, 0, "removed-explorer", destination, [destination]).ok, false);
  assert.equal(explorer.hex, originalHex);
  assert.equal(validateCarrierRoute(game, 0, ["removed-carrier"], destination, [destination]).ok, false);
  // Old single-vessel Orders without IDs still use the primary vessel.
  assert.notEqual(validateExplorationPath(game, 0, undefined, destination, [destination]).message, "Select a ready Exploration vessel.");
});
