import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  mobileHabitatExtractionResource,
  produceShattered,
  productionPerTurn,
  type MobileHabitatState,
} from "../game";
import { hexProduction } from "../game/rules/hex-production";

function fixture() {
  const game = createGame(2, ["wayfarers", "guilds"], "shattered-reach", "horizon-base", 331201);
  const material = game.hexes.find((hex) => hex.owner === undefined && hex.kind !== "rift")!;
  const currency = game.hexes.find((hex) => hex.owner === undefined && hex.id !== material.id && hex.kind !== "rift")!;
  material.kind = "material";
  material.revealed = true;
  currency.kind = "currency";
  currency.revealed = true;
  const arkship = game.mobileHabitats.find((mobile) => mobile.owner === 0)!;
  arkship.hex = material.id;
  arkship.centers = ["material"];
  const additions: MobileHabitatState[] = [
    { id: "test-grand-ark", owner: 0, type: "grandArk", hex: currency.id, centers: [], caravanGuards: 0, readyTurn: 1, movesRemaining: 1, deployed: true },
    { id: "test-worldship", owner: 0, type: "worldship", hex: material.id, centers: [], caravanGuards: 0, readyTurn: 1, movesRemaining: 1, deployed: true },
  ];
  game.mobileHabitats.push(...additions);
  return { game, material, currency, arkship, grandArk: additions[0], worldship: additions[1] };
}

test("Wayfarer mobile Habitats each extract one matching resource and Mobile Centers remain separate", () => {
  const { game, material, currency } = fixture();
  const player = game.players[0];
  player.tech.Resource = 4;
  const before = { ...player.resources };

  produceShattered(game, 0);

  assert.equal(player.resources.material - before.material, 4, "two ship extractions plus a doubled Material Mobile Center");
  assert.equal(player.resources.currency - before.currency, 1, "Grand Ark extraction is not doubled by Resource IV");
  assert.ok(player.legacyMetrics.wayfarerProductionHexes.includes(material.id));
  assert.ok(player.legacyMetrics.wayfarerProductionHexes.includes(currency.id));
});

test("mobile extraction only applies to deployed Wayfarer ships on stored-resource worlds", () => {
  const { game, arkship, grandArk, worldship } = fixture();
  assert.equal(mobileHabitatExtractionResource(game, arkship), "material");
  assert.equal(mobileHabitatExtractionResource(game, grandArk), "currency");

  grandArk.deployed = false;
  assert.equal(mobileHabitatExtractionResource(game, grandArk), null);
  worldship.hex = game.hexes.find((hex) => hex.kind === "home")!.id;
  assert.equal(mobileHabitatExtractionResource(game, worldship), null);
  arkship.owner = 1;
  assert.equal(mobileHabitatExtractionResource(game, arkship), null);
});

test("bot forecasting and hex details include automatic mobile extraction", () => {
  const { game, material, currency } = fixture();
  game.players[0].tech.Resource = 4;
  const forecast = productionPerTurn(game, 0);

  assert.equal(forecast.material, 4);
  assert.equal(forecast.currency, 1);
  assert.match(hexProduction(game, material), /Arkship: 3 material per Turn/);
  assert.match(hexProduction(game, material), /Worldship: 1 material per Turn/);
  assert.match(hexProduction(game, currency), /Grand Ark: 1 currency per Turn/);
});
