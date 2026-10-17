"use client";

import { useEffect, useRef } from "react";

export default function InterfaceClick() {
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const clickHandler = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest("button, a, select, summary, [role='button']");
      if (!control || control.matches(":disabled") || control.closest(".gameplay-audio-control, .lobby-soundtrack")) return;
      let preferences: { soundMuted?: boolean; soundVolume?: number } = {};
      try { preferences = JSON.parse(localStorage.getItem("horizon-settings-v1") || "{}"); } catch { /* use defaults */ }
      if (preferences.soundMuted || !audio.current) return;
      audio.current.pause();
      audio.current.currentTime = 0;
      audio.current.volume = Math.max(0, Math.min(1, Number(preferences.soundVolume ?? 35) / 100));
      void audio.current.play().catch(() => undefined);
    };
    document.addEventListener("click", clickHandler, true);
    return () => document.removeEventListener("click", clickHandler, true);
  }, []);
  return <audio ref={audio} src="/audio/single-click.mp3" preload="auto" aria-hidden="true" />;
}
