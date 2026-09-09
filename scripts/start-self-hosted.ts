import { startProdServer } from "vinext/server/prod-server";
import { resolve } from "node:path";
import { DiskRoomRepository } from "../game/server/disk-room-repository";
import { setRoomRepository } from "../game/server/runtime";
import { loadContentPacks } from "../game/content/node-loader";
import { setContentCatalog } from "../game/content/runtime";
import { installWindowsStaticAssetCompatibility } from "../game/server/windows-static-assets";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";
const dataDirectory = process.env.HORIZON_DATA_DIR || "./data/rooms";
const contentDirectory = process.env.HORIZON_CONTENT_DIR || "./data/content";

if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be an integer between 1 and 65535.");

const repository = new DiskRoomRepository(dataDirectory);
await repository.initialize();
const health = await repository.health();
if (!health.ok) throw new Error(`Horizon room storage is unavailable: ${health.detail}`);
setRoomRepository(repository);
const content = await loadContentPacks(contentDirectory);
setContentCatalog(content);
for (const issue of content.issues)
  console.warn(`[horizon] Content pack ${issue.pack || "unknown"} rejected: ${issue.message}`);

const { server } = await startProdServer({ port, host, outDir: "./dist" });
const windowsAssets = installWindowsStaticAssetCompatibility(server, resolve("./dist/client"));
console.log(`[horizon] Durable room storage ready (${repository.kind}).`);
console.log(`[horizon] ${content.packs.length} external content pack(s) active.`);
if (windowsAssets) console.log("[horizon] Native Windows static asset compatibility active.");

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  console.log(`[horizon] ${signal} received. Draining connections.`);
  const deadline = setTimeout(() => process.exit(1), 10_000);
  deadline.unref();
  server.close((error) => {
    clearTimeout(deadline);
    if (error) {
      console.error(error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
