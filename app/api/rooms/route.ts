import { accountTokenFromRequest, getAccountService, getOperationsSettingsRepository, getRoomRepository, getRoomService } from "../../../game/server";
import type { GameState } from "../../../game/types";
import type { RoomMode } from "../../../game/server/types";
import { getContentCatalog, installContentCatalog } from "../../../game/content";
import { enforceRateLimit } from "../../../game/server/rate-limit";

type RoomRequest =
  | { action: "create"; game: GameState; displayName: string; roomName?: string; mode?: RoomMode; accountToken?: string; autoStartWhenReady?: boolean }
  | { action: "join"; code: string; playerId: number; displayName: string; accountToken?: string }
  | { action: "resume"; code: string; token: string }
  | { action: "resumeAccount"; code: string; accountToken?: string }
  | { action: "rematch"; code: string; token: string; accountToken?: string }
  | { action: "spectate"; code: string }
  | {
      action: "save";
      code: string;
      token: string;
      expectedRevision: number;
      game: GameState;
    };

export async function POST(request: Request) {
  try {
    installContentCatalog(getContentCatalog());
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 2_000_000) throw new Error("Room request payload exceeds the 2 MB limit.");
    const body = (await request.json()) as RoomRequest;
    await enforceRateLimit(request,"rooms-household",600);
    const requestAccountToken = accountTokenFromRequest(request);
    const suppliedAccountToken = "accountToken" in body ? body.accountToken : undefined;
    const accountToken = suppliedAccountToken || requestAccountToken;
    const roomCredential = body.action === "resume" || body.action === "rematch" ? body.token : body.action === "resumeAccount" ? accountToken : undefined;
    await enforceRateLimit(request,"rooms",60,60_000,roomCredential);
    const rooms = getRoomService();
    const account = accountToken
      ? await getAccountService().authenticate(accountToken)
      : null;
    const accountId = account?.id || null;
    const access = await getOperationsSettingsRepository().get();
    const entersNetwork = body.action === "join" || (body.action === "create" && (body.mode || "local") === "network");
    if (body.action === "create" && (body.mode || "local") === "network" && !access.roomCreationOpen)
      throw new Error("New multiplayer rooms are temporarily closed by Horizon Operations.");
    if (body.action === "spectate" && !access.spectatorsAllowed)
      throw new Error("Spectator access is temporarily disabled by Horizon Operations.");
    if (entersNetwork && access.multiplayerVerification === "commander" && !account)
      throw new Error("A Commander account is required for network multiplayer.");
    if (body.action === "create" && body.roomName !== undefined && typeof body.roomName !== "string")
      throw new Error("Room name must be text.");
    const result =
      body.action === "create"
        ? await rooms.create(body.game, account?.displayName || body.displayName, body.mode || "local", accountId, account?.emblems.selected || "horizon", body.autoStartWhenReady === true, body.roomName || "")
        : body.action === "join"
          ? await rooms.join(
              body.code,
              Number(body.playerId),
              account?.displayName || body.displayName,
              accountId,
              account?.emblems.selected || "horizon",
            )
          : body.action === "resume"
            ? await rooms.resume(body.code, body.token)
          : body.action === "resumeAccount"
            ? await rooms.resumeByAccount(body.code, accountId || (() => { throw new Error("A commander profile is required for recovery."); })())
          : body.action === "rematch"
            ? await rooms.createRematch(body.code, body.token, accountId)
          : body.action === "spectate"
            ? await rooms.spectate(body.code)
          : body.action === "save"
              ? await rooms.save(
                  body.code,
                  body.token,
                  Number(body.expectedRevision),
                  body.game,
                )
              : null;
    if (!result) throw new Error("Unknown room action.");
    if (result.summary.status === "complete") {
      const completed = await getRoomRepository().get(result.code);
      if (completed?.game.result) await getAccountService().settleCompletedRoom(completed);
    }
    return Response.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Room request failed." },
      { status: error instanceof Error && error.message.startsWith("Too many") ? 429 : 400, headers: { "cache-control": "no-store" } },
    );
  }
}
