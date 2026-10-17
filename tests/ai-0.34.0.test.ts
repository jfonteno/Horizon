import assert from "node:assert/strict";
import test from "node:test";
import { botChallengeOptions, getBotProfile } from "../bots";
import { createGame, executeRoomCommand, MemoryRoomRepository, RoomService, resolveSecretOrders, takeBotTurn } from "../game/index";
import type { PlayerController } from "../game/index";
import { createStrategicPlan, factionOutlook, needsCurrencyCenter, productionPerTurn, strategicOrderModifier } from "../game/ai/strategy";
import { getNeighbors } from "../game/engine/geometry";
import { mapLibrary } from "../game/maps";
import { productionForecast } from "../game/rules/production-forecast";
import { isContacted } from "../game/rules/diplomacy";
import { planBotTurn } from "../game/ai/intelligence";

const ids = botChallengeOptions.map((option) => option.id);
const factions = ["meridian", "foundry", "helix", "wayfarers"] as const;
const controllers: PlayerController[] = ids.map((profileId) => ({ kind: "bot", profileId }));

test("faction plans rank Aurelian diplomacy and Spires development using live state", () => {
  const profile = getBotProfile("ai-emperor")!;
  const game = createGame(4, ["aurelians", "spires", "foundry", "varkesh"], "shattered-reach", "horizon-base", 34111,
    Array.from({ length: 4 }, () => ({ kind: "bot", profileId: profile.id })));
  const aurelians = createStrategicPlan(game, 0, profile);
  assert.ok(aurelians.priorities.find((item) => item.key === "agreement")!.weight >= 34);
  assert.ok(aurelians.priorities.find((item) => item.key === "policyTechnology")!.weight >= 28);
  assert.ok(aurelians.priorities.find((item) => item.key === "influence")!.weight >= 28);
  const spires = createStrategicPlan(game, 1, profile);
  assert.ok(spires.priorities.find((item) => item.key === "economicCenters")!.weight >= 34);
  assert.ok(spires.priorities.find((item) => item.key === "resourceTechnology")!.weight >= 26);
  assert.equal(factionOutlook("foundry").resource, "material");
});

test("Gate planning uses actual production and reacts to an independent resource Center", () => {
  const profile = getBotProfile("ai-emperor")!;
  const game = createGame(4, ["aurelians", "spires", "foundry", "meridian"], "shattered-reach", "horizon-base", 34111,
    Array.from({ length: 4 }, () => ({ kind: "bot", profileId: profile.id })));
  const player = game.players[2];
  player.tech.Resource = 4;
  const totals = productionForecast(game, 2).totals;
  assert.deepEqual(productionPerTurn(game, 2), {
    material: totals.material, currency: totals.currency, research: totals.research, influence: totals.influence,
  });
  const before = createStrategicPlan(game, 2, profile);
  assert.ok(before.projectedDeficits.currency);
  const home = game.hexes.find((hex) => hex.owner === 2 && hex.tier)!;
  home.centers.push("currency");
  const after = createStrategicPlan(game, 2, profile);
  assert.ok((after.projectedDeficits.currency || 0) < before.projectedDeficits.currency!);
  assert.ok(after.gateDemand.currency >= 3);
});

test("a flexible Homeworld still needs independent Currency income", () => {
  const profile = getBotProfile("ai-emperor")!;
  const game = createGame(4, ["helix", "varkesh", "farbound", "foundry"], "shattered-reach", "horizon-base", 34111,
    Array.from({ length: 4 }, () => ({ kind: "bot", profileId: profile.id })), true);
  for (const player of game.players) {
    assert.equal(needsCurrencyCenter(game, player.id), true);
    game.hexes.find((hex) => hex.owner === player.id && hex.tier)!.centers.push("currency");
    assert.equal(needsCurrencyCenter(game, player.id), false);
  }
});

