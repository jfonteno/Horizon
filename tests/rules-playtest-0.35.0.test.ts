import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../game/engine/create-game";
import { beginFleetTurn, buildCarrier, carrierMovement, moveCarriers, recruitCombatUnits } from "../game/rules/fleet";
import { explorationRevealAllowance, moveExplorationVessel } from "../game/rules/exploration";
import { constructionQuote, projectedOrderBudget, purchaseCostForOrder } from "../game/rules/purchases";
import { resolvePortalOrder, portalNeighbors, removeCenterAt } from "../game/rules/portals";
import { activePolicy, eraPolicyChoices, markPolicyUsed, resolvePolicyVotes, startEraPolicy } from "../game/rules/policy-deck";
import { getNeighbors } from "../game/engine/geometry";
import { mapLibrary } from "../game/maps";
import { legalBombardmentTargets } from "../game/rules/shattered-reach";
import { resolveAnomaly } from "../game/rules/exploration";
import { addTradeProposal, agreementCost, resolveProposal, technologyCost, tradeEligibility } from "../game/rules/diplomacy";

function game() { return createGame(4, ["spires", "salvo", "aurelians", "helix"], "standard-board-61", "horizon-base", 7813); }

test("Military levels add +1, +2, +4 to printed movement", () => {
  const state = game(), carrier = state.carriers[0];
  for (const [level, bonus] of [[1, 0], [2, 1], [3, 2], [4, 4]]) {
    state.players[0].tech.Military = level;
    assert.equal(carrierMovement(state, carrier), 2 + bonus);
    beginFleetTurn(state, 0);
    assert.equal(carrier.movesRemaining, 2 + bonus);
  }
});

test("Exploration III can reveal two unknown hexes on one path, and invalid paths are atomic", () => {
  const state = game(), player = state.players[0], vessel = player.explorationVessels[0], map = mapLibrary[state.mapId];
  player.tech.Exploration = 3;
  const first = getNeighbors(vessel.hex, map).map((id) => state.hexes.find((hex) => hex.id === id)!).find((hex) => hex && !hex.revealed && hex.kind !== "rift" && getNeighbors(hex.id, map).some((next) => state.hexes.some((candidate) => candidate.id === next && !candidate.revealed && candidate.kind !== "rift")))!;
  const second = getNeighbors(first.id, map).map((id) => state.hexes.find((hex) => hex.id === id)!).find((hex) => hex && !hex.revealed && hex.kind !== "rift")!;
  vessel.movesRemaining = 3;
  assert.equal(explorationRevealAllowance(3), 3);
  const bad = moveExplorationVessel(state, 0, vessel.id, "absent", [first.id, "absent"]);
  assert.equal(bad.ok, false);
  assert.equal(first.revealed, false);
  assert.equal(moveExplorationVessel(state, 0, vessel.id, second.id, [first.id, second.id]).ok, true);
  assert.equal(second.revealed, true);
  assert.equal(vessel.publicReveals, 2);
});

test("Exploration movement can reveal two sectors without consuming the scan allowance", () => {
  const state = game(), vessel = state.players[0].explorationVessels[0], map = mapLibrary[state.mapId];
  vessel.movesRemaining = 3;
  const first = getNeighbors(vessel.hex, map).find((id) => state.hexes.some((hex) => hex.id === id && !hex.revealed && hex.kind !== "rift"))!;
  const second = getNeighbors(first, map).find((id) => state.hexes.some((hex) => hex.id === id && !hex.revealed && hex.kind !== "rift"))!;
  vessel.publicReveals = explorationRevealAllowance(state.players[0].tech.Exploration);
  assert.equal(projectedOrderBudget(state, 0, [{ id: "fog", kind: "explorerMove", vesselId: vessel.id, destination: second, path: [first, second] }]).error, undefined);
  assert.equal(moveExplorationVessel(state, 0, vessel.id, second, [first, second]).ok, true);
  assert.equal(vessel.hex, second);
});

