import test from "node:test";
import assert from "node:assert/strict";
import {
  addTradeProposal, constructionQuote, createGame, emptyTradeBundle,
  projectedOrderBudget, resolveProposal,
  drawHiddenChoices, submitSecretOrders, resolveSecretOrders,
  validateRoomCommand,
} from "../game";

function fixture() {
  const game = createGame(2, ["aegis", "foundry"], "shattered-reach", "horizon-base", 340701);
  const aegis = game.players[0], buyer = game.players[1];
  const home = game.hexes.find((hex) => hex.owner === 0 && hex.tier)!;
  const destination = game.hexes.find((hex) => hex.owner === 1 && hex.tier)!;
  return { game, aegis, buyer, home, destination };
}

test("Aegis first economic Center costs 1 less Currency in quote, order budget, and resolution", () => {
  const { game, aegis, home } = fixture();
  aegis.resources.material = 10;
  aegis.resources.currency = 10;
  aegis.labor = 10;
  const secondHome = game.hexes.find((hex) => hex.owner === undefined && hex.kind !== "rift")!;
  secondHome.owner = 0;
  secondHome.tier = "Outpost";
  const quote = constructionQuote(game, 0, home.id, { type: "center", center: "currency" });
  assert.equal(quote.cost.currency, 1);
  const budget = projectedOrderBudget(game, 0, [
    { id: "first", kind: "construct", habitatId: home.id, construction: { type: "center", center: "currency" } },
    { id: "second", kind: "construct", habitatId: secondHome.id, construction: { type: "center", center: "research" } },
  ]);
  assert.equal(budget.error, undefined);
  assert.equal(budget.remaining.resources.currency, 10 - 1 - 2);
  for (const playerId of [0, 1]) {
    drawHiddenChoices(game, playerId, game.era);
    game.players[playerId].hiddenLegacy[game.era].selected = game.players[playerId].hiddenLegacy[game.era].choices[0];
  }
  assert.equal(submitSecretOrders(game, 0, [{ id: "first", kind: "construct", habitatId: home.id, construction: { type: "center", center: "currency" } }]).ok, true);
  assert.equal(submitSecretOrders(game, 1, []).ok, true);
  assert.equal(resolveSecretOrders(game).ok, true);
  assert.equal(home.centers.includes("currency"), true);
  assert.equal(aegis.legacyMetrics.aegisEconomicCenterBuilt, true);
  assert.equal(constructionQuote(game, 0, secondHome.id, { type: "center", center: "research" }).cost.currency, 2);
});

test("Economy II Aegis can commission a Blockade without Military II, inventory, or an agreement", () => {
  const { game, aegis, buyer, home, destination } = fixture();
  aegis.tech.Military = 1;
  aegis.tech.Economy = 2;
  aegis.resources.currency = 0;
  buyer.resources.material = 7;
  buyer.resources.currency = 5;
  buyer.resources.research = 2;
  buyer.labor = 5;
  const offer = (id: string) => addTradeProposal(game, {
    id, kind: "trade", from: 0, to: 1, offer: emptyTradeBundle(),
    request: { ...emptyTradeBundle(), currency: 1 }, blockadeCommission: true,
    createdTurn: game.turn, status: "pending",
  });
  aegis.tech.Economy = 1;
  assert.match(offer("too-early").message, /Economy II/);
  aegis.tech.Economy = 2;
  assert.equal(game.blockades.length, 0);
  assert.equal(game.agreements.length, 0);
  assert.equal(offer("commission").ok, true);
  assert.equal(resolveProposal(game, "commission", true).ok, false);
  assert.equal(resolveProposal(game, "commission", true, home.id).ok, false);
  assert.equal(resolveProposal(game, "commission", true, destination.id).ok, true);
  assert.equal(game.blockades.length, 1);
  assert.deepEqual({ owner: game.blockades[0].owner, hex: game.blockades[0].hex, active: game.blockades[0].active },
    { owner: 1, hex: destination.id, active: true });
  assert.equal(buyer.resources.material, 4);
  assert.equal(buyer.resources.currency, 2);
  assert.equal(buyer.labor, 3);
  assert.equal(aegis.resources.currency, 1);
  assert.equal(aegis.legacyMetrics.aegisPlatformTransfers.includes(1), true);
  assert.equal(offer("occupied").ok, false);
});

test("commission refuses a buyer who cannot cover construction and fee together", () => {
  const { game, aegis, buyer } = fixture();
  aegis.tech.Economy = 2;
  buyer.resources.material = 3;
  buyer.resources.currency = 2;
  buyer.labor = 2;
  const proposal = {
    id: "unaffordable", kind: "trade" as const, from: 0, to: 1,
    offer: emptyTradeBundle(), request: { ...emptyTradeBundle(), currency: 1 },
    blockadeCommission: true, createdTurn: game.turn, status: "pending" as const,
  };
  assert.equal(addTradeProposal(game, proposal).ok, false);
  buyer.resources.currency = 3;
  assert.equal(addTradeProposal(game, proposal).ok, true);
  buyer.resources.currency = 2;
  const destination = game.hexes.find((hex) => hex.owner === 1 && hex.tier)!;
  assert.equal(resolveProposal(game, proposal.id, true, destination.id).ok, false);
  assert.equal(game.blockades.length, 0);
  assert.equal(game.proposals[0].status, "pending");
});

test("commission command accepts whole non-negative fee components only", () => {
  const command = validateRoomCommand({ kind: "proposeBlockadeCommission", buyer: 1,
    fee: { material: 0, currency: 1, research: 0 } });
  assert.equal(command.kind, "proposeBlockadeCommission");
  assert.throws(() => validateRoomCommand({ kind: "proposeBlockadeCommission", buyer: 1,
    fee: { material: 0, currency: -1, research: 0 } }), /zero to 99/);
});
