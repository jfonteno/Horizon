"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RoomLobby from "../../components/network/RoomLobby";
import RoomStatus from "../../components/network/RoomStatus";
import {
  forgetRoomIdentity,
  loadRoomIdentity,
  pollRoom,
  resumeNetworkRoom,
} from "../../lib/room-client";
import type { RoomSession } from "../../../game/server/types";

const POLL_MS = 1500;

export default function NetworkRoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();

  const [session, setSession] = useState<RoomSession | null>(null);
  const [state, setState] = useState<
    "loading" | "connected" | "syncing" | "offline"
  >("loading");
  const [error, setError] = useState("");
  const revisionRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!code) return;
    const identity = loadRoomIdentity(code);
    if (!identity?.token) {
      setState("offline");
      setError(
        "This browser does not have a saved token for that room. Return to the launch screen and claim a seat.",
      );
      return;
    }

    setState("syncing");
    try {
      const next = await resumeNetworkRoom(code, identity.token);
      revisionRef.current = next.revision;
      setSession(next);
      setError("");
      setState("connected");
    } catch (cause) {
      setState("offline");
      setError(
        cause instanceof Error ? cause.message : "Unable to resume the room.",
      );
    }
  }, [code]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!session || state === "offline") return;

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const next = await pollRoom(
          session.code,
          session.token,
          revisionRef.current,
        );
        if (cancelled || !next) return;
        revisionRef.current = next.revision;
        setSession(next);
        setState("connected");
        setError("");
      } catch (cause) {
        if (cancelled) return;
        setState("offline");
        setError(
          cause instanceof Error ? cause.message : "Room synchronization failed.",
        );
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session?.code, session?.token, state]);

  const leaveView = () => {
    if (session) forgetRoomIdentity(session.code);
    router.push("/");
  };

  if (!session) {
    return (
      <main className="remote-room">
        <section className="remote-card">
          <img src="/horizon-logo.png" alt="Horizon" />
          <p>NETWORK PLAYTEST // ROOM {code || "UNKNOWN"}</p>
          <h1>{state === "loading" ? "Connecting…" : "Room unavailable"}</h1>
          {error && <p className="room-error">{error}</p>}
          <div className="remote-actions">
            <button className="primary" onClick={() => void refresh()}>
              Try again
            </button>
            <button onClick={() => router.push("/")}>
              Return to launch screen
            </button>
          </div>
        </section>
      </main>
    );
  }

  const player =
    session.playerId !== undefined
      ? session.game.players[session.playerId]
      : undefined;

  return (
    <main
      className="remote-room"
      data-theme={session.game.themeId}
      style={
        player
          ? ({ "--player": player.color } as React.CSSProperties)
          : undefined
      }
    >
      <section className="remote-card">
        <img src="/horizon-logo.png" alt="Horizon" />
        <p>PRIVATE NETWORK SEAT // ROOM {session.code}</p>
        <h1>{player?.name || "Horizon Network Room"}</h1>

        {error && <p className="room-error">{error}</p>}

        <RoomStatus
          session={session}
          connection={state === "loading" ? "syncing" : state}
        />

        <RoomLobby
          session={session}
          busy={state === "syncing"}
          onRefresh={() => void refresh()}
          onLeave={leaveView}
        />

        <small className="muted">
          This page establishes authenticated room synchronization. The next UI
          pass can mount the shared Horizon board and submit player commands
          through the server-authoritative command route.
        </small>
      </section>
    </main>
  );
}
