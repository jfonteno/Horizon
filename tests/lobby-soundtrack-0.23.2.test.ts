import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("0.23.2 packages the complete lobby soundtrack", () => {
  for (const filename of ["into-the-verse.mp3", "fighting-for-the-skies.mp3", "the-spelljammer.mp3"]) {
    const url = new URL(`public/audio/lobby/${filename}`, root);
    assert.equal(existsSync(url), true, `${filename} should be packaged`);
    assert.ok(statSync(url).size > 1_000_000, `${filename} should contain audio data`);
  }
});

test("lobby soundtrack rotates tracks and handles autoplay restrictions", () => {
  const source = readFileSync(new URL("app/components/network/LobbySoundtrack.tsx", root), "utf8");
  assert.match(source, /onEnded=.*setTrackIndex/);
  assert.match(source, /Browser paused autoplay/);
  assert.match(source, /horizon-lobby-music-v1/);
  assert.match(source, /horizon-settings-v1/);
  assert.match(source, /audio\.volume = volume \/ 100/);
  assert.match(source, /audio\?\.pause\(\)/);

  const lobby = readFileSync(new URL("app/components/network/RoomLobby.tsx", root), "utf8");
  assert.match(lobby, /status === "lobby" && <LobbySoundtrack/);
});
