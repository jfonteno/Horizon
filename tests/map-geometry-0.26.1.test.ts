import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hexColumnClass, mapCanvasDimensions } from "../app/lib/map-geometry";

test("map canvases preserve sector scale across 5x5, 9x9, and 11x11 boards", () => {
  assert.deepEqual(mapCanvasDimensions(5, 5), { width: 828, height: 732 });
  assert.deepEqual(mapCanvasDimensions(9, 9), { width: 1420, height: 1260 });
  assert.deepEqual(mapCanvasDimensions(11, 11), { width: 1716, height: 1524 });
});

test("hex and unit staggering follows column parity instead of DOM position", async () => {
  assert.equal(hexColumnClass(0), "");
  assert.equal(hexColumnClass(1), "offset");
  assert.equal(hexColumnClass(10), "");

  const globals = await readFile("app/globals.css", "utf8");
  const multiplayer = await readFile("app/multiplayer.css", "utf8");
  assert.match(globals, /repeat\(var\(--map-columns, 9\), 1fr\)/);
  assert.match(globals, /repeat\(var\(--map-rows, 9\), 1fr\)/);
  assert.match(globals, /\.hex\.offset\s*\{[^}]*translateY\(50%\)/s);
  assert.doesNotMatch(`${globals}\n${multiplayer}`, /\.hex:nth-child\((?:9|11)n/);
});

test("local and network boards share dimension-aware hex and vessel geometry", async () => {
  const localBoard = await readFile("app/page.tsx", "utf8");
  const networkBoard = await readFile("app/components/network/NetworkGameBoard.tsx", "utf8");
  for (const source of [localBoard, networkBoard]) {
    assert.match(source, /data-map-columns=\{map\.columns\}/);
    assert.match(source, /data-map-rows=\{map\.rows\}/);
    assert.match(source, /"--map-columns": map\.columns/);
    assert.match(source, /"--map-rows": map\.rows/);
    assert.match(source, /mapCanvasDimensions\(map\.columns, map\.rows\)/);
    assert.match(source, /className=\{`hex \$\{hexColumnClass\(/);
    assert.match(source, /className=\{`unit-cell \$\{hexColumnClass\(/);
  }
});

test("First Horizon guidance is docked and can collapse without abandoning the tutorial", async () => {
  const page = await readFile("app/page.tsx", "utf8");
  const guide = await readFile("app/components/FirstHorizonGuide.tsx", "utf8");
  const rightRail = page.indexOf('<aside className="right-rail">');
  const guidePlacement = page.lastIndexOf("<FirstHorizonGuide");
  assert.ok(rightRail >= 0 && guidePlacement > rightRail);
  assert.match(guide, /aria-expanded=\{!collapsed\}/);
  assert.match(guide, /Show mission/);
  assert.match(guide, /setCollapsed/);
  assert.equal((guide.match(/tutorial-abandoned/g) || []).length, 1);
});