test("revisiting a revealed hex does not pretend to advance exploration objectives", () => {
  const profile = getBotProfile("ai-emperor")!;
  const game = createGame(4, ["farbound", "helix", "spires", "aegis"], "shattered-reach", "horizon-base", 34111,
    Array.from({ length: 4 }, () => ({ kind: "bot", profileId: profile.id })), true);
  const explorer = game.players[0].explorationVessels[0];
  const targetId = getNeighbors(explorer.hex, mapLibrary[game.mapId])[0];
  const target = game.hexes.find((hex) => hex.id === targetId)!;
  const plan = createStrategicPlan(game, 0, profile);
  const move = { id: "test-explore", kind: "explorerMove" as const, vesselId: explorer.id, destination: targetId };
  target.revealed = false;
  const frontier = strategicOrderModifier(game, 0, move, plan);
  target.revealed = true;
  const revisit = strategicOrderModifier(game, 0, move, plan);
  assert.ok(frontier.score > revisit.score);
});

test("Foundry prioritizes a Currency specialist, then releases the opening trade urgency after building Currency income", () => {
  const factions = ["foundry", "meridian", "helix", "varkesh"] as const;
  const profile = getBotProfile("ai-medium")!;
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 34111,
    factions.map(() => ({ kind: "bot", profileId: profile.id })), true);
  const opening = createStrategicPlan(game, 0, profile);
  assert.ok(opening.priorities.find((item) => item.key === "trade")!.weight >= 35);
  assert.ok(opening.priorities.find((item) => item.key === "agreement")!.weight >= 25);
  const turn = takeBotTurn(game, 0, profile);
  assert.equal(turn.ok, true);
  assert.ok(game.proposals.some((proposal) => proposal.kind === "agreement" && proposal.from === 0 && proposal.to === 1 &&
    proposal.agreementType === "trade"), "Foundry should open a Currency specialist route on Turn 1");
  game.hexes.find((hex) => hex.owner === 0 && hex.tier)!.centers.push("currency");
  const independent = createStrategicPlan(game, 0, profile);
  assert.ok((independent.priorities.find((item) => item.key === "trade")?.weight || 0) <
    opening.priorities.find((item) => item.key === "trade")!.weight);
});

test("Foundry without a Currency specialist scouts toward contact instead of waiting for a trade route", () => {
  const factions = ["foundry", "varkesh", "helix", "farbound"] as const;
  const profile = getBotProfile("ai-medium")!;
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 34111,
    factions.map(() => ({ kind: "bot", profileId: profile.id })), true);
  const opening = createStrategicPlan(game, 0, profile);
  assert.ok(opening.priorities.some((item) => item.key === "explore" && item.reason.includes("no specialist")));
  const initialContacts = game.players.filter((player) => player.id !== 0 && isContacted(game, 0, player.id)).length;
  assert.ok(initialContacts < factions.length - 1);
  for (let attempt = 0; attempt < 24 && game.turn <= 4; attempt++) {
    if (game.orderProtocol.phase === "ready") {
      assert.equal(resolveSecretOrders(game).ok, true);
      continue;
    }
    const seat = game.orderProtocol.currentPlayer;
    assert.equal(takeBotTurn(game, seat, profile).ok, true);
  }
  assert.ok(game.players.filter((player) => player.id !== 0 && isContacted(game, 0, player.id)).length > initialContacts,
    "Foundry scout should make new contact in the opening turns");
  assert.ok(game.proposals.some((proposal) => proposal.kind === "agreement" && proposal.from === 0),
    "Foundry should attempt a route with an available partner");
});

test("Foundry saves its first Currency, builds recurring income with its second, and respects the Era deadline", () => {
  const factions = ["foundry", "meridian", "helix", "varkesh"] as const;
  for (const profileId of ids) {
    const profile = getBotProfile(profileId)!;
    const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 34111,
      factions.map(() => ({ kind: "bot", profileId })), true);
    game.turn = 2;
    game.players[0].resources = { material: 3, currency: 1, research: 0, influence: 1 };
    const saving = planBotTurn(game, 0, profile);
    assert.ok(!saving.orders.some((order) => order.kind === "tribute" || order.kind === "construct" &&
      order.construction.type === "center" && order.construction.center === "material"),
    `${profileId} should save the first Currency for a Currency Center`);
    game.players[0].resources.currency = 2;
    const building = planBotTurn(game, 0, profile);
    assert.ok(building.orders.some((order) => order.kind === "construct" &&
      order.construction.type === "center" && order.construction.center === "currency"),
    `${profileId} should build the first Currency Center once affordable`);
    game.turn = 4;
    const deadline = planBotTurn(game, 0, profile);
    assert.ok(deadline.orders.some((order) => order.kind === "tribute"),
      `${profileId} should still contribute at the Era deadline`);
  }
});

