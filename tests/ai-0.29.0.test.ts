import assert from "node:assert/strict";
import test from "node:test";
import profileJson from "../bots/profiles/meta-analyst.json" with { type: "json" };
import {
  addAgreementProposal,
  addTradeProposal,
  createGame,
  createStrategicPlan,
  emptyTradeBundle,
  legacyObjectiveProgress,
  planBotTurn,
  processNewTurnDiplomacy,
  reviewBotDiplomacy,
  resolveProposal,
  submitSecretOrders,
  takeBotTurn,
} from "../game/index";
import type { BotProfile, PlayerController } from "../game/index";

const profile = profileJson as BotProfile;
const factions = ["varkesh", "helix", "foundry", "aurelians"] as const;
const controllers: PlayerController[] = [
  { kind: "human" },
  { kind: "bot", profileId: profile.id },
  { kind: "bot", profileId: profile.id },
  { kind: "bot", profileId: profile.id },
];

function strategicGame() {
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 29001, controllers);
  for (const player of game.players) {
    player.resources = { material: 10, currency: 10, research: 10, influence: 10 };
    player.tech.Economy = 4;
    player.tech.Policy = 3;
  }
  return game;
}

test("0.29 objective planning combines Hidden, Universal, Civilization, and Gate goals", () => {
  const game = strategicGame();
  game.players[2].hiddenLegacy[1] = { choices: ["h1-renaissance"], selected: "h1-renaissance" };
  const plan = createStrategicPlan(game, 2, profile);
  const categories = new Set(plan.objectivePlan.goals.map((goal) => goal.category));
  assert.deepEqual([...categories].sort(), ["civilization", "gate", "hidden", "universal"]);
  assert.ok(plan.objectivePlan.primaryGoalIds.includes("h1-renaissance"));
  assert.ok((plan.objectivePlan.actionWeights.develop || 0) > 0);
  assert.ok(plan.objectivePlan.expectedLP > 0);
});

test("an unfavorable trade is rejected with one legal strategic counteroffer", () => {
  const game = strategicGame();
  const offer = emptyTradeBundle(), request = emptyTradeBundle();
  offer.material = 1;
  request.research = 2;
  assert.equal(addTradeProposal(game, {
    id: "human-unfavorable",
    kind: "trade",
    from: 0,
    to: 1,
    offer,
    request,
    createdTurn: game.turn,
    status: "pending",
  }).ok, true);
  const result = reviewBotDiplomacy(game, 1);
  assert.equal(result.ok, true);
  assert.equal(game.proposals.find((proposal) => proposal.id === "human-unfavorable")?.status, "rejected");
  const counter = game.proposals.find((proposal) => proposal.kind === "trade" && proposal.counterOf === "human-unfavorable");
  assert.ok(counter);
  assert.equal(counter.kind, "trade");
  if (counter.kind !== "trade") return;
  assert.equal(counter.counterDepth, 1);
  assert.equal(counter.from, 1);
  assert.equal(counter.to, 0);
  assert.ok(result.messages.some((message) => message.includes("Countered")));
});

test("a bot rejects an alliance that would empower the leading victory threat", () => {
  const game = strategicGame();
  game.players[0].lp = 12;
  game.players[0].legacy.universal = 6;
  assert.equal(addAgreementProposal(game, {
    id: "runaway-alliance",
    kind: "agreement",
    from: 0,
    to: 1,
    agreementType: "alliance",
    createdTurn: game.turn,
    status: "pending",
  }).ok, true);
  const result = reviewBotDiplomacy(game, 1);
  assert.equal(result.ok, true);
  assert.equal(game.proposals.find((proposal) => proposal.id === "runaway-alliance")?.status, "rejected");
  assert.ok(result.messages.some((message) => message.includes("victory threat")));
});

test("0.29 decision reports expose public goal and threat analysis", () => {
  const game = strategicGame();
  game.orderProtocol.currentPlayer = 1;
  game.active = 1;
  const result = takeBotTurn(game, 1, profile);
  assert.equal(result.ok, true);
  const report = game.botReports[0];
  assert.ok(report.goalAnalysis.length >= 4);
  assert.ok(report.opponentModels.some((model) => model.includes("threat")));
  assert.ok(game.botMemory[0].opponents.every((opponent) => opponent.stance && opponent.victoryThreat >= 0));
});

test("a colony ship settles its current world instead of chasing a more valuable route", () => {
  const game = strategicGame();
  const player = game.players[2];
  const site = game.hexes.find((hex) => hex.owner === undefined && hex.kind !== "rift")!;
  site.kind = "material";
  site.revealed = true;
  player.colonyShip = site.id;
  player.colonyShips[0].hex = site.id;
  player.modules = 1;
  const plan = planBotTurn(game, player.id, profile);
  assert.ok(plan.orders.some((order) => order.kind === "establish" && order.hexId === site.id));
  assert.ok(!plan.orders.some((order) => order.kind === "colonyMove"));
});

