import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const read=path=>readFileSync(resolve(root,path));
const text=path=>read(path).toString("utf8");
const fail=message=>{throw new Error(`App readiness: ${message}`)};
const expect=(condition,message)=>{if(!condition)fail(message)};

const pkg=JSON.parse(text("package.json"));
const manifest=JSON.parse(text("public/manifest.webmanifest"));
expect(/^\d+\.\d+\.\d+$/.test(pkg.version),"package version must be semantic");
expect(manifest.id==="/"&&manifest.scope==="/","manifest id and scope must remain same-origin");
expect(manifest.display==="fullscreen","manifest must launch as a full-screen application");
expect(manifest.display_override?.[0]==="fullscreen"&&!manifest.display_override.includes("window-controls-overlay"),"desktop launch must prefer fullscreen without persistent window controls");
expect(manifest.start_url.startsWith("/"),"manifest start URL must be same-origin");
expect(Array.isArray(manifest.shortcuts)&&manifest.shortcuts.length>=3,"manifest must expose Create, Join, and Continue shortcuts");

const pngDimensions=path=>{
  const data=read(path);
  expect(data.subarray(1,4).toString()==="PNG",`${path} must be a PNG`);
  return [data.readUInt32BE(16),data.readUInt32BE(20)];
};
let hasLargeMaskable=false;
for(const icon of manifest.icons||[]){
  const path=`public${icon.src}`;
  expect(existsSync(resolve(root,path)),`${path} is missing`);
  const [width,height]=pngDimensions(path);
  const [declaredWidth,declaredHeight]=icon.sizes.split("x").map(Number);
  expect(width===declaredWidth&&height===declaredHeight,`${path} dimensions do not match its manifest declaration`);
  if(icon.purpose?.includes("maskable")&&width>=512&&height>=512)hasLargeMaskable=true;
}
expect(hasLargeMaskable,"a 512x512 maskable icon is required");

const worker=text("public/sw.js");
expect(worker.includes(`horizon-${pkg.version}`),"service-worker cache version must match package version");
expect(worker.includes('url.pathname.startsWith("/api/")')&&worker.includes('url.pathname.startsWith("/room/")'),"service worker must leave live APIs and rooms uncached");
expect(worker.includes("SKIP_WAITING")&&worker.includes("offline.html"),"service worker must support updates and offline startup");

const requiredFiles=[
  "public/offline.html",
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "docs/APP_DISTRIBUTION.md",
  `RELEASE_NOTES_${pkg.version}.md`,
];
for(const path of requiredFiles)expect(existsSync(resolve(root,path)),`${path} is missing`);

const liveVersionFiles=[
  "app/api/health/route.ts",
  "app/components/ApplicationShell.tsx",
  "app/components/MultiplayerRooms.tsx",
  "app/components/StartupScreen.tsx",
  "app/components/network/RoomLobby.tsx",
  "app/globals.css",
  "app/layout.tsx",
  "game/server/playtest-report.ts",
  "compose.yaml",
];
for(const path of liveVersionFiles)expect(text(path).includes(pkg.version),`${path} does not identify release ${pkg.version}`);

console.log(`Horizon ${pkg.version} app readiness validated: manifest, icons, offline lifecycle, legal routes, distribution notes, and live version markers.`);
