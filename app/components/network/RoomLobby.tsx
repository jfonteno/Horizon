"use client";

import type { RoomCommand } from "../../../game/server/command";
import type { RoomSession } from "../../../game/server/types";

export default function RoomLobby({
  session,
  onRefresh,
  onLeave,
  onCommand,
  busy = false,
}: {
  session: RoomSession;
  onRefresh?: () => void;
  onLeave?: () => void;
  onCommand?: (command: RoomCommand) => Promise<void>;
  busy?: boolean;
}) {
  const seats = session.summary.seats;
  const humanSeats = seats.filter((seat) => seat.controller?.kind !== "bot");
  const claimedHumans = humanSeats.filter((seat) => seat.claimed).length;
  const openHumans = humanSeats.length - claimedHumans;
  const mine = session.playerId === undefined ? undefined : seats[session.playerId];
  const host = session.role === "host";
  const allReady = humanSeats.every((seat) => seat.claimed && seat.ready);
  const copy = (value: string) => void navigator.clipboard?.writeText(value);

  return (
    <section className="room-lobby">
      <div className="room-heading">
        <div>
          <span>0.17.2 MULTIPLAYER BETA</span>
          <h2>Room {session.code}</h2>
        </div>
        <small>
          {claimedHumans}/{humanSeats.length} human seats claimed
          {openHumans ? ` · ${openHumans} open` : ""}
        </small>
      </div>

      <div className="room-code">
        <span>Invitation code</span>
        <strong>{session.code}</strong>
      </div>
      <div className="invite-links">
        <button onClick={() => copy(`${window.location.origin}/?join=${session.code}`)}>Copy player invitation</button>
        <button onClick={() => copy(`${window.location.origin}/room/${session.code}?spectate=1`)}>Copy spectator link</button>
      </div>

      <div className="room-seats">
        {seats.map((seat) => {
          const bot = seat.controller?.kind === "bot";
          const profileId =
            seat.controller?.kind === "bot" ? seat.controller.profileId : null;
          const mine = session.playerId === seat.playerId;

          return (
            <span
              key={seat.playerId}
              className={seat.claimed ? "claimed" : ""}
              aria-current={mine ? "true" : undefined}
            >
              <i>{seat.playerId + 1}</i>
              <b>
                {seat.civilization}
                {mine ? " · YOU" : ""}
              </b>
              <small>
                {bot
                  ? `AI · ${profileId}`
                  : `${seat.displayName || "Open human seat"}${seat.ready ? " · READY" : seat.claimed ? " · NOT READY" : ""}`}
              </small>
            </span>
          );
        })}
      </div>

      <div className="room-actions">
        {onCommand && session.summary.status === "lobby" && mine && (
          <button className={mine.ready ? "ready" : ""} disabled={busy} onClick={() => void onCommand({ kind: "setReady", ready: !mine.ready })}>
            {mine.ready ? "Set not ready" : "Mark ready"}
          </button>
        )}
        {onCommand && host && session.summary.status === "lobby" && (
          <button className="primary" disabled={busy || !allReady} onClick={() => void onCommand({ kind: "startGame" })}>Start game</button>
        )}
        {onCommand && host && session.summary.status === "active" && (
          <button disabled={busy} onClick={() => void onCommand({ kind: "pauseGame" })}>Pause game</button>
        )}
        {onCommand && host && session.summary.status === "paused" && (
          <button className="primary" disabled={busy} onClick={() => void onCommand({ kind: "resumeGame" })}>Resume game</button>
        )}
        {onCommand && host && ["active", "paused"].includes(session.summary.status) && (
          <button disabled={busy} onClick={() => void onCommand({ kind: "endGame" })}>End and archive</button>
        )}
        {onRefresh && (
          <button disabled={busy} onClick={onRefresh}>
            Refresh room
          </button>
        )}
        {onLeave && (
          <button disabled={busy} onClick={onLeave}>
            Leave view
          </button>
        )}
      </div>

      {host && onCommand && ["lobby", "paused"].includes(session.summary.status) && (
        <div className="bot-takeover-list">
          <h3>Host seat controls</h3>
          {seats.filter((seat) => seat.playerId !== session.playerId && seat.controller.kind === "human").map((seat) => (
            <div key={seat.playerId}>
              <span><b>{seat.civilization}</b><small>{seat.displayName || "Open seat"}</small></span>
              <button disabled={busy} onClick={() => void onCommand({ kind: "convertSeatToBot", playerId: seat.playerId, profileId: "strategic-director" })}>Assign Strategic Director</button>
            </div>
          ))}
        </div>
      )}

      {!!session.summary.recentEvents.length && <div className="room-event-list"><h3>Room history</h3>{[...session.summary.recentEvents].reverse().slice(0, 8).map((event) => <p key={event.id}><b>R{event.revision}</b>{event.message}</p>)}</div>}

      <small className="muted">
        Human players keep private seat tokens in their own browsers. Bot seats
        remain server-controlled and cannot be claimed.
      </small>
    </section>
  );
}