test("Foundry's opening Trade Agreement leads to a built Currency Center and a Gate Tribute", () => {
  const factions = ["foundry", "meridian", "helix", "varkesh"] as const;
  const profile = getBotProfile("ai-medium")!;
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 34111,
    factions.map(() => ({ kind: "bot", profileId: profile.id })), true);
  let guard = 0;
  while (game.turn <= 4 && guard++ < 24) {
    if (game.orderProtocol.phase === "ready") {
      assert.equal(resolveSecretOrders(game).ok, true);
      continue;
    }
    assert.equal(takeBotTurn(game, game.orderProtocol.currentPlayer, profile).ok, true);
  }
  assert.ok(game.hexes.some((hex) => hex.owner === 0 && hex.centers.includes("currency")));
  assert.ok(game.players[0].tributes >= 1);
});

test("a nearby Varkesh base triggers a limited early garrison priority that subsides once staffed", () => {
  const profile = getBotProfile("ai-emperor")!;
  const game = createGame(4, ["aurelians", "varkesh", "spires", "foundry"], "shattered-reach", "horizon-base", 34112,
    Array.from({ length: 4 }, () => ({ kind: "bot", profileId: profile.id })));
  const home = game.hexes.find((hex) => hex.owner === 0 && hex.tier)!;
  const adjacent = getNeighbors(home.id, mapLibrary[game.mapId]).map((id) => game.hexes.find((hex) => hex.id === id)!)
    .find((hex) => hex.owner === undefined)!;
  adjacent.owner = 1;
  adjacent.tier = "Colony";
  adjacent.revealed = true;
  game.turn = 3;
  game.players[0].resources.currency = 3;
  home.combat = 0;
  for (const carrier of game.carriers.filter((unit) => unit.owner === 0 && unit.hex === home.id)) carrier.cu = 0;
  const threatened = createStrategicPlan(game, 0, profile);
  assert.ok(threatened.defenseNeeds[home.id] > 0);
  const order = { id: "test-garrison", kind: "construct" as const, habitatId: home.id,
    construction: { type: "recruit" as const, pairs: 1 } };
  assert.ok(strategicOrderModifier(game, 0, order, threatened).score > 50, JSON.stringify({ need: threatened.defenseNeeds[home.id], priorities: threatened.priorities, modifier: strategicOrderModifier(game, 0, order, threatened) }));
  home.combat = 4;
  const defended = createStrategicPlan(game, 0, profile);
  assert.equal(defended.defenseNeeds[home.id], undefined);
  assert.ok(strategicOrderModifier(game, 0, order, defended).score < strategicOrderModifier(game, 0, order, threatened).score);
});

test("Aurelian opening invests converted resources in Influence before its first Gate Tribute", () => {
  const factions = ["aurelians", "aegis", "varkesh", "foundry"] as const;
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 34526,
    factions.map((_, seat) => ({ kind: "bot", profileId: seat === 0 ? "ai-emperor" : "ai-medium" })), true);
  let influenceBuilt = false, gateContribution = false, guard = 0;
  while (game.turn <= 4 && guard++ < 24) {
    if (game.orderProtocol.phase === "ready") {
      assert.equal(resolveSecretOrders(game).ok, true);
      continue;
    }
    const seat = game.orderProtocol.currentPlayer;
    const controller = game.players[seat].controller;
    assert.equal(controller.kind, "bot");
    if (controller.kind !== "bot") break;
    const turn = game.turn;
    const result = takeBotTurn(game, seat, getBotProfile(controller.profileId)!);
    assert.equal(result.ok, true);
    if (seat === 0 && turn <= 4 && "orders" in result) {
      influenceBuilt ||= result.orders.some((order) => order.kind === "construct" &&
        order.construction.type === "center" && order.construction.center === "influence");
      gateContribution ||= result.orders.some((order) => order.kind === "tribute");
    }
  }
  assert.equal(influenceBuilt, true);
  assert.equal(gateContribution, true);
});

