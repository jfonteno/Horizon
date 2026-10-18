import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../game/engine/create-game";
import { evaluateLegacy, manualClaimCivilization } from "../game/rules/legacy";
import { resolvePolicyVotes, sealPolicyVote } from "../game/rules/policy-deck";
import { projectPrivateGame, projectSpectatorGame } from "../game/server/private-view";
import { combatHexesFromReplays } from "../app/lib/combat-hexes";
import type { TurnReplay } from "../game/types";

const game = () => createGame(4, ["helix", "foundry", "guilds", "meridian"], "standard-board-61", "horizon-base", 4519);

test("simultaneous Universal qualifiers each receive LP once", () => {
  const state = game();
  for (const id of [0, 1]) {
    const home = state.hexes.find((hex) => hex.kind === "home" && hex.owner === id)!;
    home.centers.push("material", "currency");
    const neighbor = state.hexes.find((hex) => hex.owner === undefined && hex.kind !== "rift")!;
    neighbor.owner = id;
    neighbor.tier = "Outpost";
  }
  evaluateLegacy(state);
  const claims = state.universalClaims.filter((claim) => claim.objectiveId === "first-foundations");
  assert.deepEqual(claims.map((claim) => claim.playerId), [0, 1]);
  assert.equal(state.players[0].legacy.universal, 3);
  assert.equal(state.players[1].legacy.universal, 3);
  evaluateLegacy(state);
  assert.equal(state.universalClaims.filter((claim) => claim.objectiveId === "first-foundations").length, 2);
});

test("server cannot grant an incomplete or automatic Civilization claim manually", () => {
  const state = game();
  assert.equal(manualClaimCivilization(state, 0, "h-leadership"), false);
  assert.equal(state.players[0].lp, 0);
});

test("Policy ballots accept abstention, reserve Influence, and keep selections private until resolution", () => {
  const state = game();
  state.players[0].resources.influence = 3;
  assert.equal(sealPolicyVote(state, 0, "open-markets", 2).ok, true);
  assert.equal(state.players[0].resources.influence, 1);
  assert.equal(sealPolicyVote(state, 1, "", 0).ok, true);
  assert.equal(sealPolicyVote(state, 0, "infrastructure-grants", 1).ok, false);
  assert.deepEqual(projectPrivateGame(state, 1).policyElection?.votes.map((vote) => vote.playerId), [1]);
  assert.equal(projectSpectatorGame(state).policyElection?.votes.length, 0);
  resolvePolicyVotes(state, [{ playerId: 0, order: { id: "duplicate", kind: "policyVote", policyId: "cultural-funding", influence: 1 } }]);
  assert.equal(state.policyElection?.activePolicyId, "open-markets");
  assert.equal(state.players[0].resources.influence, 1);
  assert.equal(state.policyElection?.votes.length, 2);
});

test("combat locations remain marked beyond the latest turn, including mutual destruction", () => {
  const replays = [
    { events: ["Coalition combat at 4-6 ended in mutual destruction."] },
    { events: ["The Guilds won fleet combat at 5-3, 6 CS to 1."] },
    { events: ["The Helix built a Center."] },
  ] as TurnReplay[];
  assert.deepEqual([...combatHexesFromReplays(replays)].sort(), ["4-6", "5-3"]);
});
