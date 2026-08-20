import assert from "node:assert/strict";
import test from "node:test";

import { projectPrivateGame } from "../../game/server/private-view";
import type { GameState } from "../../game/types";

function privateViewFixture() {
  return {
    players: [
      {
        id: 0,
        hiddenLegacy: {
          1: { choices: ["h1-frontier"], selected: "h1-frontier" },
        },
        privateSurveys: [
          { hexId: "0-1", kind: "research", surveyedTurn: 1, soldTo: [] },
        ],
        surveyUsedTurn: 1,
        forwardScanUsedTurn: 1,
      },
      {
        id: 1,
        hiddenLegacy: {
          1: { choices: ["h1-specialist"], selected: "h1-specialist" },
        },
        privateSurveys: [
          { hexId: "1-1", kind: "currency", surveyedTurn: 1, soldTo: [] },
        ],
        surveyUsedTurn: 1,
        forwardScanUsedTurn: 1,
      },
    ],
    hexes: [
      {
        id: "0-1",
        revealed: false,
        kind: "research",
        surveyedBy: [0],
      },
      {
        id: "1-1",
        revealed: false,
        kind: "currency",
        surveyedBy: [1],
      },
      {
        id: "public",
        revealed: true,
        kind: "material",
        surveyedBy: [],
      },
    ],
    proposals: [
      {
        id: "p0",
        kind: "trade",
        from: 0,
        to: 1,
        status: "pending",
      },
      {
        id: "p1",
        kind: "trade",
        from: 1,
        to: 1,
        status: "pending",
      },
    ],
    pendingLabor: [
      { playerId: 0, amount: 1, effectiveTurn: 2 },
      { playerId: 1, amount: 1, effectiveTurn: 2 },
    ],
    orderProtocol: {
      submissions: [
        {
          playerId: 0,
          turn: 1,
          sealedAt: "2026-01-01T00:00:00.000Z",
          orders: [{ id: "secret-0", kind: "hold" }],
        },
        {
          playerId: 1,
          turn: 1,
          sealedAt: "2026-01-01T00:00:00.000Z",
          orders: [{ id: "secret-1", kind: "hold" }],
        },
      ],
    },
    carriers: [
      { id: "c0", owner: 0 },
      { id: "c1", owner: 1 },
    ],
    selectedCarrierIds: ["c0", "c1"],
  } as unknown as GameState;
}

test("private projection hides another civilization's hidden objective and surveys", () => {
  const view = projectPrivateGame(privateViewFixture(), 0);

  assert.deepEqual(view.players[1].hiddenLegacy, {});
  assert.deepEqual(view.players[1].privateSurveys, []);
  assert.equal(view.players[1].surveyUsedTurn, undefined);
  assert.equal(view.players[1].forwardScanUsedTurn, undefined);

  assert.equal(view.players[0].hiddenLegacy[1]?.selected, "h1-frontier");
  assert.equal(view.players[0].privateSurveys[0]?.hexId, "0-1");
});

test("unrevealed hexes expose only the viewer's own surveyed information", () => {
  const view = projectPrivateGame(privateViewFixture(), 0);
  const mine = view.hexes.find((hex) => hex.id === "0-1");
  const theirs = view.hexes.find((hex) => hex.id === "1-1");
  const publicHex = view.hexes.find((hex) => hex.id === "public");

  assert.equal(mine?.kind, "research");
  assert.deepEqual(mine?.surveyedBy, [0]);

  assert.equal(theirs?.kind, "empty");
  assert.deepEqual(theirs?.surveyedBy, []);

  assert.equal(publicHex?.kind, "material");
});

test("sealed Orders and pending Labor are visible only to the owning player", () => {
  const view = projectPrivateGame(privateViewFixture(), 0);

  assert.deepEqual(
    view.orderProtocol.submissions.map((submission) => submission.playerId),
    [0],
  );
  assert.deepEqual(
    view.pendingLabor.map((pending) => pending.playerId),
    [0],
  );
});

test("selected carrier state cannot leak another player's selected unit", () => {
  const view = projectPrivateGame(privateViewFixture(), 0);
  assert.deepEqual(view.selectedCarrierIds, ["c0"]);
});
