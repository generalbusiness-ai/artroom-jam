/** Fixed native origin and a natively admitted musician request before model cost. */
import {DurableObject} from 'cloudflare:workers';
import type {Entry, SignedRead} from '@generalbusiness/artroom-contract';
import {parseStrict,parseStrictBytes,isScopeRef,isDigest,isEntry,isSealed,isReceipt,isReadOf,isSummary,canonicalize,canonicalBytes,digestBytes,entryHash,factRefOf,intentDigest,unb64url,verifySignedRead,verifySignedIntent,takeBytes,within,LATE,timeMs} from '@generalbusiness/artroom-bytes';
import type {Expiry} from '@generalbusiness/artroom-bytes';
import {capturedReplayConfig} from './native-replay.ts';
import {validateInterpretation} from './contributions-v2.ts';
import {decodePattern} from './patterns-v2.ts';
interface Env {ASSETS:{fetch(request:Request):Promise<Response>};ARTROOM_ORIGIN:string;JAM_CONFIG:string;JAM_REPLAY_CONFIG?:string;AI?:{run(model:string,input:unknown):Promise<unknown>};JAM_MODEL?:string;MUSICIAN:DurableObjectNamespace}
const object=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const closed=(x:unknown,keys:string[])=>object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
function configuration(env:Env){const value=parseStrict(env.JAM_CONFIG);if(!closed(value,['ref','pin'])||!isScopeRef((value as Record<string,unknown>)['ref'])||!isDigest((value as Record<string,unknown>)['pin']))throw new Error('Public room configuration required');return value as {ref:{scope:string;inc:string;kind:string};pin:string};}
function origin(env:Env){const value=new URL(env.ARTROOM_ORIGIN);if(value.protocol!=='https:'||value.username||value.password||value.pathname!=='/'||value.search||value.hash)throw new Error('Native origin required');return value;}
async function bytes(body:ReadableStream<Uint8Array>|null,limit:number,exchange?:Expiry){if(!body)throw new Error('Body required');const value=exchange?await takeBytes(body,limit,exchange):await within(30,signal=>takeBytes(body,limit,signal));if(value===LATE||value===null)throw new Error('Bounded body unavailable');return value;}
function secured(response:Response){const headers=new Headers(response.headers);headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','no-referrer');headers.set('permissions-policy','microphone=(self)');headers.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");return new Response(response.body,{status:response.status,headers});}
function reader(header:string|null,scope:string,read:string,arg:string):SignedRead {
 if(!header?.startsWith('Signed ')||header.length>4096)throw new Error('Exact signed native reader required');
 const value=parseStrictBytes(unb64url(header.slice(7))) as SignedRead;
 if(!closed(value,['request','sig'])||!closed(value.request,['v','to','actor','read','arg','notAfter'])||value.request.v!==1||value.request.to!==scope||value.request.read!==read||value.request.arg!==arg||!verifySignedRead(value))throw new Error('Wrong native reader');
 return value;
}
async function nativeRead(env:Env,path:string,authorization:string) {
 const url=new URL('/v1/scopes/'+path,origin(env));
 const read=await within(30,async signal=>{const response=await fetch(url,{headers:{authorization},redirect:'error',signal:signal as never});if(response.status!==200||response.redirected||response.url!==url.href)throw new Error('Native reader refused');return parseStrictBytes(await bytes(response.body,1048576,signal));});
 if(read===LATE)throw new Error('Native read unavailable');return read;
}
async function admitted(request:Request,env:Env) {
 const config=configuration(env),body=parseStrictBytes(await bytes(request.body,32768));
 if(!closed(body,['receipt','context']))throw new Error('Closed musician envelope required');
 const value=body as Record<string,unknown>;
 if(!isReceipt(value['receipt'])||canonicalize(value['receipt'].fact.at)!==canonicalize(config.ref)||value['receipt'].definition!==config.pin)throw new Error('Wrong native receipt');
 const receipt=value['receipt'],authorization=request.headers.get('authorization'),summaryAuthorization=request.headers.get('x-jam-summary-authorization');
 const who=reader(authorization,config.ref.scope,'entry',String(receipt.fact.seq));
 const summaryWho=reader(summaryAuthorization,config.ref.scope,'summary','summary');
 if(who.request.actor!==summaryWho.request.actor)throw new Error('Different actor');
 const read=await nativeRead(env,encodeURIComponent(config.ref.scope)+'/entries/'+receipt.fact.seq,authorization!);
 const summary=await nativeRead(env,encodeURIComponent(config.ref.scope),summaryAuthorization!);
 if(!isReadOf(isSealed)(read)||!read.ok||!isReadOf(isSummary)(summary)||!summary.ok||summary.value.status!=='active'||canonicalize(summary.value.scope)!==canonicalize(config.ref)||summary.value.definition!==config.pin)throw new Error('Native room unavailable');
 const entry=read.value.entry;
 if(entryHash(entry)!==read.value.hash||canonicalize(factRefOf(entry))!==canonicalize(receipt.fact)||entry.input.type!=='act'||entry.input.signed.intent.kind!=='musician-request'||entry.input.signed.intent.actor!==who.request.actor||receipt.intent!==intentDigest(entry.input.signed.intent)||canonicalize(receipt.effects)!==canonicalize(entry.effects))throw new Error('Exact accepted musician request required');
 const nativeInput=entry.input,signed=nativeInput.signed,fields=signed.intent.fields;
 if(!await verifySignedIntent(signed))throw new Error('Native request signature invalid');
 const party=entry.effects.find(e=>e.effect==='party'&&e.item===entry.seq&&e.slot==='player');
 if(!entry.effects.some(e=>e.effect==='open'&&e.item===entry.seq&&e.type==='model-request')||!party||party.effect!=='party'||!nativeInput.authority.some(g=>g.key===signed.intent.actor&&g.actions.includes('jam.musician')&&canonicalize(g.subject)===canonicalize(party.member)))throw new Error('Native musician admission missing');
 if(!['interpret','pattern'].includes(String(fields['kind']))||!['synth','percussion','lead','bass'].includes(String(fields['part']))||!isDigest(fields['contextDigest'])||!Array.isArray(value['context'])||value['context'].length<1||value['context'].length>8||value['context'].some(e=>!isEntry(e)||canonicalize(e.at)!==canonicalize(config.ref))||digestBytes(canonicalBytes(value['context']))!==fields['contextDigest'])throw new Error('Context differs from admitted request');
 const context=value['context'] as Entry[];
 if(canonicalize(factRefOf(context.at(-1)!))!==canonicalize(fields['head'])||context.at(-1)!.seq>=entry.seq||context.some((e,i)=>i>0&&(e.seq!==context[i-1]!.seq+1||e.prev!==entryHash(context[i-1]!))))throw new Error('Context prefix identity mismatch');
 return {id:intentDigest(signed.intent),time:entry.time,kind:fields['kind'],part:fields['part'],context};
}
/** Per original native request, one provider dispatch. A crash/timeout stays unknown. */
export class Musician extends DurableObject<Env> {
 async fetch(request:Request):Promise<Response> {
  const value=parseStrictBytes(await bytes(request.body,32768)) as ReturnType<typeof admitted> extends Promise<infer T>?T:never;
  const key=digestBytes(canonicalBytes(value));
  // This stub is reachable only through the Worker binding, after native admission.
  return this.ctx.blockConcurrencyWhile(async()=>{
   const old=await this.ctx.storage.get<{key:string;status:'started'|'proposed';proposal?:unknown}>('outcome');
   if(old){if(old.key!==key)return new Response('Original request mismatch',{status:409});if(old.status==='proposed')return Response.json(old.proposal);return new Response('Original model outcome unknown; no second dispatch',{status:503});}
   const at=timeMs(value.time);if(at===null||Date.now()<at||Date.now()-at>120000)return new Response('New model dispatch window ended',{status:409});
   if(!this.env.AI||!this.env.JAM_MODEL)return new Response('Musical model not configured',{status:503});
   await this.ctx.storage.put('outcome',{key,status:'started'});
   const schema=value.kind==='interpret'?'kind tune|rhythm,tempoMilliBpm integer60000..180000,tempoClear boolean,key {tonic0..11,mode major|minor|mixolydian|pentatonic|blues},theme [{step,length,pitch,velocity}]max64,themeBars1..16,rhythm [{step,cls high|low}]max64,rhythmBars0..16. Rhythm preserves preceding key/theme; tune has empty rhythm.':'bars1..16,events1..64 {stepUnits,lengthUnits,pitch,velocity,voice,filterUnits?,lateUnits?,tone?,from?,glideUnits?}. Millionths of one sixteenth step, end<=bars*16000000,MIDI0..127,filter/late0..1000000. Voices hum,bass,stab,arp,lead,kick,hat,openhat,clap,tom. Synth provides groove without drum kit or lead; percussion hits floor; lead expressive.';
   try {
    const generated=await within(25,async signal=>{
     const stream=await this.env.AI!.run(this.env.JAM_MODEL!,{stream:true,max_tokens:4096,messages:[{role:'system',content:'Return only exact integer JSON musical proposal: '+schema},{role:'user',content:canonicalize({kind:value.kind,part:value.part,context:value.context})}]});
     if(!(stream instanceof ReadableStream))throw new Error('Configured model does not return its documented stream');
     // Deadline cancellation also covers a stream returned after AI.run's wait.
     return await bytes(stream,32768,signal);
    });
    if(generated===LATE)return new Response('Model outcome unknown; no native act submitted',{status:503});
    const framed=new TextDecoder('utf-8',{fatal:true}).decode(generated);
    let text='',ended=false;
    for(const block of framed.replace(/\r\n/g,'\n').split('\n\n')) {
     if(!block.trim())continue;
     const lines=block.split('\n').filter(line=>!line.startsWith(':'));
     if(!lines.length)continue;
     if(ended||lines.some(line=>!line.startsWith('data:')))throw new Error('Unexpected model stream framing');
     const data=lines.map(line=>line.slice(5).replace(/^ /,'')).join('\n');
     if(data==='[DONE]'){ended=true;continue;}
     const token=parseStrict(data);
     if(!object(token)||typeof token['response']!=='string')throw new Error('Unexpected model stream event');
     if(new TextEncoder().encode(text).length+new TextEncoder().encode(token['response']).length>16384)throw new Error('Model output outside bounds');
     text+=token['response'];
    }
    if(!ended||!text)throw new Error('Model stream incomplete');
    const proposal=parseStrict(text);
    if(value.kind==='interpret')validateInterpretation(proposal as never);
    else {if(!closed(proposal,['bars','events']))throw new Error('Closed pattern required');decodePattern((proposal as Record<string,unknown>)['bars'] as number,(proposal as Record<string,unknown>)['events'] as never);}
    await this.ctx.storage.put('outcome',{key,status:'proposed',proposal});return Response.json(proposal);
   }catch{return new Response('Original model outcome unknown; no native act submitted',{status:503});}
  });
 }
}
async function run(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url);
 if(url.username||url.password)return new Response('Credentials cannot be in URLs',{status:400});
 if(url.pathname==='/jam-replay-config'){if(!env.JAM_REPLAY_CONFIG)return new Response('Actual replay configuration not supplied',{status:503});try{if(new TextEncoder().encode(env.JAM_REPLAY_CONFIG).length>16384)throw new Error('Public replay configuration too large');const value=capturedReplayConfig(parseStrict(env.JAM_REPLAY_CONFIG));if(value&&value.deployment.origin!==origin(env).origin)throw new Error('Replay metadata belongs to another native origin');return value?Response.json(value,{headers:{'cache-control':'no-store'}}):new Response('Unsupported public replay configuration',{status:422});}catch{return new Response('Unsupported public replay configuration',{status:422});}}
 if(url.pathname==='/jam-config'){try{return Response.json(configuration(env),{headers:{'cache-control':'no-store'}});}catch{return new Response('Room not configured',{status:503});}}
 if(url.pathname==='/v1/scopes'||url.pathname.startsWith('/v1/scopes/')) {
  if([...url.searchParams.keys()].some(k=>k!=='cursor'&&k!=='domain'))return new Response('Unsupported URL argument',{status:400});
  try{return await fetch(new Request(new URL(url.pathname+url.search,origin(env)),request),{redirect:'error'});}catch{return new Response('Native response unavailable',{status:503});}
 }
 if(url.pathname==='/musician'&&request.method==='POST') {
  if(url.search)return new Response('Credentials cannot be in URLs',{status:400});
  try{const value=await admitted(request,env);return await env.MUSICIAN.get(env.MUSICIAN.idFromName(value.id)).fetch(new Request('https://musician.internal/',{method:'POST',body:canonicalize(value)}));}
  catch{return new Response('Exact native musician request unavailable; no provider dispatch',{status:403});}
 }
 return env.ASSETS.fetch(request);
}
export default{async fetch(request:Request,env:Env){return secured(await run(request,env));}};
