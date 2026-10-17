import assert from "node:assert/strict";
import test from "node:test";
import profileJson from "../bots/profiles/meta-analyst.json" with { type: "json" };
import {
  createGame,
  getNeighbors,
  mapLibrary,
  planBotTurn,
  productionPerTurn,
  resolveSecretOrders,
  resolveShatteredConstruction,
  submitSecretOrders,
  takeBotTurn,
} from "../game/index";
import type { BotProfile, PlayerController } from "../game/index";

const profile = profileJson as BotProfile;
const controllers: PlayerController[] = Array.from({ length: 4 }, () => ({ kind: "bot", profileId: profile.id }));

function game() {
  return createGame(4, ["wayfarers", "salvo", "farbound", "aegis"], "shattered-reach", "horizon-base", 42011, controllers, true);
}

test("Wayfarer bot migrates without a Colony Ship and builds on a mobile world", () => {
  const state = game(), player = state.players[0], arkship = state.mobileHabitats.find((mobile) => mobile.owner === 0)!;
  assert.equal(player.colonyShips.length, 0);
  const destination = getNeighbors(arkship.hex, mapLibrary[state.mapId])
    .map((id) => state.hexes.find((hex) => hex.id === id)!)
    .find((hex) => hex.kind !== "rift")!;
  destination.revealed = true;
  destination.kind = "currency";
  const opening = planBotTurn(state, 0, profile);
  assert.ok(opening.orders.some((order) => order.kind === "migration" && order.mobileHabitatId === arkship.id));

  arkship.hex = destination.id;
  player.resources = { material: 10, currency: 10, research: 10, influence: 10 };
  player.labor = 10;
  const developed = planBotTurn(state, 0, profile);
  const build = developed.orders.find((order) => order.kind === "construct" && order.construction.type === "mobileCenter");
  assert.ok(build && build.kind === "construct" && build.construction.type === "mobileCenter");
  assert.equal(build.habitatId, destination.id);
  assert.equal(resolveShatteredConstruction(state, 0, build.habitatId, build.construction), true);
  assert.equal(arkship.centers.length, 1);
});

test("Salvo bot retains a legal Bombardment after its Colony Ship is gone", () => {
  const state = game(), salvo = state.players[1];
  salvo.colonyShips = [];
  const frigate = state.carriers.find((carrier) => carrier.owner === salvo.id && carrier.type === "bombardFrigate")!;
  const target = getNeighbors(frigate.hex, mapLibrary[state.mapId])
    .map((id) => state.hexes.find((hex) => hex.id === id)!)
    .find((hex) => hex.kind !== "rift")!;
  target.revealed = true;
  target.owner = 3;
  target.combat = 3;
  const orders = planBotTurn(state, salvo.id, profile).orders;
  assert.ok(orders.some((order) => order.kind === "bombard" && order.carrierId === frigate.id && order.targetHexId === target.id));
});

test("Farbound bot can scan and move, then replace a lost Exploration Vessel", () => {
  const state = game(), farbound = state.players[2];
  for (const id of getNeighbors(farbound.explorer, mapLibrary[state.mapId])) {
    const hex = state.hexes.find((candidate) => candidate.id === id)!;
    if (hex.kind !== "rift") { hex.revealed = false; hex.kind = "material"; }
  }
  const orders = planBotTurn(state, farbound.id, profile).orders;
  assert.ok(orders.some((order) => order.kind === "explorerMove"));
  assert.ok(orders.some((order) => order.kind === "farboundForwardScan"));
  farbound.hiddenLegacy[1].selected = farbound.hiddenLegacy[1].choices[0];
  state.orderProtocol.currentPlayer = farbound.id;
  state.active = farbound.id;
  const submission = submitSecretOrders(state, farbound.id, orders);
  assert.equal(submission.ok, true, submission.message);

  farbound.explorationVessels = [];
  farbound.resources = { material: 10, currency: 10, research: 10, influence: 10 };
  farbound.labor = 10;
  const replacement = planBotTurn(state, farbound.id, profile).orders;
  assert.ok(replacement.some((order) => order.kind === "construct" && order.construction.type === "exploration"));
  assert.ok(!replacement.some((order) => order.kind === "explorerMove"));
});