test("Spires can upgrade a Colony directly at Resource III", () => {
  const state = game(), home = state.hexes.find((hex) => hex.owner === 0 && hex.kind === "home")!;
  assert.equal(constructionQuote(state, 0, home.id, { type: "upgrade" }).available, false);
  assert.equal(constructionQuote(state, 0, home.id, { type: "arcology" }).available, false);
  state.players[0].tech.Resource = 3;
  const quote = constructionQuote(state, 0, home.id, { type: "arcology" });
  assert.equal(quote.available, true);
  assert.deepEqual(quote.cost, { material: 4, currency: 3, labor: 3 });
});

test("Portal consumes an Explorer and one Homeworld slot, and enables a movement edge", () => {
  const state = game(), player = state.players[0], home = state.hexes.find((hex) => hex.owner === 0 && hex.kind === "home")!;
  player.tech.Exploration = 4;
  const target = state.hexes.find((hex) => !hex.revealed && hex.kind !== "rift" && hex.id !== home.id)!;
  target.revealed = true;
  player.explorationVessels[0].hex = target.id;
  assert.equal(resolvePortalOrder(state, 0, player.explorationVessels[0].id), true);
  assert.deepEqual(home.portalDestinations, [target.id]);
  assert.equal(player.explorationVessels.length, 0);
  assert.deepEqual(portalNeighbors(state, 0, home.id), [target.id]);
  state.carriers[0].cu = 2;
  assert.equal(moveCarriers(state, 0, [state.carriers[0].id], target.id).ok, true);
  assert.equal(state.carriers[0].hex, target.id);
});

test("Center removal reindexes enhanced Centers and Factories", () => {
  const state = game(), home = state.hexes.find((hex) => hex.owner === 0 && hex.kind === "home")!;
  home.centers = ["material", "currency", "factory"];
  home.enhancedCenterIndices = [1];
  home.factoryOutputs = { 2: "research" };
  assert.equal(constructionQuote(state, 0, home.id, { type: "removeCenter", centerIndex: 0 }).available, true);
  assert.equal(removeCenterAt(home, 0), "material");
  assert.deepEqual(home.enhancedCenterIndices, [0]);
  assert.deepEqual(home.factoryOutputs, { 1: "research" });
});

test("Era Policy votes spend Influence and apply a deterministic winner", () => {
  const state = game(), election = state.policyElection!;
  election.choices = ["open-markets", "infrastructure-grants", "cultural-funding"];
  state.players[0].resources.influence = 3;
  state.players[1].resources.influence = 3;
  assert.equal(projectedOrderBudget(state, 0, [{ id: "v", kind: "policyVote", policyId: "infrastructure-grants", influence: 2 }]).error, undefined);
  resolvePolicyVotes(state, [
    { playerId: 0, order: { id: "a", kind: "policyVote", policyId: "infrastructure-grants", influence: 2 } },
    { playerId: 1, order: { id: "b", kind: "policyVote", policyId: "open-markets", influence: 1 } },
  ]);
  assert.equal(election.activePolicyId, "infrastructure-grants");
  assert.equal(state.players[0].resources.influence, 1);
  assert.equal(constructionQuote(state, 0, state.hexes.find((hex) => hex.owner === 0 && hex.kind === "home")!.id, { type: "center", center: "currency" }).cost.currency, 1);
  assert.equal(activePolicy(state), "infrastructure-grants");
  state.era = 2;
  startEraPolicy(state);
  assert.equal(state.policyElection?.activePolicyId, undefined);
});

test("a tied Delegate Dawn vote enacts no Galactic Policy", () => {
  const state = game();
  state.players[0].resources.influence = 2;
  state.players[1].resources.influence = 2;
  resolvePolicyVotes(state, [
    { playerId: 0, order: { id: "a", kind: "policyVote", policyId: "open-markets", influence: 2 } },
    { playerId: 1, order: { id: "b", kind: "policyVote", policyId: "infrastructure-grants", influence: 2 } },
  ]);
  assert.equal(state.policyElection?.votingClosed, true);
  assert.equal(activePolicy(state), undefined);
});

