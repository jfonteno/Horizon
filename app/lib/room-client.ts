"use client";

import type { RoomCommand } from "../../game/server/command";
import type { RoomIdentity, RoomMode, RoomSession } from "../../game/server/types";
import type { GameState } from "../../game/types";

const ROOM_STORAGE_PREFIX = "horizon-network-room-v1:";

type RoomApiErrorPayload = { error?: string; message?: string };

type RoomCreateRequest = {
  action: "create";
  game: GameState;
  displayName: string;
  mode: RoomMode;
};

type RoomJoinRequest = {
  action: "join";
  code: string;
  playerId: number;
  displayName: string;
};

type RoomResumeRequest = {
  action: "resume";
  code: string;
  token: string;
};

export class RoomClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly staleRevision = false,
  ) {
    super(message);
    this.name = "RoomClientError";
  }
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

async function readPayload<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & RoomApiErrorPayload;
  if (!response.ok) {
    const message =
      payload.error ||
      payload.message ||
      `Room request failed with status ${response.status}.`;
    throw new RoomClientError(message, response.status, response.status === 409);
  }
  return payload;
}

async function roomRequest(
  body: RoomCreateRequest | RoomJoinRequest | RoomResumeRequest,
): Promise<RoomSession> {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return readPayload<RoomSession>(response);
}

export function roomIdentityFromSession(session: RoomSession): RoomIdentity {
  return {
    code: session.code,
    token: session.token,
    role: session.role,
    playerId: session.playerId,
    revision: session.revision,
  };
}

export function saveRoomIdentity(session: RoomSession) {
  if (typeof window === "undefined") return;
  const identity = roomIdentityFromSession(session);
  window.localStorage.setItem(
    `${ROOM_STORAGE_PREFIX}${normalizeCode(session.code)}`,
    JSON.stringify(identity),
  );
}

export function loadRoomIdentity(code: string): RoomIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      `${ROOM_STORAGE_PREFIX}${normalizeCode(code)}`,
    );
    return raw ? (JSON.parse(raw) as RoomIdentity) : null;
  } catch {
    return null;
  }
}

export function forgetRoomIdentity(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${ROOM_STORAGE_PREFIX}${normalizeCode(code)}`);
}

export async function createNetworkRoom(
  game: GameState,
  displayName: string,
): Promise<RoomSession> {
  const session = await roomRequest({
    action: "create",
    game,
    displayName,
    mode: "network",
  });
  saveRoomIdentity(session);
  return session;
}

export async function joinNetworkRoom(
  code: string,
  playerId: number,
  displayName: string,
): Promise<RoomSession> {
  const session = await roomRequest({
    action: "join",
    code: normalizeCode(code),
    playerId,
    displayName,
  });
  saveRoomIdentity(session);
  return session;
}

export async function resumeNetworkRoom(
  code: string,
  token?: string,
): Promise<RoomSession> {
  const normalized = normalizeCode(code);
  const remembered = loadRoomIdentity(normalized);
  const resumeToken = token || remembered?.token;
  if (!resumeToken) throw new Error("No saved room token is available.");

  const session = await roomRequest({
    action: "resume",
    code: normalized,
    token: resumeToken,
  });
  saveRoomIdentity(session);
  return session;
}

export async function sendRoomCommand(
  session: Pick<RoomSession, "code" | "token" | "revision">,
  command: RoomCommand,
): Promise<RoomSession> {
  const response = await fetch(
    `/api/rooms/${encodeURIComponent(normalizeCode(session.code))}/command`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: session.token,
        expectedRevision: session.revision,
        command,
      }),
      cache: "no-store",
    },
  );

  const result = await readPayload<{
    ok: boolean;
    message: string;
    session?: RoomSession;
  }>(response);

  if (!result.ok || !result.session)
    throw new RoomClientError(
      result.message || "The room command was not accepted.",
      400,
    );

  saveRoomIdentity(result.session);
  return result.session;
}

export async function pollRoom(
  code: string,
  token: string,
  knownRevision: number,
): Promise<RoomSession | null> {
  const next = await resumeNetworkRoom(code, token);
  return next.revision === knownRevision ? null : next;
}

export async function sendRoomCommandWithRefresh(
  session: RoomSession,
  command: RoomCommand,
): Promise<RoomSession> {
  try {
    return await sendRoomCommand(session, command);
  } catch (error) {
    if (!(error instanceof RoomClientError) || !error.staleRevision) throw error;
    const refreshed = await resumeNetworkRoom(session.code, session.token);
    return sendRoomCommand(refreshed, command);
  }
}
