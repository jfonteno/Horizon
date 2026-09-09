import { getContentCatalog, installContentCatalog } from "../../../../../game/content";
import { createPlaytestReport } from "../../../../../game/server/playtest-report";
import { getRoomService } from "../../../../../game/server/runtime";

type RouteContext = { params: { code: string } | Promise<{ code: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    installContentCatalog(getContentCatalog());
    const { code } = await Promise.resolve(context.params);
    const body = (await request.json()) as { token?: unknown };
    if (typeof body.token !== "string" || !body.token.trim())
      throw new Error("A valid host token is required.");
    const room = await getRoomService().authenticateHost(code, body.token);
    const report = await createPlaytestReport(room);
    return Response.json(report, {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="horizon-${room.code}-playtest.json"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Playtest report export failed.";
    return Response.json({ error: message }, { status: /host|token/i.test(message) ? 401 : 400, headers: { "cache-control": "no-store" } });
  }
}