test("Delegate Dawn presents the three matching cards in each Era and permits uncapped bids", () => {
  const state = game();
  for (let era = 1; era <= 4; era++) assert.equal(eraPolicyChoices(state.seed, era).length, 3);
  state.players[0].resources.influence = 9;
  assert.equal(projectedOrderBudget(state, 0, [{ id: "bid", kind: "policyVote", policyId: eraPolicyChoices(state.seed, 1)[0], influence: 9 }]).error, undefined);
});

test("Era policies change real purchase quotes and track first-use discounts", () => {
  const state = game(), home = state.hexes.find((hex) => hex.owner === 0 && hex.kind === "home")!;
  state.era = 2;
  state.turn = 5;
  state.policyElection = { era: 2, choices: eraPolicyChoices(state.seed, 2), votes: [], activePolicyId: "civilian-investment", votingClosed: true };
  const center = constructionQuote(state, 0, home.id, { type: "center", center: "currency" });
  const carrier = constructionQuote(state, 0, home.id, { type: "carrier", carrier: "patrol" });
  assert.equal(center.cost.currency, 1);
  assert.equal(carrier.cost.currency, 2);
  state.policyElection.activePolicyId = "arms-expansion";
  assert.equal(constructionQuote(state, 0, home.id, { type: "carrier", carrier: "patrol" }).cost.material, 1);
  const ship = constructionQuote(state, 0, home.id, { type: "carrier", carrier: "frigate" });
  assert.equal(ship.cost.material, 1);
  state.players[0].resources.material = state.players[0].resources.currency = 20;
  state.players[0].labor = 20;
  state.players[0].tech.Military = 2;
  assert.equal(buildCarrier(state, 0, home.id, "frigate").ok, true);
  assert.equal(constructionQuote(state, 0, home.id, { type: "carrier", carrier: "frigate" }).cost.material, 2);
  state.era = 3;
  state.turn = 9;
  state.policyElection = { era: 3, choices: eraPolicyChoices(state.seed, 3), votes: [], activePolicyId: "scientific-exchange", votingClosed: true };
  assert.equal(technologyCost(state, 0, "Economy", 2).research, 1);
  markPolicyUsed(state, 0, "technology");
  assert.equal(technologyCost(state, 0, "Economy", 2).research, 2);
  state.policyElection.activePolicyId = "strategic-mobilization";
  home.constructionUsedTurn = undefined;
  const before = home.pendingCombat?.reduce((sum, entry) => sum + entry.amount, 0) || 0;
  assert.equal(recruitCombatUnits(state, 0, home.id, 1).ok, true);
  assert.equal((home.pendingCombat?.reduce((sum, entry) => sum + entry.amount, 0) || 0) - before, 3);
});

test("Delegate Dawn trade, agreement, and late Gate policies expose their costs", () => {
  const state = game();
  state.era = 1;
  state.policyElection = { era: 1, choices: eraPolicyChoices(state.seed, 1), votes: [], activePolicyId: "cultural-funding", votingClosed: true };
  const base = agreementCost(state, 0, "trade");
  markPolicyUsed(state, 0, "agreement");
  assert.equal(agreementCost(state, 0, "trade"), base + 1);
  state.policyElection.activePolicyId = "open-markets";
  state.players[0].diplomacy.contacts.push(1);
  assert.equal(tradeEligibility(state, 0, 1).ok, true);
  state.era = 4;
  state.turn = 13;
  state.policyElection = { era: 4, choices: eraPolicyChoices(state.seed, 4), votes: [], activePolicyId: "horizon-priority", votingClosed: true };
  assert.equal(purchaseCostForOrder(state, 0, { id: "gate", kind: "tribute" })?.material, 1);
  assert.equal(constructionQuote(state, 0, state.hexes.find((hex) => hex.owner === 0 && hex.kind === "home")!.id, { type: "carrier", carrier: "patrol" }).cost.currency, 2);
});

