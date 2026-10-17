import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { validateManifest } from "../game/content/validation";
import { platformCapabilities } from "../app/lib/platform";
import ApplicationShell from "../app/components/ApplicationShell";
import { createGame, factionIds } from "../game/index";

test("0.22 expansion manifests accept platform catalog metadata", () => {
  const manifest = {
    schemaVersion: 1,
    id: "hidden-hands",
    name: "Hidden Hands",
    version: "1.0.0",
    horizonVersion: "0.17",
    description: "Four civilizations built around secrecy and influence.",
    coverArt: "assets/cover.webp",
    modules: ["covert-policy"],
    dependencies: [{ id: "horizon-core", version: "1.0.0" }],
    storeProductIds: { steam: "horizon-hidden-hands", apple: "com.horizon.hiddenhands", google: "hidden_hands", web: "hidden-hands" },
    factions: [],
    maps: [],
  } as const;
  assert.deepEqual(validateManifest(manifest), []);
});

test("expansion manifests reject unsafe catalog metadata", () => {
  const invalid = {
    schemaVersion: 1,
    id: "pack",
    name: "Pack",
    version: "1.0.0",
    horizonVersion: "0.17",
    modules: ["Not Safe"],
    dependencies: [{ id: "../escape", version: "latest" }],
    storeProductIds: { unknown: "product" },
  };
  const issues = validateManifest(invalid);
  assert.ok(issues.some((issue) => issue.includes("modules")));
  assert.ok(issues.some((issue) => issue.includes("dependencies")));
  assert.ok(issues.some((issue) => issue.includes("storeProductIds")));
});

test("platform capability adapter keeps storefront APIs outside the game UI", () => {
  assert.deepEqual(platformCapabilities("Mozilla/5.0 (Linux; Android 16)"), {
    platform: "android", canQuit: false, supportsFullscreen: true,
    supportsPushNotifications: true, supportsNativePurchases: true,
    supportsAchievements: true, supportsDeepLinks: true,
  });
  assert.equal(platformCapabilities("", "steam").canQuit, true);
  assert.equal(platformCapabilities("Mozilla/5.0 (iPhone)").supportsFullscreen, false);
  assert.equal(platformCapabilities("Mozilla/5.0").supportsNativePurchases, false);
});

test("application shell renders every primary launch path without browser state", () => {
  const chosen = factionIds.slice(0, 6);
  const gameFactory = () => createGame(6, chosen, "standard-board", "horizon-base");
  const html = renderToStaticMarkup(React.createElement(ApplicationShell, {
    contentCatalog: { schemaVersion: 1, packs: [], maps: [], factions: [], issues: [] },
    contentError: "", hasLocalGame: true, count: 6, setCount() {}, chosen, setChosen() {},
    selectedMapId: "standard-board", setSelectedMapId() {}, gameFormat: "four-era", setGameFormat() {},
    theme: "horizon-base", setTheme() {}, seatControllers: Array(6).fill("human"), setSeatControllers() {},
    createLocal() {}, runSimulation() {}, gameFactory, startHost() {}, openRemote() {}, continueLocal() {}, startTutorial() {}, quickStart() {},
  }));
  for (const label of ["My Games", "Learn to Play", "Quick Start", "Create Game", "Join Game", "Solo Simulation", "Horizon Codex", "Future Content", "Settings"])
    assert.match(html, new RegExp(label));
  assert.match(html, /HORIZON 0\.34\.8/);
});

test("0.22.1 catalogs every documented expansion faction without marking it playable", () => {
  const source = readFileSync(new URL("../app/components/ApplicationShell.tsx", import.meta.url), "utf8");
  const documented = [
    "Spires", "Aegis", "Wayfarers", "Salvo", "Guilds",
    "Directorate", "Consortium", "Exchange", "Covenant", "Junction",
    "Fabricants", "Corsairs", "Arsenal", "Reclaimers", "Pawnbrokers",
    "Seekers", "Scholarium", "Conclave", "Archivists",
    "Quintions", "Triumvirate", "Diaspora", "Muses",
    "Vectors", "House", "Mandate", "Veil",
  ];
  for (const faction of documented) assert.match(source, new RegExp(`\\"${faction}\\"`));
  assert.equal(documented.length, 27);
  assert.match(source, /implementation pending/);
});

test("0.22.1 uses the Gate menu artwork and an enlarged cropped brand mark", () => {
  const css = readFileSync(new URL("../app/application-shell.css", import.meta.url), "utf8");
  assert.match(css, /horizon-gate-menu\.png/);
  assert.match(css, /\.shell-brand\{[^}]*width:290px/);
  assert.match(css, /\.shell-brand img\{[^}]*object-fit:cover/);
});
