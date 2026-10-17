import assert from "node:assert/strict";
import test from "node:test";
import { createMapGestures } from "../app/lib/map-gestures";

function fixture() {
  const captured = new Set<number>();
  const frames = new Map<number, () => void>();
  let scale = 0.8, dragging = false, nextFrame = 0;
  const map = {
    scrollLeft: 100, scrollTop: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0 } as DOMRect),
    setPointerCapture: (id: number) => { captured.add(id); },
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => { captured.delete(id); },
  };
  const gestures = createMapGestures({ viewport: () => map, zoom: () => scale,
    setZoom: (value) => { scale = value; }, setDragging: (value) => { dragging = value; },
    minZoom: 0.4, maxZoom: 1.3,
    requestFrame: (callback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelFrame: (id) => { frames.delete(id); },
  });
  const pointer = (id: number, x: number, y = 100, type = "touch", target: unknown = {}) => ({
    pointerId: id, clientX: x, clientY: y, pointerType: type, target, button: 0, buttons: 1, preventDefault() {},
  });
  function click(detail = 1) {
    let blocked = false;
    gestures.onClickCapture({ detail, preventDefault: () => { blocked = true; }, stopPropagation() {} });
    return !blocked;
  }
  return { map, captured, gestures, pointer, click, frames,
    get scale() { return scale; }, get dragging() { return dragging; },
    flush: () => { for (const callback of frames.values()) callback(); frames.clear(); },
  };
}

for (const type of ["mouse", "touch", "pen"]) test(`${type} hex/unit taps keep their original click target`, () => {
  const f = fixture(), button = {};
  f.gestures.onPointerDown(f.pointer(1, 100, 100, type, button));
  assert.equal(f.captured.size, 0, "capturing a tap would retarget its native click");
  assert.equal(f.dragging, false);
  f.gestures.onPointerMove(f.pointer(1, 102, 101, type, button));
  f.gestures.onPointerUp(f.pointer(1, 102, 101, type, button));
  assert.equal(f.click(), true);
  assert.equal(f.map.scrollLeft, 100);
});

test("slow drag accumulates movement, captures only after slop, and suppresses only gesture clicks", () => {
  const f = fixture();
  f.gestures.onPointerDown(f.pointer(1, 100));
  for (let x = 101; x <= 105; x++) f.gestures.onPointerMove(f.pointer(1, x));
  assert.equal(f.captured.size, 0);
  f.gestures.onPointerMove(f.pointer(1, 106));
  assert.equal(f.captured.has(1), true);
  assert.equal(f.dragging, true);
  f.gestures.onPointerMove(f.pointer(1, 110));
  assert.equal(f.map.scrollLeft, 90);
  f.gestures.onPointerUp(f.pointer(1, 110));
  assert.equal(f.dragging, false);
  assert.equal(f.click(), false);
  assert.equal(f.click(0), true, "keyboard activation stays usable");
  f.gestures.onPointerDown(f.pointer(2, 100));
  f.gestures.onPointerUp(f.pointer(2, 100));
  assert.equal(f.click(), true, "the next deliberate tap selects normally");
});

test("pinch clamps zoom and preserves its final focal point after both pointers finish", () => {
  const f = fixture();
  f.gestures.onPointerDown(f.pointer(1, 100));
  f.gestures.onPointerDown(f.pointer(2, 200));
  f.gestures.onPointerMove(f.pointer(2, 300));
  assert.equal(f.scale, 1.3);
  f.gestures.onPointerUp(f.pointer(1, 100));
  f.gestures.onPointerUp(f.pointer(2, 300));
  f.flush();
  assert.equal(f.map.scrollLeft, 206.25);
  assert.equal(f.captured.size, 0);
  assert.equal(f.click(), false);
});

test("touch capture transfers from a child without cancelling the pan; unexpected loss cancels it", () => {
  const f = fixture(), child = {};
  f.gestures.onPointerDown(f.pointer(1, 100, 100, "touch", child));
  f.gestures.onPointerMove(f.pointer(1, 110));
  f.gestures.onLostPointerCapture(f.pointer(1, 110, 100, "touch", child));
  f.gestures.onPointerMove(f.pointer(1, 120));
  assert.equal(f.map.scrollLeft, 80);
  f.gestures.onLostPointerCapture(f.pointer(1, 120, 100, "touch", f.map));
  f.gestures.onPointerMove(f.pointer(1, 130));
  assert.equal(f.map.scrollLeft, 80);
  assert.equal(f.dragging, false);
});

test("pinch transitions into a one-finger pan and cancellation leaves the next tap usable", () => {
  const f = fixture();
  f.gestures.onPointerDown(f.pointer(1, 100));
  f.gestures.onPointerDown(f.pointer(2, 200));
  f.gestures.onPointerUp(f.pointer(2, 200));
  f.gestures.onPointerMove(f.pointer(1, 110));
  assert.equal(f.map.scrollLeft, 90);
  f.gestures.onPointerCancel(f.pointer(1, 110));
  assert.equal(f.captured.size, 0);
  f.gestures.onPointerDown(f.pointer(3, 100));
  f.gestures.onPointerUp(f.pointer(3, 100));
  assert.equal(f.click(), true);
});

test("unmount cancels pending pinch frames and releases capture", () => {
  const f = fixture();
  f.gestures.onPointerDown(f.pointer(1, 100));
  f.gestures.onPointerDown(f.pointer(2, 200));
  f.gestures.onPointerMove(f.pointer(2, 250));
  f.gestures.dispose();
  assert.equal(f.frames.size, 0);
  assert.equal(f.captured.size, 0);
});

test("a pending pinch anchor cannot overwrite the following one-finger pan", () => {
  const f = fixture();
  f.gestures.onPointerDown(f.pointer(1, 100));
  f.gestures.onPointerDown(f.pointer(2, 200));
  f.gestures.onPointerMove(f.pointer(2, 300));
  f.gestures.onPointerUp(f.pointer(2, 300));
  f.gestures.onPointerMove(f.pointer(1, 110));
  f.flush();
  assert.equal(f.map.scrollLeft, 196.25);
});

test("unexpected loss of a child's implicit capture does not strand a touch pointer", () => {
  const f = fixture(), child = {};
  f.gestures.onPointerDown(f.pointer(1, 100, 100, "touch", child));
  f.gestures.onLostPointerCapture(f.pointer(1, 100, 100, "touch", child));
  f.gestures.onPointerDown(f.pointer(2, 200));
  assert.equal(f.captured.size, 0, "the next tap must not become a phantom pinch");
  f.gestures.onPointerUp(f.pointer(2, 200));
  assert.equal(f.click(), true);
});
