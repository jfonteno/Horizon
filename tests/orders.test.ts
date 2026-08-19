import assert from "node:assert/strict";
import test from "node:test";
import {
  beginSecretOrders,
  createGame,
  drawHiddenChoices,
  projectPrivateGame,
  projectedOrderBudget,
  resolveSecretOrders,
  selectHiddenLegacy,
  submitSecretOrders,
} from "../game/index";
import type { GameState, SecretOrder } from "../game/index";

const factions = ["varkesh", "helix", "foundry", "farbound"] as const;

function game(seed: number) {
  const state = createGame(4, [...factions], "shattered-reach", "horizon-base", seed);
  state.players.forEach((player) => {
    drawHiddenChoices(state, player.id, state.era);
    selectHiddenLegacy(state, player.id, player.hiddenLegacy[state.era].choices[0]);
  });
  return state;
}

function sealAll(state: GameState, orders: SecretOrder[][]) {
  assert.equal(beginSecretOrders(state).ok, true);
  orders.forEach((set, playerId) =>
    assert.equal(submitSecretOrders(state, playerId, set).ok, true),
  );
  assert.equal(state.orderProtocol.phase, "ready");
}

test("submitting Orders ends the active seat and centers the next civilization", () => {
  const state = game(9000);
  assert.equal(state.orderProtocol.phase, "orders");
  assert.equal(state.active, 0);
  assert.equal(submitSecretOrders(state, 0, []).ok, true);
  assert.equal(state.active, 1);
  assert.equal(state.orderProtocol.currentPlayer, 1);
  assert.equal(state.selected, state.hexes.find((hex) => hex.owner === 1 && hex.kind === "home")?.id);
  assert.deepEqual(
    state.selectedCarrierIds,
    state.carriers.filter((carrier) => carrier.owner === 1 && carrier.hex === state.selected).slice(0, 1).map((carrier) => carrier.id),
  );
});

test("the first Turn of every Era requires a selected Hidden Objective", () => {
  for (const era of [1, 2, 3, 4]) {
    const state = createGame(4, [...factions], "shattered-reach", "horizon-base", 9100 + era);
    state.era = era;
    state.turn = (era - 1) * 4 + 1;
    state.orderProtocol.turn = state.turn;
    const blocked = submitSecretOrders(state, 0, []);
    assert.equal(blocked.ok, false);
    assert.match(blocked.message, /Hidden Legacy objective/);
    drawHiddenChoices(state, 0, era);
    assert.equal(selectHiddenLegacy(state, 0, state.players[0].hiddenLegacy[era].choices[0]), true);
    assert.equal(submitSecretOrders(state, 0, []).ok, true);
  }
});

test("purchase Orders reserve one shared projected budget", () => {
  const state = game(9004);
  const player = state.players[0];
  const habitatId = state.hexes.find((hex) => hex.owner === player.id && hex.tier)!.id;
  player.resources = { material: 3, currency: 2, research: 2, influence: 0 };
  player.labor = 3;
  const orders: SecretOrder[] = [
    { id: "module", kind: "construct", habitatId, construction: { type: "module" } },
    { id: "military", kind: "technology", branch: "Military" },
  ];
  const projection = projectedOrderBudget(state, player.id, orders);
  assert.match(projection.error || "", /insufficient resources or Labor/);
  assert.equal(submitSecretOrders(state, player.id, orders).ok, false);
  assert.equal(state.orderProtocol.submissions.length, 0);
});

test("affordable purchases are accepted without spending before resolution", () => {
  const state = game(9006);
  const player = state.players[0];
  const habitatId = state.hexes.find((hex) => hex.owner === player.id && hex.tier)!.id;
  player.resources = { material: 10, currency: 10, research: 10, influence: 10 };
  player.labor = 10;
  const before = structuredClone(player.resources);
  const orders: SecretOrder[] = [
    { id: "patrol", kind: "construct", habitatId, construction: { type: "carrier", carrier: "patrol" } },
    { id: "economy", kind: "technology", branch: "Economy" },
  ];
  assert.equal(projectedOrderBudget(state, player.id, orders).error, undefined);
  assert.equal(submitSecretOrders(state, player.id, orders).ok, true);
  assert.deepEqual(player.resources, before);
});

