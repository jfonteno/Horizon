import { mkdir, readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtime = join(root, ".sites-runtime");
const task = process.argv[2];
const standalone = process.argv.includes("--standalone") || process.env.HORIZON_STANDALONE === "1";

await Promise.all(["npm-cache", "xdg-config", "tmp", "wrangler/logs"].map((part) => mkdir(join(runtime, part), { recursive: true })));

const env = {
  ...process.env,
  SITES_ENV_READY: "1",
  SITES_PROJECT_ROOT: root,
  XDG_CONFIG_HOME: join(runtime, "xdg-config"),
  TMPDIR: join(runtime, "tmp"),
  TEMP: join(runtime, "tmp"),
  TMP: join(runtime, "tmp"),
  WRANGLER_WRITE_LOGS: "false",
  WRANGLER_LOG_PATH: join(runtime, "wrangler/logs"),
  MINIFLARE_REGISTRY_PATH: join(runtime, "wrangler/registry"),
  npm_config_cache: join(runtime, "npm-cache"),
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_update_notifier: "false",
};

// Launch package CLIs through Node directly. Windows cmd.exe splits paths that
// contain spaces or parentheses when spawn() uses shell:true.
function bin(name) {
  const scripts = { vinext: "vinext/dist/cli.js", eslint: "eslint/bin/eslint.js", tsc: "typescript/bin/tsc" };
  if (!scripts[name]) throw new Error(`Unknown build tool: ${name}`);
  return join(root, "node_modules", scripts[name]);
}

async function run(command, args, options = {}) {
  const timeoutMs = options.timeoutMs || 0;
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, env: { ...env, ...options.env }, stdio: "inherit", shell: false });
    const timer = timeoutMs ? setTimeout(() => child.kill("SIGTERM"), timeoutMs) : null;
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with ${signal || `code ${code}`}.`));
    });
  });
}

async function validateArtifact() {
  const workerPath = join(root, "dist/server/index.js");
  const hostingPath = join(root, "dist/.openai/hosting.json");
  JSON.parse(await readFile(hostingPath, "utf8"));
  const workerUrl = pathToFileURL(workerPath);
  workerUrl.searchParams.set("horizon-validation", `${process.pid}-${Date.now()}`);
  const worker = await import(workerUrl.href);
  if (!worker.default || typeof worker.default.fetch !== "function")
    throw new Error("dist/server/index.js must export a default Worker with fetch().");
}

async function build(useStandalone = standalone) {
  await run(process.execPath, [bin("vinext"), "build"], {
    timeoutMs: Number(process.env.SITES_BUILD_TIMEOUT_MS || 180_000),
    env: useStandalone ? { HORIZON_STANDALONE: "1" } : {},
  });
  if (!useStandalone) await validateArtifact();
}

try {
  if (task === "build") await build();
  else if (task === "lint") await run(process.execPath, [bin("eslint"), ".", "--ignore-pattern", "dist", "--ignore-pattern", ".next"]);
  else if (task === "typecheck") await run(process.execPath, [bin("tsc"), "--noEmit", "--pretty", "false"]);
  else if (task === "test") {
    await build(true);
    const tests = (await readdir(join(root, "tests"))).filter((name) => name.endsWith(".test.ts")).map((name) => join("tests", name));
    // Run each file directly so node:test registers through tsx consistently
    // across supported Node versions, while keeping file-level process isolation.
    for (let offset = 0; offset < tests.length; offset += 4)
      await Promise.all(tests.slice(offset, offset + 4).map((file) =>
        run(process.execPath, ["--import", "tsx", file], { env: { HORIZON_STANDALONE: "1" } })));
  } else if (task === "validate-artifact") await validateArtifact();
  else throw new Error("Usage: node scripts/task-runner.mjs <build|lint|typecheck|test|validate-artifact> [--standalone]");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
