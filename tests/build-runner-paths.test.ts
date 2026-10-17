import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("self-hosted build launches from an extracted folder with spaces and parentheses", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "Horizon Playtest (1) "));
  context.after(() => rm(root, { recursive: true, force: true }));
  const runner = join(root, "scripts", "task-runner.mjs");
  const cli = join(root, "node_modules", "vinext", "dist", "cli.js");
  const marker = join(root, "cli-args.json");
  await mkdir(dirname(runner), { recursive: true });
  await mkdir(dirname(cli), { recursive: true });
  await copyFile(resolve("scripts/task-runner.mjs"), runner);
  await writeFile(cli, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, JSON.stringify({args:process.argv.slice(2),standalone:process.env.HORIZON_STANDALONE,folder:process.cwd()}));`);
  const result = spawnSync(process.execPath, [runner, "build", "--standalone"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(await readFile(marker, "utf8")), { args: ["build"], standalone: "1", folder: root });
});
