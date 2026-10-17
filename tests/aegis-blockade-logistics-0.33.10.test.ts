import test from "node:test";
import assert from "node:assert/strict";
import {
  addTradeProposal,
  availableCarrierTypes,
  blockadeCargoCapacity,
  constructionQuote,
  createGame,
  drawHiddenChoices,
  emptyTradeBundle,
  getNeighbors,
  mapLibrary,
  moveCarriers,
  resolveBlockadeCargoOrder,
  resolveProposal,
  resolveShatteredConstruction,
  submitSecretOrders,
} from "../game";

function selectHiddenObjective(game: ReturnType<typeof createGame>, playerId: number) {
  drawHiddenChoices(game, playerId, game.era);
  const hidden = game.players[playerId].hiddenLegacy[game.era];
  hidden.selected = hidden.choices[0];
}

function fundedAegis() {
  const game = createGame(2, ["aegis", "spires"], "shattered-reach", "horizon-base", 331001);
  const player = game.players[0];
  const home = game.hexes.find((hex) => hex.owner === 0 && hex.tier)!;
  player.resources = { material: 50, currency: 50, research: 50, influence: 50 };
  player.labor = 50;
  player.laborCap = 50;
  return { game, player, home };
}

test("Aegis Blockades and the Deployment Vessel unlock at Military II", () => {
  const { game, player, home } = fundedAegis();
  player.tech.Military = 1;
  assert.equal(availableCarrierTypes(player).includes("blockadeTender"), false);
  assert.equal(constructionQuote(game, 0, home.id, { type: "blockade" }).available, false);

  player.tech.Military = 2;
  assert.equal(availableCarrierTypes(player).includes("blockadeTender"), true);
  assert.equal(constructionQuote(game, 0, home.id, { type: "blockade" }).available, true);
  assert.equal(resolveShatteredConstruction(game, 0, home.id, { type: "blockade" }), true);
  const blockade = game.blockades.at(-1)!;
  assert.equal(blockade.active, true);
  assert.equal(blockade.hex, home.id);
  assert.equal(blockade.carrierId, undefined);
});

