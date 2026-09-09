import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { startProdServer } from "vinext/server/prod-server";
import { installWindowsStaticAssetCompatibility } from "../game/server/windows-static-assets";

test("native Windows compatibility serves compiled assets before Vinext", async () => {
  const root = await mkdtemp(join(tmpdir(), "horizon-windows-assets-"));
  const client = join(root, "dist", "client");
  const assets = join(client, "assets");
  await mkdir(assets, { recursive: true });
  await writeFile(join(assets, "horizon-test.js"), "globalThis.horizonAssetLoaded = true;", "utf8");
  await writeFile(join(assets, "horizon-test.css"), ".horizon { display: grid; }", "utf8");

  const server = createServer((_request, response) => {
    response.writeHead(418, { "Content-Type": "text/plain" });
    response.end("downstream");
  });
  installWindowsStaticAssetCompatibility(server, client, true);
  await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;

  try {
    const script = await fetch(`${origin}/assets/horizon-test.js`);
    assert.equal(script.status, 200);
    assert.equal(script.headers.get("content-type"), "application/javascript; charset=utf-8");
    assert.equal(await script.text(), "globalThis.horizonAssetLoaded = true;");

    const stylesheet = await fetch(`${origin}/assets/horizon-test.css`);
    assert.equal(stylesheet.status, 200);
    assert.equal(stylesheet.headers.get("content-type"), "text/css; charset=utf-8");
    assert.equal(await stylesheet.text(), ".horizon { display: grid; }");

    const api = await fetch(`${origin}/api/health`);
    assert.equal(api.status, 418);
    assert.equal(await api.text(), "downstream");

    const traversal = await fetch(`${origin}/assets/%2e%2e/%2e%2e/package.json`);
    assert.equal(traversal.status, 418);
  } finally {
    await new Promise<void>((resolvePromise, reject) =>
      server.close((error) => error ? reject(error) : resolvePromise()),
    );
    await rm(root, { recursive: true, force: true });
  }
});

test("native Windows compatibility serves the standalone production build", async (context) => {
  if (!existsSync(resolve("dist/client/assets"))) {
    context.skip("standalone build is not present");
    return;
  }

  const { server, port } = await startProdServer({ port: 0, host: "127.0.0.1", outDir: "./dist" });
  installWindowsStaticAssetCompatibility(server, resolve("dist/client"), true);
  const origin = `http://127.0.0.1:${port}`;

  try {
    const home = await fetch(origin);
    assert.equal(home.status, 200);
    const html = await home.text();
    const stylesheet = html.match(/href="(\/assets\/[^"]+\.css)"/)?.[1];
    const scripts = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((match) => match[1]);
    assert.ok(stylesheet, "rendered page should reference a compiled stylesheet");
    assert.ok(scripts.length > 0, "rendered page should reference compiled JavaScript modules");

    const stylesheetResponse = await fetch(`${origin}${stylesheet}`);
    assert.equal(stylesheetResponse.status, 200);
    assert.match(stylesheetResponse.headers.get("content-type") || "", /^text\/css/);
    assert.ok((await stylesheetResponse.text()).length > 1_000);

    const scriptSizes = await Promise.all(scripts.map(async (script) => {
      const scriptResponse = await fetch(`${origin}${script}`);
      assert.equal(scriptResponse.status, 200, `${script} should be served`);
      assert.match(scriptResponse.headers.get("content-type") || "", /javascript/);
      return (await scriptResponse.text()).length;
    }));
    assert.ok(scriptSizes.some((size) => size > 1_000));
  } finally {
    await new Promise<void>((resolvePromise, reject) =>
      server.close((error) => error ? reject(error) : resolvePromise()),
    );
  }
});
