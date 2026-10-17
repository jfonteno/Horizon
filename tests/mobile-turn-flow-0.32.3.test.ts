import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("turn briefing keeps its continuation action outside the scrollable event history", async () => {
  const [summary, styles] = await Promise.all([
    readFile(new URL("../app/components/TurnResolutionSummary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(summary, /className="resolution-content"/);
  assert.match(summary, /<footer className="resolution-actions">/);
  assert.ok(summary.indexOf("resolution-content") < summary.indexOf("resolution-actions"));
  assert.match(styles, /\.resolution-overlay\{z-index:160;overflow:hidden\}/);
  assert.match(styles, /\.resolution-card\{[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/);
  assert.match(styles, /\.resolution-content\{[^}]*overflow-y:auto/);
  assert.match(styles, /height:100dvh;max-height:100dvh/);
});

test("mandatory Hidden Legacy selection can reach its final choice on mobile", async () => {
  const styles = await readFile(new URL("../app/multiplayer.css", import.meta.url), "utf8");
  assert.match(styles, /\.hidden-required-overlay\{display:block;height:100dvh;padding:0\}/);
  assert.match(styles, /\.hidden-required-card\{[^}]*min-height:100dvh[^}]*env\(safe-area-inset-bottom\)/);
});

test("Orders presents review and sealing before optional diagnostics", async () => {
  const board = await readFile(new URL("../app/components/network/NetworkGameBoard.tsx", import.meta.url), "utf8");
  const seal = board.indexOf('orders-seal-button orders-seal-top');
  const review = board.indexOf('className="network-order-list"');
  const checklist = board.indexOf('className="seal-checklist"', review);
  assert.ok(seal >= 0 && seal < review, "review action must be at the top of Orders");
  assert.ok(review < checklist, "optional checklist must appear after the queue");
  assert.match(board, /className="seal-review-list"[\s\S]*Confirm and seal Orders/);
  assert.match(board, /await onCommand\(command\);\s*setSealReviewOpen\(false\);\s*setPanel\("map"\);\s*setDockOpen\(false\)/);
});