test("a colony ship waiting on a world replaces its Module without moving away", () => {
  const game = strategicGame();
  const player = game.players[2];
  const site = game.hexes.find((hex) => hex.owner === undefined && hex.kind !== "rift")!;
  site.kind = "material";
  site.revealed = true;
  player.colonyShip = site.id;
  player.colonyShips[0].hex = site.id;
  player.modules = 0;
  const plan = planBotTurn(game, player.id, profile);
  assert.ok(plan.orders.some((order) => order.kind === "construct" && order.construction.type === "module"));
  assert.ok(!plan.orders.some((order) => order.kind === "colonyMove"));
});

test("Era III Technology progress requires an advance this Era and stored Research", () => {
  const game = strategicGame();
  game.era = 3;
  game.turn = 9;
  const player = game.players[1];
  player.tech.Economy = 4;
  assert.equal(legacyObjectiveProgress(game, player.id, "h3-tech").complete, false);
  player.legacyMetrics.technologyAdvances[2] = ["Economy"];
  player.resources.research = 1;
  assert.equal(legacyObjectiveProgress(game, player.id, "h3-tech").complete, false);
  player.resources.research = 2;
  assert.equal(legacyObjectiveProgress(game, player.id, "h3-tech").complete, true);
});

test("a completed Gate releases the strategic resource reserve for Legacy scoring", () => {
  const game = strategicGame();
  game.gate = 12;
  const plan = createStrategicPlan(game, 1, profile);
  assert.equal(plan.personalContributionTarget, 0);
  assert.deepEqual(plan.reserve, { material: 0, currency: 0, research: 0, influence: 0 });
  assert.deepEqual(plan.followupReserve, plan.reserve);
});

test("final-Era market support continues after the bot's first Tribute", () => {
  const game = strategicGame();
  game.era = 4;
  game.turn = 16;
  game.orderProtocol.turn = 16;
  game.gate = 11;
  const player = game.players[1];
  player.resources = { material: 0, currency: 8, research: 8, influence: 2 };
  player.labor = 4;
  player.tributes = 3;
  player.eraTributes[3] = 1;
  player.hiddenLegacy[4] = { choices: ["h4-savior"], selected: "h4-savior" };
  game.orderProtocol.currentPlayer = player.id;
  game.active = player.id;
  const result = takeBotTurn(game, player.id, profile);
  assert.ok("orders" in result);
  if (!("orders" in result)) return;
  assert.ok(result.orders.some((order) => order.kind === "tribute"));
  assert.ok(result.report.diplomacy.some((message) => message.startsWith("Market conversion:")));
  assert.equal(result.report.submissionOk, true);
});

test("unanswered counteroffers expire without blocking future diplomacy", () => {
  const game = strategicGame();
  const offer = emptyTradeBundle(), request = emptyTradeBundle();
  offer.material = 1;
  request.research = 2;
  addTradeProposal(game, { id: "expire-counter", kind: "trade", from: 0, to: 1, offer, request,
    createdTurn: game.turn, status: "pending" });
  reviewBotDiplomacy(game, 1);
  const counter = game.proposals.find((proposal) => proposal.kind === "trade" && proposal.counterOf === "expire-counter");
  assert.ok(counter);
  processNewTurnDiplomacy(game, game.turn + 1);
  assert.equal(counter.status, "cancelled");
});

test("trade acceptance preserves resources already committed to sealed Orders", () => {
  const game = strategicGame();
  const player = game.players[0];
  player.resources.material = 1;
  player.hiddenLegacy[1] = { choices: ["h1-pioneer"], selected: "h1-pioneer" };
  assert.equal(submitSecretOrders(game, 0, [{ id: "reserved-tribute", kind: "tribute" }]).ok, true);
  const offer = emptyTradeBundle(), request = emptyTradeBundle();
  offer.material = 1;
  request.research = 1;
  assert.equal(addTradeProposal(game, { id: "reserved-trade", kind: "trade", from: 0, to: 1, offer, request,
    createdTurn: game.turn, status: "pending" }).ok, true);
  const result = resolveProposal(game, "reserved-trade", true);
  assert.equal(result.ok, false);
  assert.match(result.message, /sealed Orders/);
  assert.equal(player.resources.material, 1);
});

test("bots answer other bots' proposals in the same turn", () => {
  const game = strategicGame();
  game.players[0].controller = { kind: "bot", profileId: profile.id };
  game.orderProtocol.currentPlayer = 1;
  game.active = 1;
  const result = takeBotTurn(game, 1, profile);
  assert.equal(result.ok, true);
  const outgoing = game.proposals.filter((proposal) => proposal.kind === "technology" ? proposal.seller === 1 : proposal.from === 1);
  assert.ok(outgoing.length > 0);
  assert.ok(outgoing.some((proposal) => proposal.status === "accepted" || proposal.status === "rejected"));
});
