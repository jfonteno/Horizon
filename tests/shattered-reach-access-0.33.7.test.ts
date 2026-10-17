import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  availableCarrierTypes,
  constructionQuote,
  createGame,
  resolveShatteredConstruction,
} from "../game";

function prepareFaction(faction: "spires" | "aegis" | "wayfarers" | "salvo" | "guilds") {
  const opponent = faction === "spires" ? "aegis" : "spires";
  const game = createGame(2, [faction, opponent], "shattered-reach", "horizon-base", 33700);
  const player = game.players[0];
  const home = game.hexes.find((hex) => hex.owner === player.id && hex.tier)!;
  player.tech = { Military: 4, Economy: 4, Resource: 4, Exploration: 4, Policy: 4 };
  player.resources = { material: 50, currency: 50, research: 50, influence: 50 };
  player.labor = 50;
  player.laborCap = 50;
  return { game, player, home };
}

test("every Shattered Reach faction has usable faction construction quotes", () => {
  const spires = prepareFaction("spires");
  spires.home.tier = "Metropolis";
  assert.equal(constructionQuote(spires.game, 0, spires.home.id, { type: "arcology" }).available, true);
  assert.equal(constructionQuote(spires.game, 0, spires.home.id, { type: "center", center: "defense" }).available, true);

  const aegis = prepareFaction("aegis");
  assert.ok(availableCarrierTypes(aegis.player).includes("blockadeTender"));
  aegis.game.carriers.push({ id: "audit-tender", owner: 0, type: "blockadeTender", hex: aegis.home.id, cu: 1, readyTurn: aegis.game.turn, movesRemaining: 2 });
  assert.equal(constructionQuote(aegis.game, 0, aegis.home.id, { type: "blockade" }).available, true);
  assert.equal(resolveShatteredConstruction(aegis.game, 0, aegis.home.id, { type: "blockade" }), true);
  assert.equal(aegis.game.blockades.some((blockade) => blockade.owner === 0 && blockade.hex === aegis.home.id), true);

  const wayfarers = prepareFaction("wayfarers");
  assert.ok(availableCarrierTypes(wayfarers.player).includes("gunneryPlatform"));
  for (const vessel of ["arkship", "grandArk", "worldship"] as const)
    assert.equal(constructionQuote(wayfarers.game, 0, wayfarers.home.id, { type: "mobileHabitat", vessel }).available, true, vessel);
  const mobile = wayfarers.game.mobileHabitats.find((candidate) => candidate.owner === 0)!;
  assert.equal(constructionQuote(wayfarers.game, 0, mobile.hex, { type: "mobileCenter", mobileHabitatId: mobile.id, center: "currency" }).available, true);
  assert.equal(constructionQuote(wayfarers.game, 0, mobile.hex, { type: "caravanGuard", mobileHabitatId: mobile.id }).available, true);

  const salvo = prepareFaction("salvo");
  assert.deepEqual(availableCarrierTypes(salvo.player).filter((type) => ["bombardFrigate", "siegeCruiser", "siegeTender"].includes(type)), ["bombardFrigate", "siegeCruiser", "siegeTender"]);

  const guilds = prepareFaction("guilds");
  guilds.home.tier = "Metropolis";
  guilds.home.centers = ["material"];
  guilds.home.enhancedCenterIndices = [];
  assert.equal(constructionQuote(guilds.game, 0, guilds.home.id, { type: "factory" }).available, true);
  assert.equal(constructionQuote(guilds.game, 0, guilds.home.id, { type: "enhanceCenter", centerIndex: 0 }).available, true);
});

test("Build and unit interfaces expose every Shattered Reach construction and operation", async () => {
  const build = await readFile(new URL("../app/components/BuildPanel.tsx", import.meta.url), "utf8");
  const board = await readFile(new URL("../app/components/network/NetworkGameBoard.tsx", import.meta.url), "utf8");
  for (const token of [
    'type: "arcology"',
    'type: "blockade"',
    '"blockadeTender"',
    '"gunneryPlatform"',
    '"bombardFrigate", "siegeCruiser", "siegeTender"',
    'type: "mobileHabitat"',
    'type: "mobileCenter"',
    'type: "caravanGuard"',
    'type: "factory"',
    'type: "enhanceCenter"',
    "Factory Operations",
    "Blockade Operations",
    "Sell in Diplomacy",
  ]) assert.match(build, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), token);
  assert.match(board, /Build Blockade Platform/);
  assert.match(board, /Load Blockade/);
  assert.match(board, /Deploy Blockade/);
  assert.match(board, /Bombard a highlighted hex/);
  assert.match(board, /Private Deep Recon/);
  assert.match(board, />Migrate</);
});
