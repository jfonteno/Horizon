import { getAccountService, getRoomRepository, getRoomService } from "../../../../../game/server";
import { enforceRateLimit } from "../../../../../game/server/rate-limit";

export async function POST(request:Request,{params}:{params:Promise<{code:string}>}) {
  const requestId=crypto.randomUUID();
  try {
    const {code}=await params;
    const body=await request.json() as {token?:string;revision?:number;spectator?:boolean};
    await enforceRateLimit(request,"room-sync-household",600);
    await enforceRateLimit(request,"room-sync",90,60_000,body.token||`spectator:${code}`);
    const knownRevision=Number(body.revision);
    if(!Number.isInteger(knownRevision)||knownRevision<0) throw new Error("A valid room revision is required.");
    const rooms=getRoomService();
    const deadline=Date.now()+20_000;
    do {
      if(request.signal.aborted) return new Response(null,{status:204,headers:{"cache-control":"no-store","x-horizon-request-id":requestId}});
      const session=body.spectator?await rooms.spectate(code):await rooms.resume(code,String(body.token||""));
      if(session.revision!==knownRevision) {
        if(session.summary.status==="complete"){
          const completed=await getRoomRepository().get(session.code);
          if(completed?.game.result)await getAccountService().settleCompletedRoom(completed);
        }
        return Response.json({changed:true,session},{headers:{"cache-control":"no-store","x-horizon-request-id":requestId}});
      }
      await new Promise((resolve)=>setTimeout(resolve,500));
    } while(Date.now()<deadline);
    return new Response(null,{status:204,headers:{"cache-control":"no-store","x-horizon-request-id":requestId}});
  } catch(error) {
    const message=error instanceof Error?error.message:"Room synchronization failed.";
    return Response.json({error:message,requestId},{status:message.startsWith("Too many")?429:400,headers:{"cache-control":"no-store","x-horizon-request-id":requestId}});
  }
}
