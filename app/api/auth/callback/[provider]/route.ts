import { sessionCookie } from "../../../../../game/server/account-auth";
import { getAccountService } from "../../../../../game/server/runtime";
import { completeProvider, cookieValue, OAUTH_STATE_COOKIE, oauthCookie, readOAuthState, type ExternalProvider } from "../../../../../game/server/providers";

type Context={params:{provider:string}|Promise<{provider:string}>};

function redirect(request:Request,location:string,sessionToken?:string){
  const headers=new Headers({location,"cache-control":"no-store"});
  if(sessionToken)headers.append("set-cookie",sessionCookie(sessionToken,request));
  headers.append("set-cookie",oauthCookie("",request,0));
  return new Response(null,{status:302,headers});
}

async function callback(request:Request,context:Context){
  try{
    const {provider:raw}=await Promise.resolve(context.params),provider=raw as ExternalProvider;
    if(!["apple","google","steam"].includes(provider))throw new Error("Unsupported identity provider.");
    const params=request.method==="POST"?new URLSearchParams([...((await request.formData()).entries() as IterableIterator<[string,string]>) ]):new URL(request.url).searchParams;
    const state=await readOAuthState(cookieValue(request,OAUTH_STATE_COOKIE));
    if(state.provider!==provider||params.get("state")!==state.state)throw new Error("Platform sign-in state does not match.");
    const identity=await completeProvider(provider,request,params,state),service=getAccountService();
    if(state.mode==="link"){
      if(!state.accountId)throw new Error("The platform link request is missing its Commander account.");
      await service.linkIdentityForOAuth(state.accountId,provider,identity.subject,identity.label);
      return redirect(request,`${state.returnTo}${state.returnTo.includes("?")?"&":"?"}identity=linked`);
    }
    const signedIn=await service.signInWithProvider(provider,identity.subject,identity.label,identity.displayName,request.headers.get("user-agent")||undefined);
    return redirect(request,state.returnTo,signedIn.token);
  }catch(error){
    const message=encodeURIComponent(error instanceof Error?error.message:"Platform sign-in failed.");
    return redirect(request,`/?identity_error=${message}`);
  }
}

export const GET=callback;
export const POST=callback;
