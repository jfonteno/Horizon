import { exec } from "node:child_process";

const localUrl = "http://127.0.0.1:3000";
const openUrl = process.env.HORIZON_OPEN_URL || localUrl;
const mode = process.argv[2] || "--wait-open";
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function healthIsReady() {
  try {
    const response = await fetch(`${localUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function visualAssetsAreReady() {
  try {
    const home = await fetch(localUrl, { signal: AbortSignal.timeout(2000) });
    if (!home.ok) return false;
    const html = await home.text();
    const stylesheet = html.match(/href="(\/assets\/[^"]+\.css)"/)?.[1];
    const script = html.match(/(?:src|href)="(\/assets\/[^"]+\.js)"/)?.[1];
    if (!stylesheet || !script) return false;
    const [stylesheetResponse, scriptResponse] = await Promise.all([
      fetch(`${localUrl}${stylesheet}`, { signal: AbortSignal.timeout(2000) }),
      fetch(`${localUrl}${script}`, { signal: AbortSignal.timeout(2000) }),
    ]);
    return stylesheetResponse.ok
      && scriptResponse.ok
      && (stylesheetResponse.headers.get("content-type") || "").startsWith("text/css")
      && (scriptResponse.headers.get("content-type") || "").includes("javascript");
  } catch {
    return false;
  }
}

if (mode === "--health-once") process.exit(await healthIsReady() ? 0 : 1);
if (mode === "--check-once") process.exit(await healthIsReady() && await visualAssetsAreReady() ? 0 : 1);

for (let attempt = 0; attempt < 120; attempt += 1) {
  if (await healthIsReady() && await visualAssetsAreReady()) {
    const command = process.platform === "win32"
      ? `start "" "${openUrl}"`
      : process.platform === "darwin"
        ? `open "${openUrl}"`
        : `xdg-open "${openUrl}"`;
    exec(command);
    process.exit(0);
  }
  await wait(1000);
}

console.error("Horizon or its compiled visual assets did not become available within two minutes.");
process.exit(1);
