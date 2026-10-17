import { getAccountService, requireAccountRole } from "../../../../game/server";
import { enforceRateLimit } from "../../../../game/server/rate-limit";

export async function GET(request:Request){try{await enforceRateLimit(request,"admin",120);await requireAccountRole(request,["owner","admin","support"]);const query=new URL(request.url).searchParams.get("q")||"";return Response.json({accounts:(await getAccountService().listAccounts(query)).slice(0,200)},{headers:{"cache-control":"no-store"}});}catch(error){return Response.json({error:error instanceof Error?error.message:"Commander search failed."},{status:403,headers:{"cache-control":"no-store"}});}}
