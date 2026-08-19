import assert from "node:assert/strict";
import test from "node:test";
import profileJson from "../bots/profiles/meta-analyst.json" with { type: "json" };
import {
  createGame,
  createStrategicPlan,
  getNeighbors,
  mapLibrary,
  planBotTurn,
  resolveSecretOrders,
  takeBotTurn,
  validateBotProfile,
} from "../game/index";
import type { BotProfile, PlayerController } from "../game/index";

const profile = profileJson as BotProfile;
const factions = ["varkesh", "helix", "foundry", "farbound"] as const;
const bots: PlayerController[] = factions.map(() => ({ kind: "bot", profileId: profile.id }));
const allFactions = ["varkesh", "helix", "foundry", "farbound", "aurelians", "meridian"] as const;
const allBots: PlayerController[] = allFactions.map(() => ({ kind: "bot", profileId: profile.id }));

test("the external Meta Analyst profile validates", () => {
  assert.equal(validateBotProfile(profileJson), true);
  assert.equal(profile.difficulty, "expert");
  assert.ok(profile.planning.beamWidth >= 32);
  assert.equal(profile.planning.forecastHorizon, 4);
});

test("the strategic planner creates a multi-Turn Gate economy forecast", () => {
  const game = createGame(6, [...allFactions], "shattered-reach", "horizon-base", 11000, allBots, true);
  const plan = createStrategicPlan(game, 0, profile);
  assert.equal(plan.horizonTurns, 4);
  assert.equal(plan.personalContributionTarget, 3);
  assert.equal(plan.contributionDueTurn, 4);
  assert.ok(plan.collectiveProjectedTributes <= 18);
  assert.equal(plan.priorityResources.length, 4);
  assert.match(plan.doctrine, /force|Gate|production|trade|Reveal/);
});

test("Aurelian faction doctrine converts Political Capital to meet an immediate Gate cost", () => {
  const game = createGame(6, [...allFactions], "shattered-reach", "horizon-base", 11005, allBots, true);
  const aurelian = game.players.find((player) => player.faction === "aurelians")!;
  game.orderProtocol.currentPlayer = aurelian.id;
  game.active = aurelian.id;
  aurelian.resources = { material: 0, currency: 0, research: 0, influence: 4 };
  const result = takeBotTurn(game, aurelian.id, profile);
  assert.equal(result.ok, true);
  assert.ok("orders" in result);
  if (!("orders" in result)) return;
  assert.equal(result.orders.some((order) => order.kind === "tribute"), true);
  assert.equal(aurelian.resources.influence, 0);
  assert.equal(aurelian.resources.material, 1);
  assert.equal(aurelian.resources.currency, 1);
});

test("Meta Analyst chooses a Hidden objective and submits a legal private plan", () => {
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 11001, bots);
  const result = takeBotTurn(game, 0, profile);
  assert.equal(result.ok, true);
  assert.ok(game.players[0].hiddenLegacy[1].selected);
  assert.equal(game.orderProtocol.submissions.length, 1);
  assert.equal(game.botReports.length, 1);
  assert.match(game.botReports[0].knowledgeBoundary, /sealed rival Orders were excluded/);
  assert.ok(game.botReports[0].candidateCount > 0);
});

test("unrevealed world contents cannot change the bot plan", () => {
  const first = createGame(4, [...factions], "shattered-reach", "horizon-base", 11002, bots);
  const second = structuredClone(first);
  for (const hex of second.hexes.filter((candidate) => !candidate.revealed && candidate.kind !== "rift"))
    hex.kind = hex.kind === "material" ? "research" : "material";
  first.players[0].hiddenLegacy[1] = { choices: ["h1-frontier"], selected: "h1-frontier" };
  second.players[0].hiddenLegacy[1] = { choices: ["h1-frontier"], selected: "h1-frontier" };
  const firstPlan = planBotTurn(first, 0, profile).orders;
  const secondPlan = planBotTurn(second, 0, profile).orders;
  assert.deepEqual(firstPlan, secondPlan);
});

test("exact combat forecasting rejects a clearly losing attack", () => {
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 11003, bots);
  game.players[0].hiddenLegacy[1] = { choices: ["h1-mobilization"], selected: "h1-mobilization" };
  const carrier = game.carriers.find((candidate) => candidate.owner === 0)!;
  const targetId = getNeighbors(carrier.hex, mapLibrary[game.mapId])
    .find((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  const target = game.hexes.find((hex) => hex.id === targetId)!;
  target.revealed = true;
  target.owner = 1;
  target.tier = "Metropolis";
  target.combat = 12;
  const plan = planBotTurn(game, 0, profile);
  assert.equal(plan.orders.some((order) => order.kind === "carrierMove" && order.destination === target.id), false);
});

test("a six-faction spectator simulation records the complete 16-Turn cycle", () => {
  const game = createGame(6, [...allFactions], "shattered-reach", "horizon-base", 11004, allBots, true);
  let guard = 0;
  while (!game.result && guard++ < 120) {
    if (game.orderProtocol.phase === "orders") {
      const playerId = game.orderProtocol.currentPlayer;
      const result = takeBotTurn(game, playerId, profile);
      assert.equal(result.ok, true, result.message);
    } else if (game.orderProtocol.phase === "ready") {
      assert.equal(resolveSecretOrders(game).ok, true);
    } else assert.fail(`Unexpected phase ${game.orderProtocol.phase}`);
  }
  assert.ok(game.result);
  assert.equal(game.turn, 16);
  assert.equal(game.spectatorMode, true);
  assert.deepEqual(game.history.map((point) => point.turn), Array.from({ length: 17 }, (_, turn) => turn));
  assert.equal(game.history.every((point) => point.players.length === 6), true);
  assert.ok(game.botReports.length > 10);
  assert.equal(game.botMemory.length, 6);
  assert.equal(game.botMemory.every((memory) => memory.opponents.every((opponent) => opponent.archetypes.length > 0)), true);
  assert.ok(game.botReports.some((report) => report.opponentModels.length > 0));
  assert.ok(game.botReports.every((report) => report.strategicForecast.length === 4));
  game.players.forEach((player) => {
    for (const era of [1, 2, 3, 4]) assert.ok(player.hiddenLegacy[era]?.selected);
  });
});

test("five-seed strategic regression maintains Gate pace and completes at least one Gate", () => {
  let totalGate = 0, successes = 0;
  for (let seed = 21000; seed < 21005; seed++) {
    const game = createGame(6, [...allFactions], "shattered-reach", "horizon-base", seed, allBots, true);
    let guard = 0;
    while (!game.result && guard++ < 140) {
      if (game.orderProtocol.phase === "orders") assert.equal(takeBotTurn(game, game.orderProtocol.currentPlayer, profile).ok, true);
      else if (game.orderProtocol.phase === "ready") assert.equal(resolveSecretOrders(game).ok, true);
      else assert.fail(`Unexpected phase ${game.orderProtocol.phase}`);
    }
    assert.ok(game.result);
    totalGate += game.gate;
    if (game.result.gateSucceeded) successes++;
  }
  assert.ok(totalGate / 5 >= 12, `Expected average Gate progress of at least 12, received ${totalGate / 5}`);
  assert.ok(successes >= 1, "Expected at least one completed Gate across the deterministic regression set");
});
