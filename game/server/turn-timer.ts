import { redistributeCombatUnits, removeCapturedCenter } from "../rules/fleet";
import { beginSecretOrders, resolveSecretOrders } from "../rules/orders";
import { appendSystemAudit } from "./audit";
import { runPendingBotSeats } from "./bot-seats";
import type { RoomRepository, StoredRoom } from "./types";

export function clearTurnDeadline(room: StoredRoom) {
  room.turnDeadlineAt = null;
  room.turnTimerPausedRemainingMs = null;
}

export function startTurnDeadline(room: StoredRoom, nowMs = Date.now()) {
  if (room.status !== "active" || !room.turnTimerSeconds || room.game.result || room.game.pendingCenterLoss) {
    room.turnDeadlineAt = null;
    return;
  }
  room.turnDeadlineAt = new Date(nowMs + room.turnTimerSeconds * 1000).toISOString();
  room.turnTimerPausedRemainingMs = null;
}

export function pauseTurnDeadline(room: StoredRoom, nowMs = Date.now()) {
  room.turnTimerPausedRemainingMs = room.turnDeadlineAt
    ? Math.max(0, Date.parse(room.turnDeadlineAt) - nowMs)
    : null;
  room.turnDeadlineAt = null;
}

export function resumeTurnDeadline(room: StoredRoom, nowMs = Date.now()) {
  if (!room.turnTimerSeconds || room.game.result || room.game.pendingCenterLoss) {
    clearTurnDeadline(room);
    return;
  }
  const remaining = room.turnTimerPausedRemainingMs;
  room.turnDeadlineAt = new Date(nowMs + (remaining === null ? room.turnTimerSeconds * 1000 : Math.max(1000, remaining))).toISOString();
  room.turnTimerPausedRemainingMs = null;
}

function addAutomaticHolds(room: StoredRoom, now: string) {
  const missing = room.game.players.filter((player) =>
    !room.game.orderProtocol.submissions.some((submission) => submission.playerId === player.id),
  );
  for (const player of missing) {
    room.game.orderProtocol.submissions.push({
      playerId: player.id,
      turn: room.game.turn,
      sealedAt: now,
      orders: [{ id: `timer-hold-${room.game.turn}-${player.id}`, kind: "hold", label: "Automatic Hold: Turn timer expired" }],
    });
  }
  room.game.orderProtocol.phase = "ready";
  return missing.map((player) => player.id);
}

export async function reconcileExpiredTurnTimer(
  repository: RoomRepository,
  code: string,
  nowMs = Date.now(),
): Promise<boolean> {
  const room = await repository.get(code);
  if (!room || room.status !== "active" || !room.turnTimerSeconds || !room.turnDeadlineAt || room.game.result)
    return false;
  if (Date.parse(room.turnDeadlineAt) > nowMs)
    return false;
  if (room.game.orderProtocol.phase === "negotiation") beginSecretOrders(room.game);
  if (room.game.orderProtocol.phase !== "orders") return false;

  const expectedRevision = room.revision;
  const now = new Date(nowMs).toISOString();
  runPendingBotSeats(room.game);
  const heldPlayerIds = addAutomaticHolds(room, now);
  const resolution = resolveSecretOrders(room.game);
  if (!resolution.ok) throw new Error(`Turn timer resolution failed: ${resolution.message}`);
  while (room.game.pendingCenterLoss && room.game.players[room.game.pendingCenterLoss.playerId].controller.kind === "bot") {
    const result = removeCapturedCenter(room.game, room.game.pendingCenterLoss.playerId, 0);
    if (!result.ok) throw new Error(`Bot capture bookkeeping failed: ${result.message}`);
  }
  for (const pending of [...room.game.pendingCombatRedistributions]) {
    if (room.game.players[pending.playerId].controller.kind !== "bot") continue;
    const assignments = pending.carrierIds.map((carrierId) => ({ carrierId, cu: room.game.carriers.find((carrier) => carrier.id === carrierId)?.cu || 1 }));
    const allocated = assignments.reduce((sum, assignment) => sum + assignment.cu, 0);
    redistributeCombatUnits(room.game, pending.playerId, pending.hexId, assignments, pending.allowStationed ? pending.total - allocated : 0);
  }

  room.revision++;
  room.status = room.game.result ? "complete" : "active";
  room.updatedAt = now;
  const heldNames = heldPlayerIds.map((id) => room.game.players[id]?.name || `Seat ${id + 1}`);
  room.events.push({
    id: `turn-timer-${room.revision}`,
    at: now,
    revision: room.revision,
    type: "phase",
    message: heldNames.length
      ? `Turn timer expired. Automatic Hold was issued for ${heldNames.join(", ")}, then all sealed Orders resolved.`
      : "Turn timer expired and all sealed Orders resolved.",
  });
  room.events = room.events.slice(-200);
  if (room.game.result) clearTurnDeadline(room);
  else startTurnDeadline(room, nowMs);
  await appendSystemAudit(room, `timer-${room.revision}-${nowMs}`, "turnTimerExpired", "Resolve expired Turn timer", { kind: "turnTimerExpired", heldPlayerIds });
  return repository.compareAndSwap(room, expectedRevision);
}
