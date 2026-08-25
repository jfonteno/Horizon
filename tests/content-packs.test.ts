import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
  civilizationObjectives,
  availableCivilianType,
  clearExternalFactions,
  clearExternalMaps,
  createGame,
  factionLibrary,
  installContentCatalog,
  mapLibrary,
  MemoryRoomRepository,
  RoomService,
  validateFaction,
  validateMap,
} from "../game/index";
import { loadContentPacks } from "../game/content/node-loader";

test("an external content pack installs a playable map and faction", async (context) => {
  context.after(() => {
    clearExternalMaps();
    clearExternalFactions();
  });
  const catalog = await loadContentPacks(resolve("content-packs"));
  assert.equal(catalog.issues.length, 0);
  assert.deepEqual(catalog.packs.map((pack) => pack.id), ["frontier-example"]);
  assert.match(catalog.maps[0].tileAssets?.unrevealed || "", /^data:image\/svg\+xml;base64,/);
  assert.match(catalog.factions[0].logo || "", /^data:image\/svg\+xml;base64,/);

  installContentCatalog(catalog);
  assert.equal(mapLibrary["outer-rim"].sourcePackVersion, "1.0.0");
  assert.equal(factionLibrary.accord.name, "The Accord");
  const game = createGame(
    4,
    ["accord", "varkesh", "helix", "foundry"],
    "outer-rim",
    "horizon-base",
    1700,
  );
  assert.equal(game.schemaVersion, 14);
  assert.deepEqual(game.contentPacks, [{ id: "frontier-example", version: "1.0.0" }]);
  assert.equal(game.players[0].resources.influence, 2);
  assert.equal(game.players[0].tech.Policy, 2);
  game.players[0].tech.Exploration = 2;
  assert.equal(availableCivilianType(game, 0), "envoy");
  assert.deepEqual(game.hexes.find((hex) => hex.owner === 0)?.centers, ["influence"]);
  assert.equal(civilizationObjectives(game.players[0]).length, 3);
  assert.equal(civilizationObjectives(game.players[0])[0].automatic, false);

  const rooms = new RoomService(new MemoryRoomRepository());
  const created = await rooms.create(game, "Pack Host", "network");
  mapLibrary["outer-rim"].sourcePackVersion = "2.0.0";
  await assert.rejects(
    () => rooms.resume(created.code, created.token),
    /Content pack frontier-example@1\.0\.0 is required/,
  );
});

test("content validation rejects unsafe map and faction definitions", () => {
  assert.ok(validateMap({ id: "Bad Map" }).length > 0);
  assert.ok(validateFaction({ id: "bad_faction", color: "red" }).length > 0);
});
