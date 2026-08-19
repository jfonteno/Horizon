import { exec } from "node:child_process";

const url = "http://localhost:3000";
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

for (let attempt = 0; attempt < 120; attempt += 1) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    if (response.ok) {
      const command = process.platform === "win32"
        ? `start "" "${url}"`
        : process.platform === "darwin"
          ? `open "${url}"`
          : `xdg-open "${url}"`;
      exec(command);
      process.exit(0);
    }
  } catch {
    await wait(1000);
  }
}

console.error("Horizon did not become available within two minutes.");
process.exit(1);
