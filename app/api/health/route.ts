import { getAccountRepository, getOperationsSettingsRepository, getRoomRepository } from "../../../game/server/runtime";
import { diagnosticStatus } from "../../../game/server/diagnostics";
import { providerConfiguration } from "../../../game/server/providers";

export async function GET() {
  const repository = getRoomRepository();
  const storage = repository.health ? await repository.health() : { ok: true };
  const accounts=getAccountRepository();
  const accountStorage=accounts.health?await accounts.health():{ok:true};
  const operations=getOperationsSettingsRepository();
  const operationsStorage=operations.health?await operations.health():{ok:true};
  const access=await operations.get();
  const ok=storage.ok&&accountStorage.ok&&operationsStorage.ok;
  return Response.json(
    {
      ok,
      service: "horizon",
      version: "0.35.1",
      storage: repository.kind,
      accountStorage: accounts.kind,
      operationsStorage: operations.kind,
      multiplayerVerification: access.multiplayerVerification,
      liveSync: "authenticated-long-poll",
      roomSchemaVersion: 12,
      accountSchemaVersion: 3,
      identityProviders: providerConfiguration(),
      uptimeSeconds: typeof process!=="undefined"?Math.round(process.uptime()):undefined,
      diagnostics: diagnosticStatus(),
      detail: ok ? undefined : [storage.detail,accountStorage.detail,operationsStorage.detail].filter(Boolean).join("; "),
      checkedAt: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