test("secret Orders do not change state before every civilization seals", () => {
  const state = game(9001),
    origin = state.players[0].explorer,
    target = state.hexes.find(
      (hex) =>
        hex.kind !== "rift" &&
        Math.abs(hex.row - state.hexes.find((h) => h.id === origin)!.row) <= 1 &&
        hex.id !== origin,
    )!;
  beginSecretOrders(state);
  assert.equal(
    submitSecretOrders(state, 0, [
      { id: "move", kind: "explorerMove", destination: target.id },
    ]).ok,
    true,
  );
  assert.equal(state.players[0].explorer, origin);
  assert.equal(projectPrivateGame(state, 1).orderProtocol.submissions.length, 0);
});

test("opposing forces crossing one edge fight before completing movement", () => {
  const state = game(9002),
    a = state.carriers[0],
    b = state.carriers[1],
    first = state.hexes.find((hex) => hex.kind !== "rift")!,
    second = state.hexes.find(
      (hex) =>
        hex.kind !== "rift" &&
        hex.id !== first.id &&
        Math.abs(hex.row - first.row) <= 1 &&
        Math.abs(hex.col - first.col) <= 1,
    )!;
  first.revealed = second.revealed = true;
  a.hex = first.id;
  a.cu = 4;
  a.movesRemaining = 2;
  b.hex = second.id;
  b.cu = 2;
  b.movesRemaining = 2;
  sealAll(state, [
    [{ id: "a", kind: "carrierMove", carrierIds: [a.id], destination: second.id }],
    [{ id: "b", kind: "carrierMove", carrierIds: [b.id], destination: first.id }],
    [],
    [],
  ]);
  resolveSecretOrders(state);
  assert.equal(state.carriers.some((carrier) => carrier.id === b.id), false);
  assert.equal(state.carriers.find((carrier) => carrier.id === a.id)?.hex, second.id);
  assert.equal(state.carriers.find((carrier) => carrier.id === a.id)?.cu, 2);
});

test("simultaneous valid Tributes all pay and receive credit at the Gate cap", () => {
  const state = game(9003), target = state.players.length * 3;
  state.turn = 16;
  state.era = 4;
  state.gate = target - 1;
  state.players.forEach((player) => {
    player.resources = { material: 10, currency: 10, research: 10, influence: 10 };
    player.labor = 10;
    player.laborCap = 10;
  });
  sealAll(
    state,
    state.players.map((player) => [
      { id: `tribute-${player.id}`, kind: "tribute" as const },
    ]),
  );
  resolveSecretOrders(state);
  assert.equal(state.gate, target);
  state.players.forEach((player) => {
    assert.equal(player.eraTributes[3], 1);
    assert.equal(player.tributes, 1);
    assert.deepEqual(player.resources, { material: 8, currency: 8, research: 8, influence: 9 });
    assert.equal(player.labor, 9);
  });
  const capped = projectedOrderBudget(state, 0, [{ id: "too-late", kind: "tribute" }]);
  assert.match(capped.error || "", /Gate is complete/);
});

test("Era IV accepts multiple affordable Tribute Orders from one civilization", () => {
  const state = game(9005), player = state.players[0];
  state.turn = 13;
  state.era = 4;
  state.players.forEach((candidate) => {
    drawHiddenChoices(state, candidate.id, 4);
    selectHiddenLegacy(state, candidate.id, candidate.hiddenLegacy[4].choices[0]);
  });
  player.resources = { material: 20, currency: 20, research: 20, influence: 20 };
  player.labor = 20;
  player.laborCap = 20;
  sealAll(state, [
    [
      { id: "tribute-a", kind: "tribute" },
      { id: "tribute-b", kind: "tribute" },
    ],
    [],
    [],
    [],
  ]);
  resolveSecretOrders(state);
  assert.equal(player.eraTributes[3], 2);
  assert.equal(player.tributes, 2);
  assert.equal(state.gate, 2);
});

test("Hidden Legacy remains unscored until Era-end resolution", () => {
  const state = game(9004), player = state.players[0];
  state.turn = 4;
  state.era = 1;
  player.hiddenLegacy[1] = {
    choices: ["h1-frontier"],
    selected: "h1-frontier",
  };
  player.legacyMetrics.habitatsEstablished[0] = 2;
  sealAll(state, [[], [], [], []]);
  assert.equal(player.legacy.hidden, 0);
  assert.equal(player.hiddenLegacy[1].scored, undefined);
  resolveSecretOrders(state);
  assert.equal(player.legacy.hidden, 4);
  assert.equal(player.hiddenLegacy[1].scored, true);
});
