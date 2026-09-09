import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";

async function sources(...paths: string[]) {
  return (await Promise.all(paths.map((path) => readFile(path, "utf8")))).join("\n");
}

test("Network UI exposes every sealed Order category", async () => {
  const source = await sources(
    "app/components/network/NetworkGameBoard.tsx",
    "app/components/network/NetworkGatePanel.tsx",
    "app/components/network/NetworkMilitaryPanel.tsx",
    "app/components/BuildPanel.tsx",
    "app/components/TechnologyPanel.tsx",
  );
  for (const kind of ["explorerMove", "colonyMove", "carrierMove", "civilianMove", "longRangeSurvey", "establish", "prospect", "construct", "technology", "tribute"])
    assert.match(source, new RegExp(`kind:\\s*[\"']${kind}[\"']`), `${kind} must be reachable in Network play`);
});

test("Network UI exposes economy, Gate, Legacy, diplomacy, and faction commands", async () => {
  const source = await sources(
    "app/components/network/NetworkGameBoard.tsx",
    "app/components/network/NetworkEconomyPanel.tsx",
    "app/components/network/NetworkLegacyPanel.tsx",
    "app/components/network/NetworkDiplomacyPanel.tsx",
    "app/components/network/NetworkMilitaryPanel.tsx",
  );
  for (const kind of ["marketExchange", "economicSalvage", "drawHidden", "selectHidden", "setHiddenCompleted", "claimUniversal", "claimCivilization", "politicalCapital", "negotiationSurvey", "transferCombatUnit", "surveyExchange", "brokerTrade"])
    assert.match(source, new RegExp(`kind:\\s*[\"']${kind}[\"']`), `${kind} must be reachable in Network play`);
});

test("Network map actions provide draft persistence and navigation aids", async () => {
  const source = await readFile("app/components/network/NetworkGameBoard.tsx", "utf8");
  assert.match(source, /localStorage\.setItem/);
  assert.match(source, /Establish Habitat/);
  assert.match(source, /Long-Range Survey/);
  assert.match(source, /Prospect current world/);
  assert.match(source, /Zoom out/);
  assert.match(source, /Center/);
});

test("Network UI uses map-first workspaces, proposal alerts, and forced Hidden selection", async () => {
  const source = await readFile("app/components/network/NetworkGameBoard.tsx", "utf8");
  assert.match(source, /network-command-dock/);
  assert.match(source, /network-workspace-overlay/);
  assert.match(source, /proposal-alert/);
  assert.match(source, /hidden-required-overlay/);
  for (const panel of ["diplomacy", "legacy", "economy", "technology"])
    assert.match(source, new RegExp(`fullScreenPanels[^;]+[\"']${panel}[\"']`));
});

test("Network UI exposes contextual map actions, visible draft markers, and actionable notifications", async () => {
  const board = await readFile("app/components/network/NetworkGameBoard.tsx", "utf8");
  const diplomacy = await readFile("app/components/network/NetworkDiplomacyPanel.tsx", "utf8");
  for (const surface of ["map-context-menu", "faction-scorebar", "notification-popover", "seal-checklist", "unit-order-marker", "hex-order-marker", "quickConstructions"])
    assert.match(board, new RegExp(surface), `${surface} must remain available in Network play`);
  assert.match(board, /Farbound Survey/);
  assert.match(board, /transferCombatUnit/);
  assert.match(board, /initialTargetId=/);
  assert.match(diplomacy, /initialTargetId/);
});

test("Network vessel selection remains responsive before Orders begin", async () => {
  const board = await readFile("app/components/network/NetworkGameBoard.tsx", "utf8");
  assert.match(board, /function selectMapUnit\(unit: MapUnit\)[^{]*\{\s*setMapUnit\(unit\)/);
  assert.doesNotMatch(board, /function selectMapUnit\(unit: MapUnit\)[^{]*\{[^}]*if \(!canPlan\) return/);
  assert.match(board, /data-map-columns=\{map\.columns\}/);
});

test("Network faction selection exposes illustrated full-screen profiles", async () => {
  const lobby = await readFile("app/components/network/RoomLobby.tsx", "utf8");
  const board = await readFile("app/components/network/NetworkGameBoard.tsx", "utf8");
  for (const surface of ["faction-browser-overlay", "faction-profile-hero", "faction-profile-lore", "faction-profile-abilities", "faction-profile-objectives"])
    assert.match(lobby, new RegExp(surface));
  assert.match(lobby, /selectFaction/);
  assert.match(board, /faction\?\.logo/);
  for (const faction of ["varkesh", "helix", "foundry", "aurelians", "meridian", "farbound"])
    await access(`public/factions/${faction}.png`);
});