test("Guilds bot redirects an existing Factory toward a resource shortage", () => {
  const state = createGame(4, ["guilds", "aegis", "spires", "wayfarers"], "shattered-reach", "horizon-base", 42011, controllers, true);
  const guilds = state.players[0], home = state.hexes.find((hex) => hex.owner === 0 && hex.tier)!;
  guilds.resources = { material: 50, currency: 0, research: 50, influence: 0 };
  home.centers.push("factory");
  const factoryIndex = home.centers.length - 1;
  home.factoryOutputs = { [factoryIndex]: "material" };
  const before = productionPerTurn(state, guilds.id);
  const orders = planBotTurn(state, guilds.id, profile).orders;
  assert.ok(orders.some((order) => order.kind === "factoryOutput" && order.habitatId === home.id && order.factoryIndex === factoryIndex && order.output === "currency"));
  home.factoryOutputs[factoryIndex] = "currency";
  const after = productionPerTurn(state, guilds.id);
  assert.equal(after.material, before.material - 1);
  assert.equal(after.currency, before.currency + 1);
});

test("Spires and Aegis bots can draft their unlocked faction structures", () => {
  const state = createGame(4, ["spires", "aegis", "wayfarers", "guilds"], "shattered-reach", "horizon-base", 42011, controllers, true);
  for (const player of state.players.slice(0, 2)) {
    player.resources = { material: 20, currency: 20, research: 20, influence: 10 };
    player.labor = 10;
  }
  const spires = state.players[0], metropolis = state.hexes.find((hex) => hex.owner === 0 && hex.tier)!;
  spires.tech.Resource = 4;
  metropolis.tier = "Metropolis";
  assert.ok(planBotTurn(state, spires.id, profile).orders.some((order) => order.kind === "construct" && order.construction.type === "arcology"));
  const aegis = state.players[1];
  aegis.tech.Military = 2;
  assert.ok(planBotTurn(state, aegis.id, profile).orders.some((order) => order.kind === "construct" && order.construction.type === "blockade"));
});

test("Aegis bot loads, transports, and deploys a surplus Blockade", () => {
  const state = game(), aegis = state.players[3];
  const carrier = state.carriers.find((unit) => unit.owner === aegis.id && unit.cu > 0)!;
  const origin = state.hexes.find((hex) => hex.id === carrier.hex)!;
  origin.owner = aegis.id;
  const destination = getNeighbors(origin.id, mapLibrary[state.mapId])
    .map((id) => state.hexes.find((hex) => hex.id === id)!)
    .find((hex) => hex.kind !== "rift")!;
  destination.owner = aegis.id;
  state.blockades.push({ id: "aegis-test-blockade", owner: aegis.id, hex: origin.id, active: true, readyTurn: 1, originFaction: "aegis" });
  const load = planBotTurn(state, aegis.id, profile).orders;
  assert.ok(load.some((order) => order.kind === "blockadeCargo" && order.action === "load"));
  state.blockades[0].active = false;
  state.blockades[0].carrierId = carrier.id;
  carrier.hex = destination.id;
  state.blockades[0].hex = destination.id;
  const deploy = planBotTurn(state, aegis.id, profile).orders;
  assert.ok(deploy.some((order) => order.kind === "blockadeCargo" && order.action === "deploy"));
});

test("five-Era bots complete turns while preparing Influence for late Gate tributes", () => {
  const factions = ["helix", "guilds", "wayfarers", "salvo", "foundry", "aurelians"] as const;
  const state = createGame(6, [...factions], "shattered-reach", "horizon-base", 56010,
    Array.from({ length: 6 }, () => ({ kind: "bot", profileId: profile.id })), true, "five-era");
  let guard = 0;
  while (!state.result && guard++ < 150) {
    if (state.orderProtocol.phase === "orders") {
      const action = takeBotTurn(state, state.orderProtocol.currentPlayer, profile);
      assert.equal(action.ok, true, action.message);
      assert.ok("report" in action && action.report.submissionOk);
    } else if (state.orderProtocol.phase === "ready") {
      assert.equal(resolveSecretOrders(state).ok, true);
    } else assert.fail(`Unexpected phase ${state.orderProtocol.phase}`);
  }
  assert.equal(state.turn, 20);
  assert.ok(state.players.some((player) => player.resources.influence > 0 ||
    state.hexes.some((hex) => hex.owner === player.id && (hex.kind === "influence" || hex.centers.includes("influence"))) ||
    state.mobileHabitats.some((mobile) => mobile.owner === player.id && mobile.centers.includes("influence"))));
  assert.ok(state.gate >= 17, `Expected at least 17 of 24 Gate tributes, got ${state.gate}`);
});