test("a first-Turn bid reserves the possible military price increase", () => {
  const state = game(), home = state.hexes.find((hex) => hex.owner === 0 && hex.kind === "home")!;
  state.era = 2;
  state.turn = 5;
  startEraPolicy(state);
  state.players[0].resources.currency = 1;
  state.players[0].resources.material = 5;
  state.players[0].labor = 5;
  const order = { id: "ship", kind: "construct" as const, habitatId: home.id, construction: { type: "carrier" as const, carrier: "patrol" as const } };
  assert.match(projectedOrderBudget(state, 0, [order]).error || "", /insufficient/);
  state.players[0].resources.currency = 2;
  assert.equal(projectedOrderBudget(state, 0, [order]).error, undefined);
});

test("Salvo's military technology extends legal targets", () => {
  const state = game(), player = state.players[1], gun = state.carriers[1];
  gun.cu = 2;
  const home = state.hexes.find((hex) => hex.owner === 0 && hex.kind === "home")!;
  const approach = getNeighbors(home.id, mapLibrary[state.mapId])[0];
  gun.hex = approach;
  state.players[1].tech.Military = 3;
  assert.ok(legalBombardmentTargets(state, 1, gun.id).some((target) => target.hexId === home.id));
});

test("Anomaly reward resolves once and remains stable in the save", () => {
  const state = game();
  const anomaly = state.hexes.find((hex) => hex.kind === "anomaly")!;
  assert.ok(anomaly);
  resolveAnomaly(state, 0, anomaly);
  const snapshot = JSON.stringify({ resources: state.players[0].resources, lp: state.players[0].lp, reward: anomaly.anomalyReward });
  resolveAnomaly(state, 0, anomaly);
  assert.equal(JSON.stringify({ resources: state.players[0].resources, lp: state.players[0].lp, reward: anomaly.anomalyReward }), snapshot);
  assert.equal(anomaly.anomalyResolvedBy, 0);
});

test("Homeworld conquest rewards its last actual production choice once", () => {
  const state = game(), home = state.hexes.find((hex) => hex.kind === "home" && hex.owner === 0)!;
  const attacker = state.carriers[1];
  attacker.hex = getNeighbors(home.id, mapLibrary[state.mapId])[0];
  attacker.cu = 12;
  attacker.movesRemaining = 1;
  state.players[0].lastHomeProduction = "currency";
  const before = state.players[1].resources.currency;
  assert.equal(moveCarriers(state, 1, [attacker.id], home.id).ok, true);
  assert.equal(home.owner, 1);
  assert.equal(state.players[1].resources.currency, before + 1);
  assert.deepEqual(home.captureRewardedTo, [1]);
});

test("Three Aurelian Envoys grant only one Influence per completed trade", () => {
  const state = game(), home = state.hexes.find((hex) => hex.kind === "home" && hex.owner === 0)!;
  state.agreements.push({ id: "trade", type: "trade", parties: [0, 2], startedTurn: 1 });
  for (let index = 0; index < 3; index++) state.civilianUnits.push({ id: `envoy-${index}`, owner: 2, type: "envoy", hex: home.id, readyTurn: 1, movesRemaining: 1 });
  state.players[2].resources.research = 2;
  const proposal = { id: "envoy-trade", kind: "trade" as const, from: 2, to: 0, createdTurn: 1, status: "pending" as const,
    offer: { material: 0, currency: 0, research: 1, labor: 0 }, request: { material: 0, currency: 0, research: 0, labor: 0 } };
  assert.equal(addTradeProposal(state, proposal).ok, true);
  const before = state.players[2].resources.influence;
  assert.equal(resolveProposal(state, proposal.id, true).ok, true);
  assert.equal(state.players[2].resources.influence, before + 1);
  assert.equal(state.players[2].diplomacy.bonusInfluenceGained, 1);
});
