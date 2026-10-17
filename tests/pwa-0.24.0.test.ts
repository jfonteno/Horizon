import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root=new URL("../",import.meta.url);

test("0.28.0 has a valid fullscreen application manifest and icon set",()=>{
  const manifest=JSON.parse(readFileSync(new URL("public/manifest.webmanifest",root),"utf8"));
  assert.equal(manifest.display,"fullscreen");
  assert.equal(manifest.display_override[0],"fullscreen");
  assert.equal(manifest.display_override.includes("window-controls-overlay"),false);
  assert.equal(manifest.start_url,"/?source=installed-app");
  assert.ok(manifest.icons.some((icon:{sizes:string;purpose:string})=>icon.sizes==="512x512"&&icon.purpose==="maskable"));
  for(const icon of manifest.icons) assert.equal(existsSync(new URL(`public${icon.src}`,root)),true,`${icon.src} should exist`);
  assert.deepEqual(manifest.shortcuts.map((shortcut:{short_name:string})=>shortcut.short_name),["Create","Join","Continue"]);
});

test("service worker protects dynamic rooms while supporting offline startup and safe updates",()=>{
  const worker=readFileSync(new URL("public/sw.js",root),"utf8");
  assert.match(worker,/url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker,/url\.pathname\.startsWith\("\/room\/"\)/);
  assert.match(worker,/caches\.match\("\/offline\.html"\)/);
  assert.match(worker,/SKIP_WAITING/);
  assert.equal(existsSync(new URL("public/offline.html",root)),true);
});

test("application shell accepts installed-app shortcuts and invitation links",()=>{
  const source=readFileSync(new URL("app/components/ApplicationShell.tsx",root),"utf8");
  assert.match(source,/requested==="create"\|\|requested==="join"/);
  assert.match(source,/query\.get\("join"\)/);
  const layout=readFileSync(new URL("app/layout.tsx",root),"utf8");
  assert.match(layout,/manifest: "\/manifest\.webmanifest"/);
  assert.match(layout,/<PwaLifecycle/);
});

test("settings provide accessible display and soundtrack controls",()=>{
  const shell=readFileSync(new URL("app/components/ApplicationShell.tsx",root),"utf8");
  assert.match(shell,/highContrast/);
  assert.match(shell,/musicVolume/);
  assert.match(shell,/requestFullscreen/);
  assert.match(shell,/aria-label=\{name\} type="range"/);
  const layout=readFileSync(new URL("app/layout.tsx",root),"utf8");
  assert.match(layout,/className="skip-link"/);
  const css=readFileSync(new URL("app\/application-shell\.css",root),"utf8");
  assert.match(css,/data-contrast="high"/);
  assert.match(css,/button:focus-visible/);
});
