import { getRoomRepository } from "../../../game/server/runtime";

export async function GET() {
  const repository = getRoomRepository();
  const storage = repository.health ? await repository.health() : { ok: true };
  return Response.json(
    {
      ok: storage.ok,
      service: "horizon",
      version: "0.17.2",
      storage: repository.kind,
      detail: storage.ok ? undefined : storage.detail,
      checkedAt: new Date().toISOString(),
    },
    {
      status: storage.ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
