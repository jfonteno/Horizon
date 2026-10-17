"use client";

import { useEffect, useState } from "react";
import type { RoomSession } from "../../../game/server/types";
import { totalTurns } from "../../../game";

function timerText(deadline: string | null, now: number) {
  if (!deadline) return null;
  const seconds = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function RoomStatus({
  session,
  connection = "connected",
}: {
  session: RoomSession;
  connection?: "connected" | "syncing" | "offline";
}) {
  const submitted = new Set(session.summary.seats.filter((seat) => seat.ordersSubmitted).map((seat) => seat.playerId));
  const phase = session.game.orderProtocol.phase;
  const playerId = session.playerId;
  const mySubmitted =
    playerId !== undefined ? submitted.has(playerId) : false;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!session.summary.turnDeadlineAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session.summary.turnDeadlineAt]);
  const countdown = timerText(session.summary.turnDeadlineAt, now);

  return (
    <section className="room-status">
      <div className="remote-status">
        <span>
          Era <b>{session.game.era}</b>
        </span>
        <span>
          Turn <b>{session.game.turn} / {totalTurns(session.game)}</b>
        </span>
        <span>
          Revision <b>{session.revision}</b>
        </span>
        <span>
          Phase <b>{session.summary.phase.replace("-", " ")}</b>
        </span>
        <span>
          Connection <b>{connection}</b>
        </span>
        {session.summary.turnTimerSeconds && <span className="turn-countdown">Turn timer <b>{countdown || (session.summary.status === "paused" ? "Paused" : "Waiting")}</b></span>}
      </div>

      {session.summary.status === "lobby" && <p>Players are claiming seats and confirming readiness.</p>}
      {session.summary.status === "paused" && <p>The host paused command processing. Public inspection remains available.</p>}
      {!!session.attention.length && <div className="attention-list"><b>Your return checklist</b>{session.attention.map((item) => <span key={item.id}>{item.title}: {item.detail}</span>)}</div>}

      {(phase === "negotiation" || phase === "orders") && (
        <>
          {session.summary.turnTimerSeconds && <p className="timer-rule">At expiration, any civilization without sealed Orders receives Hold and the server resolves the Turn.</p>}
          <p>
            {mySubmitted
              ? "Your Orders are sealed."
              : "You may negotiate, take immediate actions, and plan until you seal your Orders."}
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
