import assert from "node:assert/strict";
import test from "node:test";

import {
  addTechnologyProposal,
  availableCarrierTypes,
  carrierCost,
  constructionQuote,
  createGame,
  farboundForwardScan,
  getNeighbors,
  mapLibrary,
  moveCarriers,
  moveExplorationVessel,
  politicalCapital,
  projectPrivateGame,
  projectSpectatorGame,
  resolveProposal,
  resolveSecretOrders,
  submitSecretOrders,
  technologyCost,
} from "../game/index";

function chooseHidden(game: ReturnType<typeof createGame>) {
  for (const player of game.players)
    player.hiddenLegacy[game.era] = {
      choices: ["h1-frontier"],
      selected: "h1-frontier",
    };
}

test("Farbound Forward Scan resolves privately and never reveals the hex to rivals or spectators", () => {
  const game = createGame(2, ["farbound", "helix"], "shattered-reach", "horizon-base", 20401);
  chooseHidden(game);
  const farbound = game.players[0];
  const vessel = farbound.explorationVessels[0];
  const targetId = getNeighbors(vessel.hex, mapLibrary[game.mapId]).find((id) => {
    const hex = game.hexes.find((candidate) => candidate.id === id);
    return hex && !hex.revealed && hex.kind !== "rift";
  });
  assert.ok(targetId);
  const actualKind = game.hexes.find((hex) => hex.id === targetId)!.kind;

  assert.equal(submitSecretOrders(game, 0, [{ id: "scan", kind: "farboundForwardScan", vesselId: vessel.id, hexId: targetId }]).ok, true);
  assert.equal(submitSecretOrders(game, 1, []).ok, true);
  assert.equal(resolveSecretOrders(game).ok, true);

  assert.equal(game.hexes.find((hex) => hex.id === targetId)?.revealed, false);
  assert.equal(projectPrivateGame(game, 0).hexes.find((hex) => hex.id === targetId)?.kind, actualKind);
  assert.equal(projectPrivateGame(game, 1).hexes.find((hex) => hex.id === targetId)?.kind, "empty");
  assert.equal(projectSpectatorGame(game).hexes.find((hex) => hex.id === targetId)?.kind, "empty");
  assert.equal(farbound.privateSurveys.find((survey) => survey.hexId === targetId)?.kind, actualKind);
});

test("Forward Scan requires a ready vessel and cannot waste its use on archived intelligence", () => {
  const game = createGame(2, ["farbound", "helix"], "shattered-reach", "horizon-base", 20402);
  const vessel = game.players[0].explorationVessels[0];
  const targetId = getNeighbors(vessel.hex, mapLibrary[game.mapId]).find((id) => !game.hexes.find((hex) => hex.id === id)!.revealed)!;
  vessel.readyTurn = game.turn + 1;
  assert.equal(farboundForwardScan(game, 0, vessel.id, targetId).ok, false);
  assert.equal(game.players[0].forwardScanUsedTurn, undefined);
  vessel.readyTurn = game.turn;
  game.players[0].privateSurveys.push({ hexId: targetId, kind: game.hexes.find((hex) => hex.id === targetId)!.kind, surveyedTurn: game.turn, soldTo: [] });
  assert.equal(farboundForwardScan(game, 0, vessel.id, targetId).ok, false);
  assert.equal(game.players[0].forwardScanUsedTurn, undefined);
});

test("Varkesh, Helix, Foundry, Aurelian, and Farbound rule modifiers remain active", () => {
  const game = createGame(6, ["varkesh", "helix", "foundry", "aurelians", "meridian", "farbound"], "standard-board", "horizon-base", 20403);
  const [varkesh, helix, foundry, aurelians, , farbound] = game.players;

  varkesh.tech.Military = 4;
  assert.equal(carrierCost(varkesh, "cruiser").material, 3);
  assert.ok(availableCarrierTypes(varkesh).includes("corvette"));
  assert.ok(availableCarrierTypes(varkesh).includes("xebec"));

  assert.equal(technologyCost(game, helix.id, "Military", 2).research, 1);
  const helixHome = game.hexes.find((hex) => hex.owner === helix.id && hex.tier)!;
  assert.deepEqual(
    constructionQuote(game, helix.id, helixHome.id, { type: "center", center: "research" }).cost,
    { material: 1, currency: 1, labor: 1 },
  );

  const foundryHome = game.hexes.find((hex) => hex.owner === foundry.id && hex.tier)!;
  assert.ok(foundryHome.centers.includes("material"));
  assert.equal(constructionQuote(game, foundry.id, foundryHome.id, { type: "module" }).cost.labor, 0);

  aurelians.resources.influence = 6;
  assert.equal(politicalCapital(game, aurelians.id, "material").ok, true);
  assert.equal(aurelians.resources.material, 1);
  assert.equal(politicalCapital(game, aurelians.id, "labor").ok, true);
  assert.equal(aurelians.laborBonus, 1);
  assert.equal(politicalCapital(game, aurelians.id, "labor").ok, false);

  const vessel = farbound.explorationVessels[0];
  const targetId = getNeighbors(vessel.hex, mapLibrary[game.mapId]).find((id) => !game.hexes.find((hex) => hex.id === id)!.revealed)!;
  const target = game.hexes.find((hex) => hex.id === targetId)!;
  target.kind = "anomaly";
  const researchBefore = farbound.resources.research;
  assert.equal(moveExplorationVessel(game, farbound.id, vessel.id, target.id).ok, true);
  assert.equal(farbound.resources.research, researchBefore + 2);
});

test("Varkesh conquest preserves Habitat tier and awards Glory against that opponent", () => {
  const game = createGame(2, ["varkesh", "helix"], "shattered-reach", "horizon-base", 20405);
  const attacker = game.players[0];
  const target = game.hexes.find((hex) => hex.owner === 1 && hex.tier)!;
  const origin = getNeighbors(target.id, mapLibrary[game.mapId]).find((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  const carrier = game.carriers.find((candidate) => candidate.owner === attacker.id)!;
  game.carriers = game.carriers.filter((candidate) => candidate.owner !== 1);
  game.hexes.find((hex) => hex.id === origin)!.revealed = true;
  carrier.hex = origin;
  carrier.cu = 6;
  carrier.readyTurn = game.turn;
  carrier.movesRemaining = 2;
  target.combat = 0;
  const tier = target.tier;

  assert.equal(moveCarriers(game, attacker.id, [carrier.id], target.id).ok, true);
  assert.equal(target.owner, attacker.id);
  assert.equal(target.tier, tier);
  assert.equal(attacker.lp, game.era);
});

test("Helix Technology Exchange is executable end to end", () => {
  const game = createGame(2, ["helix", "foundry"], "shattered-reach", "horizon-base", 20404);
  const seller = game.players[0], buyer = game.players[1];
  seller.tech.Economy = 4;
  seller.tech.Exploration = 2;
  buyer.resources = { material: 5, currency: 5, research: 5, influence: 5 };
  const sellerMaterialBefore = seller.resources.material;
  const proposal = {
    id: "helix-exchange",
    kind: "technology" as const,
    seller: seller.id,
    buyer: buyer.id,
    branch: "Exploration" as const,
    level: 2,
    compensation: { material: 1, currency: 0, research: 0, labor: 0 },
    createdTurn: game.turn,
    status: "pending" as const,
  };
  assert.equal(addTechnologyProposal(game, proposal).ok, true);
  assert.equal(resolveProposal(game, proposal.id, true).ok, true);
  assert.equal(buyer.tech.Exploration, 2);
  assert.equal(seller.resources.material, sellerMaterialBefore + 1);
});
