"use client";

import type { RoomSession } from "../../../game/server/types";

function submissionIds(session: RoomSession) {
  return new Set(
    session.game.orderProtocol.submissions.map(
      (submission) => submission.playerId,
    ),
  );
}

export default function RoomStatus({
  session,
  connection = "connected",
}: {
  session: RoomSession;
  connection?: "connected" | "syncing" | "offline";
}) {
  const submitted = submissionIds(session);
  const phase = session.game.orderProtocol.phase;
  const playerId = session.playerId;
  const mySubmitted =
    playerId !== undefined ? submitted.has(playerId) : false;

  return (
    <section className="room-status">
      <div className="remote-status">
        <span>
          Era <b>{session.game.era}</b>
        </span>
        <span>
          Turn <b>{session.game.turn} / 16</b>
        </span>
        <span>
          Revision <b>{session.revision}</b>
        </span>
        <span>
          Connection <b>{connection}</b>
        </span>
      </div>

      {phase === "orders" && (
        <>
          <p>
            {mySubmitted
              ? "Your Orders are sealed."
              : "You may continue planning until you seal your Orders."}
          </p>
          <div className="room-seats">
            {session.summary.seats.map((seat) => {
              const bot = seat.controller?.kind === "bot";
              const done = submitted.has(seat.playerId);
              return (
                <span key={seat.playerId} className={done ? "claimed" : ""}>
                  <i>{seat.playerId + 1}</i>
                  <b>{seat.civilization}</b>
                  <small>
                    {done
                      ? "Orders sealed"
                      : bot
                        ? "AI awaiting server turn"
                        : "Planning"}
                  </small>
                </span>
              );
            })}
          </div>
        </>
      )}

      {phase === "ready" && (
        <p>All required Orders are sealed. The server is resolving the Turn.</p>
      )}

      {phase === "resolved" && (
        <p>The Turn has resolved. Waiting for the next authoritative update.</p>
      )}

      {session.game.result && <p>{session.game.result.reason}</p>}
    </section>
  );
}
