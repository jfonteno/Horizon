"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  useEffect(()=>{void fetch("/api/telemetry",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({source:"application-shell",category:"render-failure"})}).catch(()=>undefined);},[error]);
  return <main className="legal-page"><article><span>RECOVERY MODE</span><h1>Horizon encountered an error.</h1><p>Horizon will attempt to record a generic error category. Error text, room details, and credentials are not included.</p><button className="premium-primary" onClick={reset}>Retry</button> <Link href="/">Return to command interface</Link></article></main>;
}
