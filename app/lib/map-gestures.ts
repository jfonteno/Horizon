type Point = { x: number; y: number };
type PointerInput = {
  pointerId: number; pointerType: string; button: number; buttons: number;
  clientX: number; clientY: number; target: unknown;
  preventDefault: () => void;
};
type Viewport = Pick<HTMLDivElement, "scrollLeft" | "scrollTop" | "getBoundingClientRect" | "setPointerCapture" | "releasePointerCapture" | "hasPointerCapture">;

// Preserve the original button target for taps; capture only a pan or pinch.
export function createMapGestures({ viewport, zoom, setZoom, setDragging, minZoom, maxZoom, requestFrame, cancelFrame }: {
  viewport: () => Viewport | null; zoom: () => number;
  setZoom: (value: number) => void; setDragging: (value: boolean) => void;
  minZoom: number; maxZoom: number;
  requestFrame: (callback: () => void) => number; cancelFrame: (id: number) => void;
}) {
  const points = new Map<number, Point>();
  let origin: Point | null = null;
  let previous: Point | null = null;
  let moved = false;
  let suppressClick = false;
  let frame: number | null = null;
  let pendingFrame: (() => void) | null = null;
  let pinch: { distance: number; zoom: number; worldX: number; worldY: number } | null = null;
  const midpoint = (values: Point[]) => ({ x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 });
  const distance = (values: Point[]) => Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  const capture = (map: Viewport) => { for (const id of points.keys()) if (!map.hasPointerCapture(id)) map.setPointerCapture(id); };

  function finishFrame() {
    if (!pendingFrame) return;
    if (frame !== null) cancelFrame(frame);
    const apply = pendingFrame;
    apply();
  }

  function startPinch(map: Viewport) {
    const active = [...points.values()], middle = midpoint(active), rect = map.getBoundingClientRect(), scale = zoom();
    pinch = { distance: Math.max(1, distance(active)), zoom: scale,
      worldX: (map.scrollLeft + middle.x - rect.left) / scale,
      worldY: (map.scrollTop + middle.y - rect.top) / scale };
    moved = suppressClick = true;
    setDragging(true);
    capture(map);
  }

  function finish(event: PointerInput) {
    if (!points.has(event.pointerId)) return;
    const map = viewport();
    points.delete(event.pointerId);
    // Delete first: releasing capture must not finish this pointer twice.
    if (map?.hasPointerCapture(event.pointerId)) map.releasePointerCapture(event.pointerId);
    const active = [...points.values()];
    pinch = null;
    previous = origin = active[0] || null;
    if (!active.length) setDragging(false);
  }

  return {
    onPointerDown(event: PointerInput) {
      if ((event.pointerType === "mouse" && event.button !== 0) || points.size >= 2) return;
      const map = viewport();
      if (!map) return;
      finishFrame();
      if (!points.size) moved = suppressClick = false;
      const point = { x: event.clientX, y: event.clientY };
      points.set(event.pointerId, point);
      if (points.size === 1) { origin = previous = point; pinch = null; }
      else startPinch(map);
    },
    onPointerMove(event: PointerInput) {
      if (!points.has(event.pointerId)) return;
      if (event.pointerType === "mouse" && !event.buttons) { finish(event); return; }
      const map = viewport();
      if (!map) return;
      const next = { x: event.clientX, y: event.clientY };
      points.set(event.pointerId, next);
      if (points.size === 2 && pinch) {
        event.preventDefault();
        const active = [...points.values()], middle = midpoint(active), rect = map.getBoundingClientRect();
        const anchor = pinch;
        const nextZoom = Math.max(minZoom, Math.min(maxZoom, anchor.zoom * distance(active) / anchor.distance));
        setZoom(nextZoom);
        if (frame !== null) cancelFrame(frame);
        pendingFrame = () => {
          frame = null;
          pendingFrame = null;
          // The last animation frame may run after the fingers are released.
          map.scrollLeft = anchor.worldX * nextZoom - (middle.x - rect.left);
          map.scrollTop = anchor.worldY * nextZoom - (middle.y - rect.top);
        };
        frame = requestFrame(pendingFrame);
      } else if (origin && previous) {
        if (!moved && Math.hypot(next.x - origin.x, next.y - origin.y) < 6) return;
        event.preventDefault();
        // Apply the last zoom anchor before continuing with one finger.
        finishFrame();
        if (!moved) { moved = suppressClick = true; setDragging(true); capture(map); }
        map.scrollLeft -= next.x - previous.x;
        map.scrollTop -= next.y - previous.y;
        previous = next;
      }
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture(event: PointerInput) {
      // Children lose implicit touch capture when a gesture takes over.
      const map = viewport();
      if (event.target === map || !map?.hasPointerCapture(event.pointerId)) finish(event);
    },
    onClickCapture(event: { detail: number; preventDefault: () => void; stopPropagation: () => void }) {
      if (!suppressClick || event.detail === 0) return;
      event.preventDefault(); event.stopPropagation();
    },
    dispose() {
      if (frame !== null) cancelFrame(frame);
      pendingFrame = null;
      const map = viewport();
      const ids = [...points.keys()]; points.clear();
      for (const id of ids) if (map?.hasPointerCapture(id)) map.releasePointerCapture(id);
    },
  };
}