test("military vessels load and deploy separate Blockade cargo with Aegis capacity three", () => {
  const { game, player, home } = fundedAegis();
  player.tech.Military = 2;
  const ordinary = game.carriers.find((carrier) => carrier.owner === 0)!;
  ordinary.hex = home.id;
  ordinary.readyTurn = game.turn;
  ordinary.cu = Math.max(1, ordinary.cu);
  const tender = { id: "deployment-vessel", owner: 0, type: "blockadeTender" as const, hex: home.id, cu: 1, readyTurn: game.turn, movesRemaining: 2 };
  game.carriers.push(tender);
  assert.equal(blockadeCargoCapacity(ordinary), 1);
  assert.equal(blockadeCargoCapacity(tender), 3);

  game.blockades.push({ id: "ordinary-cargo", owner: 0, hex: home.id, active: true, readyTurn: game.turn, originFaction: "aegis" });
  assert.equal(resolveBlockadeCargoOrder(game, 0, { id: "load-ordinary", kind: "blockadeCargo", blockadeId: "ordinary-cargo", carrierId: ordinary.id, action: "load" }), true);
  assert.equal(game.blockades.find((blockade) => blockade.id === "ordinary-cargo")?.active, false);

  game.blockades.push({ id: "ordinary-overflow", owner: 0, hex: home.id, active: true, readyTurn: game.turn, originFaction: "aegis" });
  assert.equal(resolveBlockadeCargoOrder(game, 0, { id: "overflow", kind: "blockadeCargo", blockadeId: "ordinary-overflow", carrierId: ordinary.id, action: "load" }), false);

  for (let index = 1; index <= 3; index++) {
    const id = `tender-cargo-${index}`;
    game.blockades.push({ id, owner: 0, hex: home.id, active: true, readyTurn: game.turn, originFaction: "aegis" });
    assert.equal(resolveBlockadeCargoOrder(game, 0, { id: `load-${index}`, kind: "blockadeCargo", blockadeId: id, carrierId: tender.id, action: "load" }), true);
  }
  game.blockades.push({ id: "tender-overflow", owner: 0, hex: home.id, active: true, readyTurn: game.turn, originFaction: "aegis" });
  assert.equal(resolveBlockadeCargoOrder(game, 0, { id: "load-fourth", kind: "blockadeCargo", blockadeId: "tender-overflow", carrierId: tender.id, action: "load" }), false);

  const destination = getNeighbors(home.id, mapLibrary[game.mapId]).find((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  tender.hex = destination;
  game.blockades.find((blockade) => blockade.id === "tender-cargo-1")!.hex = destination;
  assert.equal(resolveBlockadeCargoOrder(game, 0, { id: "deploy", kind: "blockadeCargo", blockadeId: "tender-cargo-1", carrierId: tender.id, action: "deploy" }), true);
  assert.equal(game.blockades.find((blockade) => blockade.id === "tender-cargo-1")?.hex, destination);
  assert.equal(game.blockades.find((blockade) => blockade.id === "tender-cargo-1")?.active, true);
});

test("Blockade cargo Orders cannot share a Turn with carrier movement", () => {
  const { game, home } = fundedAegis();
  selectHiddenObjective(game, 0);
  const carrier = game.carriers.find((candidate) => candidate.owner === 0)!;
  carrier.hex = home.id;
  carrier.cu = 1;
  carrier.readyTurn = game.turn;
  carrier.movesRemaining = 2;
  game.blockades.push({ id: "stationary-cargo", owner: 0, hex: home.id, active: true, readyTurn: game.turn, originFaction: "aegis" });
  const destination = getNeighbors(home.id, mapLibrary[game.mapId]).find((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  game.hexes.find((hex) => hex.id === destination)!.revealed = true;
  const result = submitSecretOrders(game, 0, [
    { id: "move", kind: "carrierMove", carrierIds: [carrier.id], destination, path: [destination] },
    { id: "load", kind: "blockadeCargo", blockadeId: "stationary-cargo", carrierId: carrier.id, action: "load" },
  ]);
  assert.equal(result.ok, false);
});

test("a carried Blockade moves with its vessel and is destroyed with that vessel", () => {
  const { game, home } = fundedAegis();
  const carrier = game.carriers.find((candidate) => candidate.owner === 0)!;
  carrier.hex = home.id;
  carrier.cu = 1;
  carrier.readyTurn = game.turn;
  carrier.movesRemaining = 2;
  game.blockades.push({ id: "doomed-cargo", owner: 0, hex: home.id, active: false, carrierId: carrier.id, readyTurn: game.turn, originFaction: "aegis" });
  const destination = getNeighbors(home.id, mapLibrary[game.mapId]).find((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  const target = game.hexes.find((hex) => hex.id === destination)!;
  target.revealed = true;
  target.owner = undefined;
  target.tier = undefined;
  target.combat = 0;
  game.carriers.push({ id: "overwhelming-defender", owner: 1, type: "cruiser", hex: destination, cu: 4, readyTurn: game.turn, movesRemaining: 2 });

  assert.equal(moveCarriers(game, 0, [carrier.id], destination).ok, true);
  assert.equal(game.carriers.some((candidate) => candidate.id === carrier.id), false);
  const blockade = game.blockades.find((candidate) => candidate.id === "doomed-cargo")!;
  assert.equal(blockade.hex, destination);
  assert.equal(blockade.active, false);
  assert.equal(blockade.carrierId, undefined);
});

test("only Economy II Aegis may sell a Blockade and the buyer chooses deployment", () => {
  const { game, player, home } = fundedAegis();
  const buyerHome = game.hexes.find((hex) => hex.owner === 1 && hex.tier)!;
  game.agreements.push({ id: "trade", type: "trade", parties: [0, 1], startedTurn: game.turn });
  game.blockades.push({ id: "export", owner: 0, hex: home.id, active: true, readyTurn: game.turn, originFaction: "aegis" });
  game.players[1].resources.currency = 5;
  const price = { ...emptyTradeBundle(), currency: 2 };
  const offer = () => addTradeProposal(game, { id: `sale-${game.proposals.length}`, kind: "trade", from: 0, to: 1, offer: emptyTradeBundle(), request: price, blockadeId: "export", createdTurn: game.turn, status: "pending" });

  player.tech.Economy = 1;
  assert.match(offer().message, /Economy II/);
  player.tech.Economy = 2;
  const sent = offer();
  assert.equal(sent.ok, true);
  const proposal = game.proposals.at(-1)!;
  assert.equal(resolveProposal(game, proposal.id, true).ok, false);
  assert.equal(resolveProposal(game, proposal.id, true, home.id).ok, false);
  assert.equal(resolveProposal(game, proposal.id, true, buyerHome.id).ok, true);
  const blockade = game.blockades.find((candidate) => candidate.id === "export")!;
  assert.equal(blockade.owner, 1);
  assert.equal(blockade.hex, buyerHome.id);
  assert.equal(blockade.active, true);
  assert.equal(blockade.carrierId, undefined);
  assert.equal(game.players[1].resources.currency, 3);
});

test("a non-Aegis owner cannot initiate a Blockade sale", () => {
  const game = createGame(2, ["spires", "aegis"], "shattered-reach", "horizon-base", 331002);
  game.players[0].tech.Economy = 4;
  const home = game.hexes.find((hex) => hex.owner === 0 && hex.tier)!;
  game.agreements.push({ id: "agreement", type: "trade", parties: [0, 1], startedTurn: game.turn });
  game.blockades.push({ id: "captured", owner: 0, hex: home.id, active: true, readyTurn: game.turn, originFaction: "aegis" });
  const result = addTradeProposal(game, { id: "illegal-sale", kind: "trade", from: 0, to: 1, offer: emptyTradeBundle(), request: { ...emptyTradeBundle(), currency: 1 }, blockadeId: "captured", createdTurn: game.turn, status: "pending" });
  assert.equal(result.ok, false);
  assert.match(result.message, /Only Aegis/);
});
