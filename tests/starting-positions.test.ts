import assert from "node:assert/strict";
import test from "node:test";
import { createGame, mapLibrary } from "../game/index";

const factions = [
  "varkesh",
  "helix",
  "foundry",
  "farbound",
  "aurelians",
  "meridian",
] as const;

function assignment(seed: number, playerCount = 6) {
  const game = createGame(
    playerCount,
    [...factions.slice(0, playerCount)],
    "shattered-reach",
    "horizon-base",
    seed,
  );
  return {
    game,
    starts: game.players.map((player) => player.explorer),
  };
}

test("starting factions are deterministically shuffled among the map start hexes", () => {
  const first = assignment(17201);
  const repeat = assignment(17201);
  assert.deepEqual(first.starts, repeat.starts);
  assert.deepEqual(
    [...first.starts].sort(),
    [...mapLibrary["shattered-reach"].starts].sort(),
  );
  assert.equal(new Set(first.starts).size, first.game.players.length);
  for (const player of first.game.players) {
    const home = first.game.hexes.find(
      (hex) => hex.kind === "home" && hex.originalOwner === player.id,
    );
    assert.equal(home?.id, player.explorer);
    assert.equal(player.colonyShip, player.explorer);
    assert.equal(
      first.game.carriers.find((carrier) => carrier.owner === player.id)?.hex,
      player.explorer,
    );
  }
});

test("different seeds produce varied faction-to-start assignments", () => {
  const signatures = new Set(
    Array.from({ length: 8 }, (_, offset) =>
      assignment(17210 + offset).starts.join("|"),
    ),
  );
  assert.ok(signatures.size >= 4);
});

test("lower player counts shuffle only the currently assigned start hexes", () => {
  const { starts } = assignment(17220, 4);
  assert.deepEqual(
    [...starts].sort(),
    [...mapLibrary["shattered-reach"].startsByPlayerCount![4]!].sort(),
  );
});
