"use client";

import { useEffect, useRef, useState, type RefObject, type PointerEventHandler, type MouseEventHandler } from "react";
import { createMapGestures } from "./map-gestures";

export function useMapGestures({ viewportRef, zoom, setZoom, minZoom = 0.4, maxZoom = 1.3 }: {
  viewportRef: RefObject<HTMLDivElement | null>;
  zoom: number; setZoom: (zoom: number) => void; minZoom?: number; maxZoom?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const latest = useRef({ viewportRef, zoom, setZoom });
  useEffect(() => { latest.current = { viewportRef, zoom, setZoom }; }, [viewportRef, zoom, setZoom]);
  const gestures = useRef<ReturnType<typeof createMapGestures> | null>(null);
  useEffect(() => {
    const controller = createMapGestures({
      viewport: () => latest.current.viewportRef.current,
      zoom: () => latest.current.zoom,
      setZoom: (value) => latest.current.setZoom(value), setDragging, minZoom, maxZoom,
      requestFrame: (callback) => requestAnimationFrame(callback), cancelFrame: (id) => cancelAnimationFrame(id),
    });
    gestures.current = controller;
    return () => { controller.dispose(); gestures.current = null; };
  }, [minZoom, maxZoom]);
  const handlers: {
    onPointerDown: PointerEventHandler<HTMLDivElement>; onPointerMove: PointerEventHandler<HTMLDivElement>;
    onPointerUp: PointerEventHandler<HTMLDivElement>; onPointerCancel: PointerEventHandler<HTMLDivElement>;
    onLostPointerCapture: PointerEventHandler<HTMLDivElement>; onClickCapture: MouseEventHandler<HTMLDivElement>;
  } = {
    onPointerDown: (event) => gestures.current?.onPointerDown(event),
    onPointerMove: (event) => gestures.current?.onPointerMove(event),
    onPointerUp: (event) => gestures.current?.onPointerUp(event),
    onPointerCancel: (event) => gestures.current?.onPointerCancel(event),
    onLostPointerCapture: (event) => gestures.current?.onLostPointerCapture(event),
    onClickCapture: (event) => gestures.current?.onClickCapture(event),
  };
  return { dragging, handlers };
}
