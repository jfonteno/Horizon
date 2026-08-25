import { resolve } from "node:path";
import { loadContentPacks } from "../game/content/node-loader";

const target = resolve(process.argv[2] || "./data/content");
const catalog = await loadContentPacks(target);
for (const pack of catalog.packs)
  console.log(`VALID ${pack.id}@${pack.version}: ${pack.maps.length} map(s), ${pack.factions.length} faction(s)`);
for (const issue of catalog.issues)
  console.error(`INVALID ${issue.pack || "unknown"}: ${issue.message}`);
if (catalog.issues.length) process.exitCode = 1;
else console.log(`${catalog.packs.length} content pack(s) validated.`);
