import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceDirectories = ["app", "bots", "game", "build", "public", "scripts"];
const sourceFiles = ["package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "postcss.config.mjs"];

async function sourceFingerprint(root) {
  const hash = createHash("sha256");
  hash.update(`${process.platform}/${process.arch}/${process.versions.node}`);
  async function add(relative) {
    hash.update(relative); hash.update(await readFile(join(root, relative)));
  }
  async function walk(relative) {
    let entries;
    try { entries = await readdir(join(root, relative), { withFileTypes: true }); }
    catch (error) { if (error.code === "ENOENT") return; throw error; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(relative, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) await add(path);
    }
  }
  for (const directory of sourceDirectories) await walk(directory);
  for (const file of sourceFiles) {
    try { await add(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return hash.digest("hex");
}

async function artifactHash(root) {
  // A hosted build can overwrite dist; never mistake it for the local server.
  await readdir(join(root, "dist/client/assets"));
  return createHash("sha256").update(await readFile(join(root, "dist/server/index.js"))).digest("hex");
}

async function buildProduction(root) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [join(root, "scripts", "task-runner.mjs"), "build", "--standalone"], {
      cwd: root, env: { ...process.env, HORIZON_STANDALONE: "1" }, stdio: "inherit", shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`Local build exited with code ${code}.`)));
  });
}

export async function ensureLocalBuild(root, build = buildProduction) {
  const fingerprint = await sourceFingerprint(root);
  const stampPath = join(root, "dist/.horizon-local-build.json");
  try {
    const stamp = JSON.parse(await readFile(stampPath, "utf8"));
    if (stamp.fingerprint === fingerprint && stamp.artifact === await artifactHash(root)) {
      console.log("Horizon production build is ready.");
      return;
    }
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
  }
  console.log("Preparing Horizon for this release. The first build may take a minute.");
  await build(root);
  await writeFile(stampPath, JSON.stringify({ fingerprint, artifact: await artifactHash(root) }), "utf8");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await ensureLocalBuild(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
