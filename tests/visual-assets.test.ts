import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { explorationIcon, tileAssets } from "../game/themes/assets";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("every tile kind has a packaged visual asset", () => {
  const paths = Object.values(tileAssets);
  assert.equal(new Set(paths).size, paths.length);
  paths.forEach((asset) => {
    const path = join(root, "public", asset.replace(/^\//, ""));
    assert.equal(existsSync(path), true, `${asset} should exist`);
    assert.ok(statSync(path).size > 1_000, `${asset} should not be empty`);
  });
});

test("Exploration Technology selects each vessel silhouette", () => {
  assert.equal(explorationIcon(1), "explorer");
  assert.equal(explorationIcon(2), "surveyVessel");
  assert.equal(explorationIcon(3), "deepSurvey");
  assert.equal(explorationIcon(4), "pathfinder");
});
