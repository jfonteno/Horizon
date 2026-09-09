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
  const pendingProposals = playerId === undefined ? 0 : session.game.proposals.filter((proposal) => proposal.status === "pending" && (proposal.kind === "technology" ? proposal.buyer === playerId : proposal.to === playerId)).length;
  const hiddenRequired = playerId !== undefined && (session.game.turn - 1) % 4 === 0 && !session.game.players[playerId].hiddenLegacy[session.game.era]?.selected;
  const captureRequired = session.game.pendingCenterLoss?.playerId === playerId;
  const redistributionRequired = playerId !== undefined && session.game.pendingCombatRedistributions.some((pending) => pending.playerId === playerId);
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
          Room <b>{session.summary.status}</b>
        </span>
        <span>
          Connection <b>{connection}</b>
        </span>
        {session.summary.turnTimerSeconds && <span className="turn-countdown">Turn timer <b>{countdown || (session.summary.status === "paused" ? "Paused" : "Waiting")}</b></span>}
      </div>

      {session.summary.status === "lobby" && <p>Players are claiming seats and confirming readiness.</p>}
      {session.summary.status === "paused" && <p>The host paused command processing. Public inspection remains available.</p>}
      {(pendingProposals > 0 || hiddenRequired || captureRequired || redistributionRequired) && <div className="attention-list"><b>Decisions requiring attention</b>{pendingProposals > 0 && <span>{pendingProposals} diplomatic proposal{pendingProposals === 1 ? "" : "s"} awaiting response</span>}{hiddenRequired && <span>Select this Era&apos;s Hidden Legacy before sealing Orders</span>}{captureRequired && <span>Resolve captured Center losses</span>}{redistributionRequired && <span>Redistribute surviving Combat Units in the Military panel</span>}</div>}

      {phase === "orders" && (
        <>
          {session.summary.turnTimerSeconds && <p className="timer-rule">At expiration, any civilization without sealed Orders receives Hold and the server resolves the Turn.</p>}
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
