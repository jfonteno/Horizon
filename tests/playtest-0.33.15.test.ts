import assert from "node:assert/strict";
import test from "node:test";
import { createGame, executeRoomCommand, MemoryRoomRepository, RoomService } from "../game/index";
import { setHomeProductionChoice } from "../game/rules/faction-operations";
import { productionForecast } from "../game/rules/production-forecast";
import { hexProduction } from "../game/rules/hex-production";

test("Helix begins with 1 Material and 2 Research; Reallocation changes one Homeworld output", () => {
  const game = createGame(2, ["helix", "foundry"], "shattered-reach", "horizon-base", 331501);
  const helix = game.players[0];
  assert.deepEqual(helix.resources, { material: 1, currency: 0, research: 2, influence: 1 });
  const home = game.hexes.find((hex) => hex.owner === helix.id && hex.kind === "home")!;
  assert.equal(productionForecast(game, helix.id).totals.research, 1);
  assert.equal(productionForecast(game, helix.id).totals.currency, 0);
  assert.equal(setHomeProductionChoice(game, helix.id, "currency").ok, true);
  assert.equal(productionForecast(game, helix.id).totals.research, 0);
  assert.equal(productionForecast(game, helix.id).totals.currency, 1);
  assert.match(hexProduction(game, home), /Currency|currency/);
  assert.equal(setHomeProductionChoice(game, helix.id, "material").ok, true);
  assert.equal(productionForecast(game, helix.id).totals.material, 1);
  assert.equal(productionForecast(game, helix.id).totals.currency, 0);
  assert.equal(setHomeProductionChoice(game, helix.id, "research").ok, true);
  assert.equal(productionForecast(game, helix.id).totals.research, 1);
  assert.equal(setHomeProductionChoice(game, 1, "currency").ok, false);
  game.orderProtocol.phase = "ready";
  assert.equal(setHomeProductionChoice(game, helix.id, "currency").ok, false);
});

test("the host can rename a room and guests cannot; empty names restore the code", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, ["helix", "foundry", "farbound", "aurelians"], "shattered-reach", "horizon-base", 331502);
  const host = await service.create(game, "Host", "network");
  const guest = await service.join(host.code, 1, "Guest");
  const denied = await executeRoomCommand(repository, { code: host.code, token: guest.token, expectedRevision: guest.revision, commandId: "guest-rename", command: { kind: "setRoomName", name: "Nope" } });
  assert.equal(denied.ok, false);
  const renamed = await executeRoomCommand(repository, { code: host.code, token: host.token, expectedRevision: (await service.resume(host.code, host.token)).revision, commandId: "host-rename", command: { kind: "setRoomName", name: "Saturday Reach" } });
  assert.equal(renamed.ok, true);
  assert.equal((await service.resume(host.code, guest.token)).summary.name, "Saturday Reach");
  const reset = await executeRoomCommand(repository, { code: host.code, token: host.token, expectedRevision: renamed.session!.revision, commandId: "reset-rename", command: { kind: "setRoomName", name: " " } });
  assert.equal(reset.ok, true);
  assert.equal(reset.session!.summary.name, host.code);
});
