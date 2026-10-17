import assert from "node:assert/strict";
import test from "node:test";
import { getBotProfile } from "../bots";
import { createGame } from "../game/index";
import { createProjectPlan, projectOrderBonus } from "../game/ai/projects";
import { legacyObjectiveProgress } from "../game/rules/legacy";

const emperor = getBotProfile("ai-emperor")!;
const controllers = Array.from({ length: 4 }, () => ({ kind: "bot" as const, profileId: emperor.id }));

test("a faction project retains its prerequisite and exposes a second-layer funding shortage", () => {
  const game = createGame(4, ["aegis", "guilds", "foundry", "meridian"], "shattered-reach", "horizon-base", 39107, controllers, true);
  const initial = createProjectPlan(game, 0, emperor);
  const fortress = initial.projects.find((project) => project.id === "ae-fortress")!;
  assert.equal(fortress.next.label, "Habitats 1/3");
  const arms = createProjectPlan(game, 0, emperor).projects.find((project) => project.id === "ae-arms");
  // A less immediately feasible project still exposes the second input layer.
  if (arms) {
    assert.equal(arms.next.label, "Economy 2");
    assert.ok((arms.missing.research || 0) > 0);
    assert.ok((arms.missing.currency || 0) > 0, "Research production requires Currency to build");
  }
  const remembered = createProjectPlan(game, 0, emperor, initial.commitments);
  assert.equal(remembered.commitments.find((project) => project.id === fortress.id)?.committedTurn, game.turn);
  const order = { id: "first-settlement", kind: "establish" as const, hexId: "1-1", shipId: "ship-0", moduleId: "module-0" };
  assert.ok(projectOrderBonus(game, 0, order, [fortress]).score > 0);
});

test("Spires development makes partial objective progress before an LP claim", () => {
  const game = createGame(4, ["spires", "aegis", "wayfarers", "salvo"], "shattered-reach", "horizon-base", 39108, controllers, true);
  const before = legacyObjectiveProgress(game, 0, "sp-urban");
  const home = game.hexes.find((hex) => hex.owner === 0 && hex.tier)!;
  home.centers.push("material");
  const after = legacyObjectiveProgress(game, 0, "sp-urban");
  assert.ok(after.current > before.current);
  assert.equal(after.complete, false);
  assert.equal(after.target, 2);
});

test("a completed prerequisite advances the same faction project to its next milestone", () => {
  const game = createGame(4, ["helix", "foundry", "spires", "guilds"], "shattered-reach", "horizon-base", 39110, controllers, true);
  const before = createProjectPlan(game, 0, emperor);
  const project = before.projects.find((item) => item.id === "h-network")!;
  assert.equal(project.next.label, "Resource 2");
  game.players[0].tech.Resource = 2;
  game.turn++;
  const after = createProjectPlan(game, 0, emperor, before.commitments);
  const continued = after.projects.find((item) => item.id === "h-network")!;
  assert.match(continued.next.label, /Habitats 1\/2/);
  assert.equal(after.commitments.find((item) => item.id === "h-network")?.committedTurn, before.commitments.find((item) => item.id === "h-network")?.committedTurn);
});

test("Aurelian Concert of Worlds can complete with three rivals in a four-seat game", () => {
  const game = createGame(4, ["aurelians", "spires", "wayfarers", "guilds"], "shattered-reach", "horizon-base", 39109, controllers, true);
  for (const [opponent, type] of [[1, "trade"], [2, "nonAggression"], [3, "research"]] as const)
    game.agreements.push({ id: `agreement-${opponent}`, type, parties: [0, opponent], startedTurn: game.turn });
  game.players[0].resources.influence = 4;
  const result = legacyObjectiveProgress(game, 0, "a-concert");
  assert.equal(result.complete, true);
  assert.match(result.label, /Partners 3\/3/);
});
