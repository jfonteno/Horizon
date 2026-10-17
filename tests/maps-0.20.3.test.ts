import assert from "node:assert/strict";
import test from "node:test";
import { createGame, getNeighbors, mapLibrary } from "../game/index";

const factions = ["varkesh", "helix", "foundry", "farbound", "aurelians", "meridian"] as const;

function playableIds(mapId: string) {
  const map = mapLibrary[mapId];
  return Array.from({ length: map.rows * map.columns }, (_, index) => {
    const row = Math.floor(index / map.columns);
    return `${row}-${index % map.columns}`;
  }).filter((id) => !map.blocked.has(id));
}

function reachableFrom(mapId: string, origin: string) {
  const map = mapLibrary[mapId];
  const reached = new Set([origin]);
  const queue = [origin];
  while (queue.length) {
    const current = queue.shift()!;
    for (const neighbor of getNeighbors(current, map)) {
      if (reached.has(neighbor)) continue;
      reached.add(neighbor);
      queue.push(neighbor);
    }
  }
  return reached;
}

test("Standard Board is a complete side-length-5 hexagon", () => {
  const map = mapLibrary["standard-board"];
  const playable = playableIds(map.id);
  assert.equal(map.rows, 9);
  assert.equal(map.columns, 9);
  assert.equal(playable.length, 61);
  assert.equal(reachableFrom(map.id, "4-4").size, 61);
  assert.equal(getNeighbors("4-4", map).length, 6);
  assert.equal(map.starts.every((id) => playable.includes(id)), true);
  assert.equal(new Set(map.starts).size, 6);
});

test("Shattered Reach keeps 61 sectors while four deep gulfs shape travel", () => {
  const map = mapLibrary["shattered-reach"];
  const playable = playableIds(map.id);
  assert.equal(playable.length, 61);
  assert.equal(reachableFrom(map.id, map.starts[0]).size, 61);
  assert.equal(map.starts.every((id) => playable.includes(id)), true);
  for (const gulf of [
    ["0-4", "1-4", "2-4"],
    ["6-4", "7-4", "8-4"],
    ["3-0", "3-1", "4-1"],
    ["4-7", "5-7", "5-8"],
  ]) assert.equal(gulf.every((id) => map.blocked.has(id)), true, `missing gulf ${gulf.join(", ")}`);

  const game = createGame(6, [...factions], map.id, "horizon-base", 20301);
  assert.equal(game.hexes.filter((hex) => hex.kind !== "rift").length, 61);
  assert.equal(game.hexes.some((hex) => hex.kind === "hazard"), false);
});
