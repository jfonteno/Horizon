"use client";

import type { RoomSession } from "../../../game/server/types";

export default function RoomLobby({
  session,
  onRefresh,
  onLeave,
  busy = false,
}: {
  session: RoomSession;
  onRefresh?: () => void;
  onLeave?: () => void;
  busy?: boolean;
}) {
  const seats = session.summary.seats;
  const humanSeats = seats.filter((seat) => seat.controller?.kind !== "bot");
  const claimedHumans = humanSeats.filter((seat) => seat.claimed).length;
  const openHumans = humanSeats.length - claimedHumans;

  return (
    <section className="room-lobby">
      <div className="room-heading">
        <div>
          <span>NETWORK PLAYTEST</span>
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
                  : seat.displayName || "Open human seat"}
              </small>
            </span>
          );
        })}
      </div>

      <div className="room-actions">
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

      <small className="muted">
        Human players keep private seat tokens in their own browsers. Bot seats
        remain server-controlled and cannot be claimed.
      </small>
    </section>
  );
}
