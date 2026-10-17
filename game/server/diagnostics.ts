export type DiagnosticEvent = { id:string;at:string;severity:"warning"|"error";source:string;message:string;requestId?:string;path?:string };
const runtime=globalThis as typeof globalThis & {__horizonDiagnostics?:DiagnosticEvent[]};
function events(){return runtime.__horizonDiagnostics ||= [];}
export function recordDiagnostic(event:Omit<DiagnosticEvent,"id"|"at">){const entry={...event,id:crypto.randomUUID(),at:new Date().toISOString()};events().push(entry);if(events().length>200)events().splice(0,events().length-200);console.warn(JSON.stringify({service:"horizon",...entry}));return entry;}
export function diagnosticStatus(){const current=events();return{retained:current.length,lastErrorAt:[...current].reverse().find(event=>event.severity==="error")?.at||null};}
