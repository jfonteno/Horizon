import { validateRoomCommand, type RoomCommandEnvelope } from "../../../../../game/server/command";
import { executeRoomCommand } from "../../../../../game/server/room-actions";
import { getRoomRepository } from "../../../../../game/server/runtime";
import { getContentCatalog, installContentCatalog } from "../../../../../game/content";
import { enforceRateLimit } from "../../../../../game/server/rate-limit";
import { getAccountService } from "../../../../../game/server/runtime";

type RouteContext = {
  params: { code: string } | Promise<{ code: string }>;
};

function errorStatus(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("revision") ||
    lower.includes("changed while") ||
    lower.includes("sync and retry")
  )
    return 409;

  if (
    lower.includes("token") ||
    lower.includes("not valid") ||
    lower.includes("human seat")
  )
    return 401;

  if (lower.includes("no horizon room")) return 404;

  return 400;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await enforceRateLimit(request,"room-command",180);
    installContentCatalog(getContentCatalog());
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 60_000) throw new Error("Room command payload exceeds the 60 KB limit.");
    const { code } = await Promise.resolve(context.params);
    const body = (await request.json()) as Partial<RoomCommandEnvelope>;

    if (!body || typeof body !== "object")
      throw new Error("A room command request body is required.");

    if (typeof body.token !== "string" || !body.token.trim())
      throw new Error("A valid room token is required.");

    if (
      typeof body.expectedRevision !== "number" ||
      !Number.isInteger(body.expectedRevision) ||
      body.expectedRevision < 1
    )
      throw new Error("A valid expectedRevision is required.");

    if (!body.command || typeof body.command !== "object")
      throw new Error("A room command is required.");
    if (typeof body.commandId !== "string" || !body.commandId.trim() || body.commandId.length > 120)
      throw new Error("A valid commandId is required.");

    const result = await executeRoomCommand(
      getRoomRepository(),
      {
        code,
        token: body.token,
        expectedRevision: body.expectedRevision,
        commandId: body.commandId,
        command: validateRoomCommand(body.command),
      },
      {
        runBotsAfterHumanOrders: true,
        autoResolveWhenReady: true,
      },
    );
    if (result.ok) {
      const completed = await getRoomRepository().get(code.trim().toUpperCase());
      if (completed?.status === "complete" && completed.game.result)
        await getAccountService().settleCompletedRoom(completed);
    }

    return Response.json(result, {
      status: result.ok ? 200 : 400,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Room command failed.";

    return Response.json(
      { ok: false, error: message },
      {
        status: message.startsWith("Too many") ? 429 : errorStatus(message),
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
