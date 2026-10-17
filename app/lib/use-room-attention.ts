"use client";

import { useEffect, useState } from "react";
import type { RoomSession } from "../../game";

const ENABLED_KEY = "horizon-room-reminders-v1";

export function useRoomAttention(session: RoomSession) {
  const [enabled, setEnabled] = useState(() => typeof window !== "undefined" && "Notification" in window && localStorage.getItem(ENABLED_KEY) === "enabled" && Notification.permission === "granted");

  useEffect(() => {
    document.title = session.attention.length
      ? `(${session.attention.length}) Horizon · Room ${session.code}`
      : `Horizon · Room ${session.code}`;
    return () => { document.title = "Horizon: Shattered Reach"; };
  }, [session.attention.length, session.code]);

  useEffect(() => {
    if (!enabled || !session.attention.length) return;
    let preferences = { notifyTurns:true, notifyMessages:true, notifyProposals:true, notifyDeadlines:true };
    try { preferences = { ...preferences, ...JSON.parse(localStorage.getItem("horizon-settings-v1") || "{}") }; } catch { /* keep safe defaults */ }
    const key = `horizon-room-reminders-seen:${session.code}:${session.playerId ?? "spectator"}`;
    const seen = new Set<string>(JSON.parse(localStorage.getItem(key) || "[]") as string[]);
    const fresh = session.attention.filter((item) => !seen.has(item.id)).filter((item) => {
      if (item.kind === "message") return preferences.notifyMessages;
      if (item.kind === "proposal") return preferences.notifyProposals;
      if (item.kind === "timer") return preferences.notifyDeadlines;
      return preferences.notifyTurns;
    });
    localStorage.setItem(key, JSON.stringify(session.attention.map((item) => item.id)));
    if (!document.hidden || !fresh.length) return;
    const item = fresh[0];
    void navigator.serviceWorker?.ready.then((registration) => registration.showNotification(item.title, {
      body: item.detail,
      icon: "/icons/horizon-192.png",
      badge: "/icons/horizon-192.png",
      tag: `horizon-${session.code}-${item.id}`,
      data: { url: `/room/${session.code}` },
    }));
  }, [enabled, session.attention, session.code, session.playerId]);

  async function enable() {
    if (!("Notification" in window)) return false;
    const permission = await Notification.requestPermission();
    const allowed = permission === "granted";
    if (allowed) localStorage.setItem(ENABLED_KEY, "enabled");
    setEnabled(allowed);
    return allowed;
  }

  return { enabled, enable };
}