test("four challenge profiles expose increasing planning depth and faction abilities", () => {
  const profiles = ids.map((id) => getBotProfile(id)!);
  assert.deepEqual(profiles.map((profile) => profile.difficulty), ["easy", "medium", "hard", "emperor"]);
  assert.deepEqual(profiles.map((profile) => profile.behaviors.factionDoctrine), [true, true, true, true]);
  assert.ok(profiles.every((profile, index) => !index || profile.planning.beamWidth > profiles[index - 1].planning.beamWidth));
  assert.equal(profiles[0].behaviors.victoryImpact, false);
  assert.equal(profiles[3].behaviors.victoryImpact, true);
});

test("host chooses difficulty independently for each bot and saves it with the room", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 34001, [
    { kind: "human" }, { kind: "bot", profileId: "ai-easy" },
    { kind: "bot", profileId: "ai-medium" }, { kind: "bot", profileId: "ai-hard" },
  ]);
  const host = await service.create(game, "Host", "network");
  await assert.rejects(() => executeRoomCommand(repository, {
    code: host.code, token: "invalid", expectedRevision: host.revision,
    commandId: "difficulty-denied", command: { kind: "setBotDifficulty", playerId: 1, profileId: "ai-emperor" },
  }), /token is not valid/i);
  const changed = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: host.revision,
    commandId: "difficulty-changed", command: { kind: "setBotDifficulty", playerId: 1, profileId: "ai-emperor" },
  });
  assert.equal(changed.ok, true, changed.message);
  const resumed = await service.resume(host.code, host.token);
  assert.deepEqual(resumed.summary.seats.slice(1).map((seat) => seat.controller.kind === "bot" ? seat.controller.profileId : "human"),
    ["ai-emperor", "ai-medium", "ai-hard"]);
  assert.equal(resumed.game.players[1].controller.kind === "bot" && resumed.game.players[1].controller.profileId, "ai-emperor");
  const invalid = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: resumed.revision,
    commandId: "difficulty-invalid", command: { kind: "setBotDifficulty", playerId: 1, profileId: "meta-analyst" },
  });
  assert.equal(invalid.ok, false);
});

test("rival Hidden choices and completion cannot alter the opponent model", () => {
  const first = createGame(4, [...factions], "shattered-reach", "horizon-base", 34002,
    [{ kind: "bot", profileId: "ai-emperor" }, ...controllers.slice(1)]);
  const second = structuredClone(first);
  first.players[1].hiddenLegacy[1] = { choices: ["h1-frontier"], selected: "h1-frontier", completed: true };
  second.players[1].hiddenLegacy[1] = { choices: ["h1-mobilization"], selected: "h1-mobilization", completed: false };
  const profile = getBotProfile("ai-emperor")!;
  const a = takeBotTurn(first, 0, profile);
  const b = takeBotTurn(second, 0, profile);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.deepEqual(first.botMemory[0].opponents, second.botMemory[0].opponents);
});

test("mixed bot difficulties complete a campaign and keep seat strategies distinct", () => {
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 34003, controllers, true);
  let guard = 0;
  while (!game.result && guard++ < 100) {
    if (game.orderProtocol.phase === "orders") {
      const id = game.orderProtocol.currentPlayer;
      const controller = game.players[id].controller;
      assert.equal(controller.kind, "bot");
      if (controller.kind !== "bot") break;
      const action = takeBotTurn(game, id, getBotProfile(controller.profileId)!);
      assert.equal(action.ok, true, action.message);
      assert.ok("report" in action && action.report.submissionOk);
    } else if (game.orderProtocol.phase === "ready") assert.equal(resolveSecretOrders(game).ok, true);
    else assert.fail(`Unexpected phase ${game.orderProtocol.phase}`);
  }
  assert.ok(game.result);
  assert.deepEqual(new Set(game.botReports.map((report) => report.profileId)), new Set(ids));
  assert.ok(game.botReports.some((report) => report.profileId === "ai-emperor" && report.goalAnalysis.length >= 4));
  assert.ok(game.botMemory.every((memory) => memory.opponents.every((rival) => rival.scoreFloor <= rival.scoreCeiling)));
});
