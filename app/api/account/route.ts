import { accountTokenFromRequest, getAccountRepository, getAccountService, getRoomRepository, roomAttention, sessionCookie } from "../../../game/server";
import { enforceRateLimit } from "../../../game/server/rate-limit";
import type { AccountPreferences } from "../../../game/server/accounts";

type AccountRequest =
  | { action: "create"; displayName: string; deviceLabel?: string }
  | { action: "resume"; token?: string }
  | { action: "recover"; recoveryKey: string; deviceLabel?: string }
  | { action: "update"; token?: string; displayName: string }
  | { action: "preferences"; token?: string; preferences: Partial<AccountPreferences> }
  | { action: "emblem"; token?: string; emblemId: string }
  | { action: "revokeSession"; token?: string; sessionId: string }
  | { action: "revokeOthers"; token?: string }
  | { action: "unlinkIdentity"; token?: string; identityId: string; recoveryKey?: string }
  | { action: "rotateRecoveryKey"; token?: string }
  | { action: "logout"; token?: string }
  | { action: "export"; token?: string }
  | { action: "delete"; token?: string };

async function linkedRooms(accountId: string) {
  const repository = getRoomRepository();
  const account = await getAccountRepository().get(accountId);
  const hiddenRoomCodes = account?.hiddenRoomCodes || [];
  const rooms = repository.findByAccount ? await repository.findByAccount(accountId) : [];
  return {hiddenRoomCodes,rooms:rooms.filter(room=>!hiddenRoomCodes.includes(room.code)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map((room) => {
    const seat = room.seats.find((candidate) => candidate.accountId === accountId);
    return { code:room.code,roomName:room.name?.trim()||room.code,status:room.game.result?"complete":room.status,role:room.hostAccountId===accountId?"host":"player",playerId:seat?.playerId,displayName:seat?.displayName||null,turn:room.game.turn,era:room.game.era,attentionCount:room.game.result?0:roomAttention(room,seat?.playerId).length,turnDeadlineAt:room.game.result?null:room.turnDeadlineAt,updatedAt:room.updatedAt };
  })};
}

function deviceLabel(request:Request, supplied?:string) {
  return supplied?.trim().slice(0,80) || request.headers.get("user-agent")?.slice(0,80) || "Horizon device";
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    await enforceRateLimit(request,"account",30);
    const body = await request.json() as AccountRequest;
    const service = getAccountService();
    const presentedToken = "token" in body && body.token ? body.token : accountTokenFromRequest(request);
    if (body.action === "create") {
      const created = await service.create(body.displayName,deviceLabel(request,body.deviceLabel));
      return Response.json({ ...created, rooms:[],hiddenRoomCodes:[] }, { headers:{"cache-control":"no-store","x-horizon-request-id":requestId,"set-cookie":sessionCookie(created.token,request)} });
    }
    if (body.action === "recover") {
      const recovered=await service.recover(body.recoveryKey,deviceLabel(request,body.deviceLabel));
      return Response.json({...recovered,...await linkedRooms(recovered.account.id)},{headers:{"cache-control":"no-store","x-horizon-request-id":requestId,"set-cookie":sessionCookie(recovered.token,request)}});
    }
    if (!presentedToken) throw new Error("A Commander session is required.");
    if (body.action === "logout") {
      const signedOut = await service.revokeCurrentSession(presentedToken);
      return Response.json(signedOut, { headers:{"cache-control":"no-store","x-horizon-request-id":requestId,"set-cookie":sessionCookie("",request,0)} });
    }
    if (body.action === "delete") {
      const deleted = await service.delete(presentedToken);
      return Response.json(deleted, { headers:{"cache-control":"no-store","x-horizon-request-id":requestId,"set-cookie":sessionCookie("",request,0)} });
    }
    if (body.action === "revokeSession") return Response.json({sessions:await service.revokeSession(presentedToken,body.sessionId)},{headers:{"cache-control":"no-store","x-horizon-request-id":requestId}});
    if (body.action === "revokeOthers") return Response.json({sessions:await service.revokeOtherSessions(presentedToken)},{headers:{"cache-control":"no-store","x-horizon-request-id":requestId}});
    if (body.action === "unlinkIdentity") return Response.json({account:await service.unlinkIdentity(presentedToken,body.identityId,body.recoveryKey)},{headers:{"cache-control":"no-store","x-horizon-request-id":requestId}});
    if (body.action === "rotateRecoveryKey") return Response.json(await service.rotateRecoveryKey(presentedToken),{headers:{"cache-control":"no-store","x-horizon-request-id":requestId}});
    if (body.action === "preferences") return Response.json({preferences:await service.updatePreferences(presentedToken,body.preferences)},{headers:{"cache-control":"no-store","x-horizon-request-id":requestId}});
    if (body.action === "emblem") return Response.json({account:await service.selectEmblem(presentedToken,body.emblemId)},{headers:{"cache-control":"no-store","x-horizon-request-id":requestId}});
    if (body.action === "export") {
      const payload=await service.export(presentedToken);
      return new Response(`${JSON.stringify({...payload,...await linkedRooms(payload.account.id)},null,2)}\n`, { headers:{"content-type":"application/json","content-disposition":"attachment; filename=horizon-account-export.json","cache-control":"no-store","x-horizon-request-id":requestId} });
    }
    const session = body.action === "update"
      ? { ...(await service.session(presentedToken)), account:await service.update(presentedToken,body.displayName) }
      : await service.session(presentedToken);
    return Response.json({ ...session, ...await linkedRooms(session.account.id) }, { headers:{"cache-control":"no-store","x-horizon-request-id":requestId,"set-cookie":sessionCookie(presentedToken,request)} });
  } catch (error) {
    const message=error instanceof Error?error.message:"Account request failed.";
    return Response.json({error:message,requestId},{status:message.startsWith("Too many")?429:message.includes("required")||message.includes("credential")||message.includes("session")?401:400,headers:{"cache-control":"no-store","x-horizon-request-id":requestId}});
  }
}

export async function GET() {
  const repository=getAccountRepository();
  const health = repository.health ? await repository.health() : {ok:true};
  return Response.json({ok:health.ok,storage:repository.kind,schemaVersion:3,detail:health.detail},{status:health.ok?200:503,headers:{"cache-control":"no-store"}});
}
