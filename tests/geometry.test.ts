import assert from "node:assert/strict";
import test from "node:test";
import { getNeighbors, mapLibrary } from "../game/index";

test("backend adjacency matches the rendered odd-column hex layout", () => {
  const map = mapLibrary["shattered-reach"];
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.columns; col++) {
      const id = `${row}-${col}`;
      if (map.blocked.has(id)) continue;
      const expected = (col % 2
        ? [[-1,0],[1,0],[0,-1],[1,-1],[0,1],[1,1]]
        : [[-1,0],[1,0],[-1,-1],[0,-1],[-1,1],[0,1]])
        .map(([dr, dc]) => [row + dr, col + dc] as const)
        .filter(([r, c]) => r >= 0 && r < map.rows && c >= 0 && c < map.columns)
        .map(([r, c]) => `${r}-${c}`)
        .filter((candidate) => !map.blocked.has(candidate))
        .sort();
      assert.deepEqual(getNeighbors(id, map).sort(), expected, id);
    }
  }
});

test("every traversable adjacency is reciprocal", () => {
  const map = mapLibrary["shattered-reach"];
  for (const hex of Array.from({ length: map.rows * map.columns }, (_, index) => `${Math.floor(index / map.columns)}-${index % map.columns}`)) {
    if (map.blocked.has(hex)) continue;
    for (const neighbor of getNeighbors(hex, map))
      assert.ok(getNeighbors(neighbor, map).includes(hex), `${hex} -> ${neighbor}`);
  }
});
