"use client";

import type { RoomCommand } from "../../game/server/command";
import type { RoomIdentity, RoomMode, RoomSession } from "../../game/server/types";
import type { GameState } from "../../game/types";
import { loadAccountToken } from "./account-client";

const ROOM_STORAGE_PREFIX = "horizon-network-room-v1:";
let createdRoom: { session: RoomSession; at: number } | undefined;

/** One-use handoff during client navigation; never persist private game state. */
export function takeCreatedRoom(code: string): RoomSession | null {
  if (!createdRoom || normalizeCode(code) !== createdRoom.session.code) return null;
  const cached = createdRoom;
  createdRoom = undefined;
  const identity = loadRoomIdentity(code);
  if (Date.now() - cached.at > 60_000 || identity?.token !== cached.session.token || identity.revision > cached.session.revision) return null;
  return cached.session;
}

type RoomApiErrorPayload = { error?: string; message?: string };

type RoomCreateRequest = {
  action: "create";
  game: GameState;
  displayName: string;
  roomName?: string;
  mode: RoomMode;
  autoStartWhenReady?: boolean;
  accountToken?: string;
};

type RoomJoinRequest = {
  action: "join";
  code: string;
  playerId: number;
  displayName: string;
  accountToken?: string;
};

type RoomResumeRequest = {
  action: "resume";
  code: string;
  token: string;
};

type RoomAccountResumeRequest = { action:"resumeAccount";code:string;accountToken?:string };
type RoomRematchRequest = { action:"rematch";code:string;token:string;accountToken?:string };

type RoomSpectateRequest = { action: "spectate"; code: string };

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
  body: RoomCreateRequest | RoomJoinRequest | RoomResumeRequest | RoomAccountResumeRequest | RoomRematchRequest | RoomSpectateRequest,
): Promise<RoomSession> {
  const accountToken=loadAccountToken();
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json", ...(accountToken?{"authorization":`Bearer ${accountToken}`}:{}) },
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
  const previous = loadRoomIdentity(session.code);
  if (previous && previous.revision > identity.revision) return;
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
  autoStartWhenReady = false,
  roomName = "",
): Promise<RoomSession> {
  const session = await roomRequest({
    action: "create",
    game,
    displayName,
    roomName,
    mode: "network",
    autoStartWhenReady,
    accountToken: loadAccountToken() || undefined,
  });
  saveRoomIdentity(session);
  createdRoom = { session, at: Date.now() };
  return session;
}

export async function createLocalRoom(
  game: GameState,
  displayName = "Local Commander",
): Promise<RoomSession> {
  const session = await roomRequest({
    action: "create",
    game,
    displayName,
    mode: "local",
    accountToken: loadAccountToken() || undefined,
  });
  saveRoomIdentity(session);
  window.localStorage.setItem("horizon-room-identity-v1", JSON.stringify(roomIdentityFromSession(session)));
  createdRoom = { session, at: Date.now() };
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
    accountToken: loadAccountToken() || undefined,
  });
  saveRoomIdentity(session);
  return session;
}

export async function recoverNetworkRoom(code:string):Promise<RoomSession> {
  const accountToken=loadAccountToken();
  const session=await roomRequest({action:"resumeAccount",code:normalizeCode(code),...(accountToken?{accountToken}:{})});
  saveRoomIdentity(session);
  return session;
}

export async function createNetworkRematch(session: RoomSession): Promise<RoomSession> {
  if (session.role !== "host") throw new Error("Only the host can create a rematch lobby.");
  const accountToken = loadAccountToken();
  const rematch = await roomRequest({ action: "rematch", code: normalizeCode(session.code), token: session.token, ...(accountToken ? { accountToken } : {}) });
  saveRoomIdentity(rematch);
  createdRoom = { session: rematch, at: Date.now() };
  return rematch;
}

export function isCurrentRoomResponse(current: RoomSession | null, next: RoomSession) {
  return !current || current.code !== next.code || next.revision >= current.revision;
}

export async function connectPrivateRoom(code: string, forceRecovery = false) {
  if (forceRecovery) return recoverNetworkRoom(code);
  const identity = loadRoomIdentity(code);
  if (identity?.token) {
    try { return await resumeNetworkRoom(code, identity.token); }
    catch (error) {
      if (!(error instanceof Error) || !error.message.includes("resume token is not valid")) throw error;
    }
  }
  return recoverNetworkRoom(code);
}

export async function synchronizeRoom(session: RoomSession, signal: AbortSignal, latest: () => RoomSession = () => session) {
  try { return await waitForRoomUpdate(session, signal); }
  catch (error) {
    if (signal.aborted) throw error;
    const result = await pollRoomSession(latest());
    // Back off even if short polling succeeds while the long-poll endpoint is unavailable.
    await new Promise(resolve => setTimeout(resolve, 1200));
    return result;
  }
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

export async function spectateNetworkRoom(code: string): Promise<RoomSession> {
  return roomRequest({ action: "spectate", code: normalizeCode(code) });
}

export async function sendRoomCommand(
  session: Pick<RoomSession, "code" | "token" | "revision">,
  command: RoomCommand,
  commandId = globalThis.crypto?.randomUUID?.() || `command-${Date.now()}-${Math.random()}`,
): Promise<RoomSession> {
  const response = await fetch(
    `/api/rooms/${encodeURIComponent(normalizeCode(session.code))}/command`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: session.token,
        expectedRevision: session.revision,
        commandId,
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

export async function pollRoomSession(session: RoomSession): Promise<RoomSession | null> {
  const next = session.role === "spectator"
    ? await spectateNetworkRoom(session.code)
    : await resumeNetworkRoom(session.code, session.token);
  return next.revision === session.revision ? null : next;
}

export async function waitForRoomUpdate(session:RoomSession, signal?:AbortSignal):Promise<RoomSession|null> {
  const response=await fetch(`/api/rooms/${encodeURIComponent(normalizeCode(session.code))}/sync`,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:session.token,revision:session.revision,spectator:session.role==="spectator"}),cache:"no-store",signal,
  });
  if(response.status===204) return null;
  const payload=await readPayload<{changed:boolean;session?:RoomSession}>(response);
  if(!payload.changed||!payload.session) return null;
  if(payload.session.role!=="spectator") saveRoomIdentity(payload.session);
  return payload.session;
}

export async function sendRoomCommandWithRefresh(
  session: RoomSession,
  command: RoomCommand,
): Promise<RoomSession> {
  const commandId = globalThis.crypto?.randomUUID?.() || `command-${Date.now()}-${Math.random()}`;
  try {
    return await sendRoomCommand(session, command, commandId);
  } catch (error) {
    if (!(error instanceof RoomClientError) || !error.staleRevision) throw error;
    const refreshed = await resumeNetworkRoom(session.code, session.token);
    return sendRoomCommand(refreshed, command, commandId);
  }
}

export async function downloadPlaytestReport(session: RoomSession) {
  if (session.role !== "host") throw new Error("Only the host can export the complete playtest record.");
  const response = await fetch(`/api/rooms/${encodeURIComponent(normalizeCode(session.code))}/report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: session.token }),
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = (await response.json()) as RoomApiErrorPayload;
    throw new RoomClientError(payload.error || "Playtest report export failed.", response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `horizon-${session.code}-playtest.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
