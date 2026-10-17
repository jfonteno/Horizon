import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("owned Habitat clicks and the Build tab share the complete BuildPanel", async () => {
  const board = await readFile(new URL("../app/components/network/NetworkGameBoard.tsx", import.meta.url), "utf8");
  const build = await readFile(new URL("../app/components/BuildPanel.tsx", import.meta.url), "utf8");

  assert.match(board, /function openBuildAt\(hexId: string\)/);
  assert.match(board, /hex\?\.owner === player\.id && hex\.tier[\s\S]+?openBuildAt\(id\)/);
  assert.match(board, /panel === "build"[\s\S]+?<BuildPanel/);
  assert.match(board, /Open complete Build menu/);
  assert.doesNotMatch(board, /quickConstructions|draftQuickConstruction|quickConstructionStatus/);

  for (const factionOption of ["arcology", "blockade", "mobileHabitat", "mobileCenter", "caravanGuard", "factory", "enhanceCenter"])
    assert.match(build, new RegExp(`type: ["']${factionOption}["']`));
});
