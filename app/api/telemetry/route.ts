import { recordDiagnostic } from "../../../game/server/diagnostics";

import { enforceRateLimit } from "../../../game/server/rate-limit";

export async function POST(request:Request){
  const requestId=crypto.randomUUID();
  try{
    await enforceRateLimit(request,"telemetry",20);
    const body=await request.json() as {category?:unknown;step?:unknown};
    const onboarding=new Set(["tutorial-started","tutorial-step","tutorial-resumed","tutorial-abandoned","tutorial-completed","quick-start"]);
    if(body.category!=="render-failure"&&!onboarding.has(String(body.category)))throw new Error("Unknown diagnostic category.");
    const step=Number.isInteger(body.step)&&Number(body.step)>=0&&Number(body.step)<=20?Number(body.step):undefined;
    recordDiagnostic({severity:body.category==="render-failure"?"error":"warning",source:body.category==="render-failure"?"application-shell":"onboarding",message:body.category==="render-failure"?"Client render failure":`Onboarding event: ${String(body.category)}${step===undefined?"":` step ${step}`}`,requestId});
    return Response.json({ok:true,requestId},{headers:{"cache-control":"no-store"}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Diagnostic request failed.",requestId},{status:error instanceof Error && error.message.startsWith("Too many")?429:400,headers:{"cache-control":"no-store"}});}
}
