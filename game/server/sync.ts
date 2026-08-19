import { RoomService } from "./rooms";
import type { RoomRepository, RoomSession, RoomSummary } from "./types";

export const DEFAULT_ROOM_POLL_INTERVAL_MS = 1500;

export type RoomSyncResult = {
  changed: boolean;
  revision: number;
  summary: RoomSummary;
  session?: RoomSession;
};

/**
 * Poll a room using the existing resume path so privacy projection remains in
 * one place. Hosts receive the host view already defined by RoomService;
 * ordinary players receive projectPrivateGame through RoomService.resume().
 */
export async function syncRoom(
  repository: RoomRepository,
  code: string,
  token: string,
  knownRevision?: number,
): Promise<RoomSyncResult> {
  const service = new RoomService(repository);
  const session = await service.resume(code, token);
  const changed = knownRevision === undefined || session.revision !== knownRevision;

  return {
    changed,
    revision: session.revision,
    summary: session.summary,
    session: changed ? session : undefined,
  };
}

/**
 * Small helper for clients that want adaptive polling without WebSockets.
 */
export function nextPollDelay(
  consecutiveUnchanged: number,
  baseMs = DEFAULT_ROOM_POLL_INTERVAL_MS,
): number {
  const multiplier = Math.min(4, 1 + Math.max(0, consecutiveUnchanged) * 0.25);
  return Math.round(baseMs * multiplier);
}
