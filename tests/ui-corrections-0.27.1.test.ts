import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ApplicationShell from "../app/components/ApplicationShell";
import { createFirstHorizon, createGame, factionIds, MemoryRoomRepository, RoomService } from "../game/index";

function renderShell(launchBusy = false) {
  const chosen = factionIds.slice(0, 6);
  return renderToStaticMarkup(React.createElement(ApplicationShell, {
    launchBusy,
    contentCatalog: { schemaVersion: 1, packs: [], maps: [], factions: [], issues: [] },
    contentError: "", hasLocalGame: false, count: 6, setCount() {}, chosen, setChosen() {},
    selectedMapId: "standard-board", setSelectedMapId() {}, gameFormat: "four-era", setGameFormat() {},
    theme: "horizon-base", setTheme() {}, seatControllers: Array(6).fill("human"), setSeatControllers() {},
    createLocal() {}, runSimulation() {}, gameFactory: () => createGame(6, chosen, "standard-board", "horizon-base"),
    startHost() {}, openRemote() {}, continueLocal() {}, startTutorial() {}, quickStart() {},
  }));
}

test("0.27.1 accepts First Horizon as a local room while preserving network limits", async () => {
  const service = new RoomService(new MemoryRoomRepository());
  const tutorial = createFirstHorizon("horizon-base");
  assert.equal(tutorial.players.length, 3);
  const local = await service.create(tutorial, "Local Commander", "local");
  assert.equal(local.summary.mode, "local");
  assert.equal(local.summary.seats.length, 3);
  await assert.rejects(() => service.create(tutorial, "Host", "network"), /four to six civilizations/);
});

test("launching a match disables duplicate menu launches and reports progress", () => {
  const html = renderShell(true);
  assert.match(html, /role="status">Preparing your command board/);
  const quickButtons = html.match(/<button[^>]*>[^]*?<\/button>/g)?.filter((button) => button.includes("Quick Start")) || [];
  assert.equal(quickButtons.length, 2);
  for (const button of quickButtons) assert.match(button, /disabled=""/);
});

test("0.27.1 consolidates training and replaces the duplicate promotion with briefings", async () => {
  const html = renderShell();
  assert.equal(html.match(/Learn to Play/g)?.length, 1);
  assert.doesNotMatch(html, /First Horizon is ready|Begin training/);
  assert.match(html, /GAME NEWS/);
  assert.match(html, /Closed Beta Command is live/);
  const source = await readFile("app/components/ApplicationShell.tsx", "utf8");
  for (const category of ["GAME NEWS", "NEW FEATURES", "COMMAND SETTINGS", "FEATURED"]) assert.match(source, new RegExp(category));
});

test("0.27.1 removes corner lifecycle cards and avoids stale interactive bundles", async () => {
  const lifecycle = await readFile("app/components/PwaLifecycle.tsx", "utf8");
  const worker = await readFile("public/sw.js", "utf8");
  const css = await readFile("app/application-shell.css", "utf8");
  assert.doesNotMatch(lifecycle, /app-lifecycle|UPDATE READY|OFFLINE|INSTALL HORIZON/);
  assert.match(lifecycle, /return null/);
  assert.match(worker, /\(\?:css\|js\)/);
  assert.match(worker, /const response = await fetch\(request\)/);
  assert.doesNotMatch(css, /\.app-lifecycle/);
});

test("0.27.1 restores complete seat configuration and fullscreen desktop presentation", async () => {
  const home = await readFile("app/page.tsx", "utf8");
  const shell = await readFile("app/components/ApplicationShell.tsx", "utf8");
  const manifest = JSON.parse(await readFile("public/manifest.webmanifest", "utf8"));
  assert.match(home, /configuredFactions/);
  assert.match(home, /while \(next\.length < count\)/);
  assert.match(shell, /shell-profile/);
  assert.match(shell, /toggleFullscreen/);
  assert.match(shell, /horizon-soundtrack-changed/);
  assert.equal(manifest.display, "fullscreen");
  assert.deepEqual(manifest.display_override, ["fullscreen", "standalone"]);
});
