import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  advanceTutorial,
  beginSecretOrders,
  codexEntries,
  createFirstHorizon,
  drawHiddenChoices,
  firstHorizonLessons,
  mapIds,
  projectPrivateGame,
  resolveSecretOrders,
  selectHiddenLegacy,
  submitSecretOrders,
} from "../game/index";

test("First Horizon creates a deterministic eight-Turn teaching game", () => {
  const first = createFirstHorizon();
  const second = createFirstHorizon();
  assert.equal(first.format, "first-horizon");
  assert.equal(first.mapId, "first-horizon");
  assert.equal(first.players.length, 3);
  assert.deepEqual(first.players.map((player) => player.faction), ["foundry", "helix", "varkesh"]);
  assert.deepEqual(first.hexes.map((hex) => hex.kind), second.hexes.map((hex) => hex.kind));
  assert.equal(first.hexes.find((hex) => hex.id === "2-1")?.kind, "currency", "learning match has early access to Currency");
  assert.equal(first.hexes.find((hex) => hex.id === "1-2")?.kind, "anomaly");
  assert.equal(first.tutorial?.step, 0);
  assert.equal(first.scenarioId, "first-horizon");
  assert.equal(mapIds.includes("first-horizon"), false, "tutorial map must not appear in ordinary setup");
});

test("First Horizon guidance advances from explicit and game-state events", () => {
  const game = createFirstHorizon();
  assert.equal(game.players[0].hiddenLegacy[1].choices.length, 3);
  assert.equal(advanceTutorial(game, true), true);
  assert.equal(firstHorizonLessons[game.tutorial!.step].id, "legacy");
  assert.equal(selectHiddenLegacy(game, 0, game.players[0].hiddenLegacy[1].choices[0]), true);
  assert.equal(advanceTutorial(game), true);
  assert.equal(firstHorizonLessons[game.tutorial!.step].id, "inspect");
  game.selected = "2-1";
  assert.equal(advanceTutorial(game), true);
  assert.equal(firstHorizonLessons[game.tutorial!.step].id, "explore");
});

test("resolution creates a private command briefing", () => {
  const game = createFirstHorizon();
  for (const player of game.players) {
    drawHiddenChoices(game, player.id, 1);
    assert.equal(selectHiddenLegacy(game, player.id, player.hiddenLegacy[1].choices[0]), true);
  }
  beginSecretOrders(game);
  for (const player of game.players)
    assert.equal(submitSecretOrders(game, player.id, [{ id:`hold-${player.id}`,kind:"hold" }]).ok, true);
  assert.equal(resolveSecretOrders(game).ok, true);
  assert.equal(game.resolutionBriefs?.length, 3);
  assert.equal(game.resolutionBriefs?.[0].turn, 1);
  const privateGame = projectPrivateGame(game, 0);
  assert.deepEqual(privateGame.resolutionBriefs?.map((brief) => brief.playerId), [0]);
});

test("0.29.0 exposes searchable rules, tutorial, Quick Start, and resolution UI", async () => {
  assert.ok(codexEntries.length >= 10);
  assert.ok(firstHorizonLessons.length >= 10);
  const source = await Promise.all([
    "app/components/ApplicationShell.tsx",
    "app/components/HorizonCodex.tsx",
    "app/components/FirstHorizonGuide.tsx",
    "app/components/TurnResolutionSummary.tsx",
  ].map((path) => readFile(path,"utf8"))).then((parts) => parts.join("\n"));
  for (const phrase of ["Learn to Play","Quick Start","Horizon Codex","Search Horizon Codex","Command briefing","Hide guidance"])
    assert.match(source,new RegExp(phrase));
  assert.match(source,/0\.34\.8/);
});
