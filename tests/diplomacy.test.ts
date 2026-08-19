import assert from "node:assert/strict";
import test from "node:test";
import {
  addAgreementProposal,
  addTradeProposal,
  createGame,
  processNewTurnDiplomacy,
  resolveProposal,
  technologyCost,
} from "../game/index";
import type { AgreementProposal, TradeProposal } from "../game/index";

function diplomaticGame() {
  const game = createGame(2, ["meridian", "aurelians"], "shattered-reach", "horizon-base", 4040);
  for (const player of game.players) {
    player.resources = { material: 10, currency: 10, research: 10, influence: 10 };
    player.diplomacy.contacts = game.players.filter(other => other.id !== player.id).map(other => other.id);
  }
  return game;
}

test("Meridian establishes its first Trade Agreement for free", () => {
  const game = diplomaticGame();
  const proposal: AgreementProposal = { id: "agreement-proposal", kind: "agreement", agreementType: "trade", from: 0, to: 1, createdTurn: 1, status: "pending" };
  assert.equal(addAgreementProposal(game, proposal).ok, true);
  assert.equal(resolveProposal(game, proposal.id, true).ok, true);
  assert.equal(game.players[0].resources.influence, 10);
  assert.equal(game.players[1].resources.influence, 10, "Aurelian first-contact bonus refunds its 1 Influence cost");
  assert.equal(game.agreements[0].type, "trade");
});

test("direct trade exchanges resources and applies Labor next Turn", () => {
  const game = diplomaticGame();
  game.agreements.push({ id: "trade-agreement", type: "trade", parties: [0, 1], startedTurn: 1 });
  const proposal: TradeProposal = {
    id: "trade-proposal",
    kind: "trade",
    from: 0,
    to: 1,
    offer: { material: 2, currency: 0, research: 0, labor: 1 },
    request: { material: 0, currency: 3, research: 0, labor: 0 },
    createdTurn: 1,
    status: "pending",
  };
  assert.equal(addTradeProposal(game, proposal).ok, true);
  assert.equal(resolveProposal(game, proposal.id, true).ok, true);
  assert.equal(game.players[0].resources.material, 8);
  assert.equal(game.players[0].resources.currency, 13);
  assert.equal(game.players[0].laborCap, 3, "Capacity does not change immediately");
  processNewTurnDiplomacy(game, 2);
  assert.equal(game.players[0].laborBonus, -1);
  assert.equal(game.players[1].laborBonus, 1);
  assert.equal(game.players[0].laborCap, 2);
  assert.equal(game.players[1].laborCap, 4);
});

test("Research Agreement discounts only the first advance in an Era", () => {
  const game = diplomaticGame();
  game.agreements.push({ id: "research-agreement", type: "research", parties: [0, 1], startedTurn: 1 });
  assert.equal(technologyCost(game, 0, "Economy", 2).research, 1);
  game.players[0].diplomacy.researchDiscountEras.push(game.era);
  assert.equal(technologyCost(game, 0, "Economy", 2).research, 2);
});
