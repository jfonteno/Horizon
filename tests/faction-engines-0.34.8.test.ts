import assert from "node:assert/strict";
import test from "node:test";
import { addTradeProposal, createGame, emptyTradeBundle, evaluateLegacy, getNeighbors,
  marketExchange, marketRate, moveCarriers, resolveProposal, resolveShatteredOrders, mapLibrary } from "../game/index";
import { carrierLibrary } from "../game/rules/fleet";

test("Aurelian Influence trades transfer stock and count distinct recipients", () => {
  const game = createGame(4, ["aurelians", "spires", "wayfarers", "salvo"], "shattered-reach", "horizon-base", 34801);
  game.players[0].resources.influence = 10;
  for (const partner of game.players.slice(1)) {
    const beforeInfluence = partner.resources.influence;
    partner.resources.material = 10;
    game.agreements.push({ id: `route-${partner.id}`, type: "trade", parties: [0, partner.id], startedTurn: 1 });
    const proposal = { id: `influence-${partner.id}`, kind: "trade" as const, from: 0, to: partner.id,
      offer: { ...emptyTradeBundle(), influence: 1 }, request: { ...emptyTradeBundle(), material: 1 },
      createdTurn: game.turn, status: "pending" as const };
    assert.equal(addTradeProposal(game, proposal).ok, true);
    assert.equal(resolveProposal(game, proposal.id, true).ok, true);
    assert.equal(partner.resources.influence, beforeInfluence + 1);
  }
  assert.deepEqual(new Set(game.players[0].legacyMetrics.aurelianInfluenceTradePartners), new Set([1, 2, 3]));
  evaluateLegacy(game);
  assert.ok(game.players[0].civilizationClaims.includes("a-broker"));
  const illegal = { id: "illegal-influence", kind: "trade" as const, from: 1, to: 0,
    offer: { ...emptyTradeBundle(), influence: 1 }, request: emptyTradeBundle(),
    createdTurn: game.turn, status: "pending" as const };
  assert.match(addTradeProposal(game, illegal).message, /Only Aurelians/);
});

test("Aurelian Market exchange spends exactly eight Influence and leaves other factions locked out", () => {
  const game = createGame(2, ["aurelians", "spires"], "shattered-reach", "horizon-base", 34802);
  const aurelian = game.players[0];
  aurelian.resources.influence = 10;
  assert.equal(marketRate(aurelian, "influence", "research"), 2);
  assert.equal(marketRate(game.players[1], "influence", "research"), null);
  for (let i = 0; i < 4; i++) assert.equal(marketExchange(game, 0, "influence", "research").ok, true);
  assert.equal(aurelian.resources.influence, 2);
  assert.equal(aurelian.legacyMetrics.aurelianMarketInfluenceSpent, 8);
  evaluateLegacy(game);
  assert.ok(aurelian.civilizationClaims.includes("a-exchange"));
});

test("Arkship voyages score for distinct legal moves and Salvo frigates start with three movement", () => {
  const game = createGame(2, ["wayfarers", "salvo"], "shattered-reach", "horizon-base", 34803);
  assert.equal(game.players[0].resources.influence, 2);
  const ark = game.mobileHabitats.find((mobile) => mobile.owner === 0)!;
  const map = mapLibrary[game.mapId];
  for (let step = 0; step < 3; step++) {
    const targetId = getNeighbors(ark.hex, map).find((id) =>
      !game.players[0].legacyMetrics.wayfarerArkshipHexes?.includes(id) &&
      game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
    game.hexes.find((hex) => hex.id === targetId)!.revealed = true;
    ark.movesRemaining = 1;
    game.turn++;
    resolveShatteredOrders(game, [{ playerId: 0, order: { id: `migrate-${step}`, kind: "migration", mobileHabitatId: ark.id, destination: targetId } }]);
  }
  evaluateLegacy(game);
  assert.ok(game.players[0].civilizationClaims.includes("wa-voyage"));
  assert.equal(carrierLibrary.bombardFrigate.move, 3);
  assert.equal(game.carriers.find((carrier) => carrier.owner === 1)?.movesRemaining, 3);
});

test("a crewed Bombard Frigate can traverse three revealed hexes in one turn", () => {
  const game = createGame(2, ["salvo", "spires"], "shattered-reach", "horizon-base", 34804);
  const gun = game.carriers.find((carrier) => carrier.owner === 0 && carrier.type === "bombardFrigate")!;
  const visited = new Set([gun.hex]);
  for (let step = 0; step < 3; step++) {
    const next = getNeighbors(gun.hex, mapLibrary[game.mapId]).find((id) =>
      !visited.has(id) && game.hexes.some((hex) => hex.id === id && hex.kind !== "rift" &&
        (hex.owner === undefined || hex.owner === 0)) &&
      !game.carriers.some((carrier) => carrier.hex === id && carrier.owner !== 0));
    assert.ok(next, `a safe step ${step + 1} exists`);
    game.hexes.find((hex) => hex.id === next)!.revealed = true;
    assert.equal(moveCarriers(game, 0, [gun.id], next).ok, true);
    visited.add(next);
  }
  assert.equal(gun.movesRemaining, 0);
  assert.equal(visited.size, 4);
});
