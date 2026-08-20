import { getRoomService } from "../../../game/server";
import type { GameState } from "../../../game/types";

type RoomRequest =
  | { action: "create"; game: GameState; displayName: string }
  | { action: "join"; code: string; playerId: number; displayName: string }
  | { action: "resume"; code: string; token: string }
  | {
      action: "save";
      code: string;
      token: string;
      expectedRevision: number;
      game: GameState;
    };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RoomRequest;
    const rooms = getRoomService();
    const result =
      body.action === "create"
        ? await rooms.create(body.game, body.displayName)
        : body.action === "join"
          ? await rooms.join(
              body.code,
              Number(body.playerId),
              body.displayName,
            )
          : body.action === "resume"
            ? await rooms.resume(body.code, body.token)
            : body.action === "save"
              ? await rooms.save(
                  body.code,
                  body.token,
                  Number(body.expectedRevision),
                  body.game,
                )
              : null;
    if (!result) throw new Error("Unknown room action.");
    return Response.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Room request failed." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
}
