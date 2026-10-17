import type { RoomCommand } from "./command";
import { roomCommandLabel } from "./command";
import { normalizeStoredRoom } from "./rooms";
import type { RoomAuditEntry, StoredRoom } from "./types";

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().filter((key) => object[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

export async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : canonical(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function auditState(room: StoredRoom) {
  // Disk and memory repositories normalize before persisting. Hash precisely
  // that representation, including defaults added by save migrations.
  room = normalizeStoredRoom(structuredClone(room));
  return {
    code: room.code,
    status: room.status,
    revision: room.revision,
    game: room.game,
    seats: room.seats.map((seat) => ({
      playerId: seat.playerId,
      controller: seat.controller,
      displayName: seat.displayName,
      joinedAt: seat.joinedAt,
      ready: seat.ready,
    })),
  };
}

export function hashRoomAuditState(room: StoredRoom) {
  return sha256(auditState(room));
}

export async function initializeRoomAudit(room: StoredRoom) {
  room.auditStartRevision = room.revision;
  room.initialStateHash = await hashRoomAuditState(room);
  room.audit = [];
}

export async function appendRoomAudit(
  room: StoredRoom,
  playerId: number,
  commandId: string,
  command: RoomCommand,
) {
  const prior = room.audit.at(-1);
  const stateHash = await hashRoomAuditState(room);
  const entryBase = {
    sequence: room.audit.length + 1,
    commandId,
    playerId,
    commandKind: command.kind,
    commandLabel: roomCommandLabel(command),
    command: structuredClone(command),
    acceptedAt: room.updatedAt,
    revision: room.revision,
    previousHash: prior?.entryHash || room.initialStateHash || "legacy-room",
    stateHash,
  };
  const entry: RoomAuditEntry = {
    ...entryBase,
    entryHash: await sha256(entryBase),
  };
  room.audit.push(entry);
  room.audit = room.audit.slice(-1000);
  return entry;
}

export async function appendSystemAudit(
  room: StoredRoom,
  commandId: string,
  commandKind: string,
  commandLabel: string,
  command: unknown,
) {
  const prior = room.audit.at(-1);
  const stateHash = await hashRoomAuditState(room);
  const entryBase = {
    sequence: room.audit.length + 1,
    commandId,
    playerId: -1,
    commandKind,
    commandLabel,
    command: structuredClone(command),
    acceptedAt: room.updatedAt,
    revision: room.revision,
    previousHash: prior?.entryHash || room.initialStateHash || "legacy-room",
    stateHash,
  };
  const entry: RoomAuditEntry = { ...entryBase, entryHash: await sha256(entryBase) };
  room.audit.push(entry);
  room.audit = room.audit.slice(-1000);
  return entry;
}

export async function verifyRoomAudit(room: StoredRoom) {
  if (!room.initialStateHash || room.auditStartRevision === undefined) {
    return { ok: false, complete: false, checked: 0, message: "This room predates the 0.18.0 audit ledger." };
  }
  let previousHash = room.initialStateHash;
  for (const entry of room.audit) {
    const { entryHash, ...base } = entry;
    const expected = await sha256(base);
    if (entry.previousHash !== previousHash || entryHash !== expected) {
      return { ok: false, complete: true, checked: entry.sequence - 1, message: `Audit verification failed at entry ${entry.sequence}.` };
    }
    previousHash = entryHash;
  }
  const finalStateMatches = room.audit.length === 0
    ? (await hashRoomAuditState(room)) === room.initialStateHash
    : room.audit.at(-1)!.stateHash === await hashRoomAuditState(room);
  return {
    ok: finalStateMatches,
    complete: true,
    checked: room.audit.length,
    message: finalStateMatches ? `${room.audit.length} accepted command${room.audit.length === 1 ? "" : "s"} verified.` : "The current room state does not match the final audit entry.",
  };
}
