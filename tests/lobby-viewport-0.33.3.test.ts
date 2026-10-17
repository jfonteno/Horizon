import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("0.33.4 opens the faction lobby at its reachable top edge", async () => {
  const [board, shellCss] = await Promise.all([
    readFile(new URL("../app/components/network/NetworkGameBoard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/application-shell.css", import.meta.url), "utf8"),
  ]);
  assert.match(board, /useLayoutEffect/);
  assert.match(board, /overlay\.scrollTop = 0/);
  assert.match(board, /requestAnimationFrame\(resetLobbyScroll\)/);
  assert.match(board, /session\.code, session\.summary\.status/);
  assert.match(shellCss, /\.handoff-overlay\.beta-room-overlay\{display:block!important;place-items:initial!important;align-items:initial!important;justify-items:initial!important;height:100dvh!important;max-height:100dvh!important/);
});

test("0.33.4 keeps every radial seat inside desktop and mobile stage bounds", async () => {
  const css = await readFile(new URL("../app/multiplayer.css", import.meta.url), "utf8");
  assert.match(css, /left:clamp\(100px,var\(--seat-x\),calc\(100% - 100px\)\)/);
  assert.match(css, /top:clamp\(105px,var\(--seat-y\),calc\(100% - 105px\)\)/);
  assert.match(css, /left:clamp\(61px,var\(--seat-x\),calc\(100% - 61px\)\)/);
  assert.match(css, /top:clamp\(78px,var\(--seat-y\),calc\(100% - 78px\)\)/);
  assert.match(css, /\.lobby-seat-stage\{position:relative;height:clamp\(360px,calc\(100dvh - 250px\),640px\);min-height:0/);
  assert.match(css, /@media\(max-width:800px\)\{\.lobby-seat-stage\{height:clamp\(400px,calc\(100dvh - 220px\),520px\);min-height:0/);
});

test("vertical lobby seats place their controls away from the central hub", async () => {
  const [lobby, css] = await Promise.all([
    readFile(new URL("../app/components/network/RoomLobby.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/multiplayer.css", import.meta.url), "utf8"),
  ]);
  assert.match(lobby, /data-seat-zone=\{seatZone\}/);
  assert.match(lobby, /Math\.sin\(angle\)<-0\.8\?"top":Math\.sin\(angle\)>0\.8\?"bottom":"side"/);
  assert.match(css, /article\[data-seat-zone="top"\] \.seat-control-box\{order:-5\}/);
  assert.match(css, /article\[data-seat-zone="top"\] \.seat-orb\{order:-1\}/);
  assert.match(css, /article\[data-seat-zone="bottom"\] \.seat-orb\{order:-5\}/);
  assert.match(css, /article\[data-seat-zone="bottom"\] \.seat-control-box\{order:-1\}/);
});
