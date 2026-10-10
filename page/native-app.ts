import type {ScopeRef,Digest,Grant,FieldValue,Receipt,DeclaredDefinition} from '@generalbusiness/artroom-contract';
import {parseStrict,unb64url,canonicalize,canonicalBytes,digestBytes,isScopeRef,isDigest,isGrant,intentDigest,takeBytes,within,LATE} from '@generalbusiness/artroom-bytes';
import {httpTransport,signedReads,ScopeHandle,secretSigner,signedIntent,signedReader,TransportError,type Signer} from '@generalbusiness/artroom-client';
import declaration from '../definitions/jam-native-v2.json';
import {nativeHistory,reconcileOriginal,type NativeRoom,type PendingIntent} from '../src/native.ts';
import {capturedReplayConfig,publicNativeReplay} from '../src/native-replay.ts';
import {nativeRevisions} from '../src/native-revisions.ts';
import {BrowserCustody} from '../src/browser-custody.ts';
import {nativeBar,type NativeHistory} from '../src/native-audio.ts';
import {encodeContribution,validateInterpretation} from '../src/contributions-v2.ts';
import {decodePattern} from '../src/patterns-v2.ts';
import {ORIGINAL_TUNES,RHYTHM} from '../src/phrases.ts';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
interface Connection {generation:number;room:NativeRoom;signer:Signer;custody:BrowserCustody}
let connection:Connection|undefined,history:NativeHistory|undefined,audio:AudioContext|undefined;
let generation=0,busy=false,nextBar=1,timer:ReturnType<typeof setTimeout>|undefined,audioTimer:ReturnType<typeof setTimeout>|undefined,agentTimer:ReturnType<typeof setTimeout>|undefined,agentRunning=false,lastAgentTrigger='';
let microphone:MediaStream|undefined,capture:AudioContext|undefined,chunks:Float32Array[]=[],processor:ScriptProcessorNode|undefined;
const tell=(message:string)=>{$('status').textContent=message;};
function current(c:Connection){if(connection!==c||generation!==c.generation)throw new Error('Connection changed; retained original was not replaced');}
function connected(){if(!connection)throw new Error('Connect first');current(connection);return connection;}
function stopCapture(){processor?.disconnect();microphone?.getTracks().forEach(t=>t.stop());void capture?.close();capture=undefined;microphone=undefined;processor=undefined;chunks=[];}
async function refresh(c=connected()) {
 const read=await nativeHistory(c.room);current(c);history=read;
 $('history').textContent=read.mapped?read.mapped.map(e=>`${e.seq}: ${e.act.kind==='music'?e.act.name:e.act.kind} — bar ${read.schedule?.cues[e.seq]?.effectBar ?? 'none'}`).join('\n'):read.entries.map(e=>`${e.seq}: native ${e.input.type} — no musical cue`).join('\n');
 $('replay-report').textContent=read.replay.status==='reported'?read.replay.display:read.replay.why;
 tell(`Recorded head ${read.head.seq}. Native provenance checked. ${read.mapped?'Exact replay coverage permits musical cues.':'Musical cues unavailable until exact consistent replay.'}`);return read;
}
async function connect() {
 generation++;connection=undefined;history=undefined;agentRunning=false;if(agentTimer)clearTimeout(agentTimer);lastAgentTrigger='';stopCapture();if(timer)clearTimeout(timer);
 const own=generation,response=await fetch('/jam-config');if(!response.ok)throw new Error('Real native room not configured');
 const config=await response.json() as {ref:ScopeRef;pin:Digest};
 if(!isScopeRef(config.ref)||!isDigest(config.pin)||Object.keys(config).sort().join(',')!=='pin,ref')throw new Error('Invalid public room configuration');
 const signer=secretSigner(unb64url($<HTMLInputElement>('secret').value));$<HTMLInputElement>('secret').value='';
 const session=$<HTMLInputElement>('session').value;$<HTMLInputElement>('session').value='';if(!session)throw new Error('Repository read session required for complete multi-actor history');
 const transport=signedReads(httpTransport(location.origin,{fetch:async(url,init)=>{const response=await fetch(url,{...init,redirect:'error'});if(response.redirected||response.url!==url)throw new TransportError('Wrong native response route');return response;}}),signer);
 const replayResponse=await fetch('/jam-replay-config');
 if(!replayResponse.ok&&replayResponse.status!==503)throw new Error(replayResponse.status===422?'Unsupported native replay code configuration':'Actual native replay configuration unavailable');
 let replayConfig=null;
 if(replayResponse.ok){if(!replayResponse.body)throw new Error('Public replay configuration unavailable');const raw=await within(30,signal=>takeBytes(replayResponse.body!,16384,signal));if(raw===LATE||raw===null)throw new Error('Public replay configuration exceeds bounds');replayConfig=capturedReplayConfig(parseStrict(new TextDecoder('utf-8',{fatal:true}).decode(raw)));}
 if(replayResponse.ok&&!replayConfig)throw new Error('Unsupported public replay configuration');
 const c:Connection={generation:own,signer,custody:new BrowserCustody(`${config.ref.scope}:${config.ref.inc}:${signer.key}`),room:{ref:config.ref,pin:config.pin,declaration:declaration as DeclaredDefinition,handle:new ScopeHandle(transport,config.ref.scope,session),creator:ref=>new ScopeHandle(transport,ref.scope,session)}};
 if(own!==generation)throw new Error('Connection changed');connection=c;
 if(replayConfig)c.room.replay=publicNativeReplay(replayConfig,location.origin,()=>session,async(url,init)=>{current(c);const response=await fetch(url,{...init,redirect:'error'});if(response.redirected||response.url!==url){try{void response.body?.getReader().cancel().catch(()=>undefined);}catch{}throw new TransportError('Wrong replay response route');}return response;},()=>current(c));nextBar=1;await refresh(c);
 const poll=async()=>{if(connection!==c)return;try{await refresh(c);}catch(error){if(connection===c)tell(error instanceof Error?error.message:'Native history unavailable');}if(connection===c)timer=setTimeout(poll,1500);};timer=setTimeout(poll,1500);
}
/** Save before dispatch; all awaits keep the same captured actor, scope and private store. */
async function submit(kind:string,fields:Record<string,FieldValue>,on:number|null=null,providerOriginal?:string,permit:()=>void=()=>undefined):Promise<Receipt> {
 const c=connected();permit();
 return navigator.locks.request(c.custody.identity,async()=>{
  current(c);permit();const original=await c.custody.load();current(c);
  if(original) {
   const resolution=await reconcileOriginal(c.room.handle,c.custody,c.room.ref,c.signer.key,()=>current(c));current(c);
   if(resolution.status!=='recorded'&&resolution.status!=='refused')throw new Error('An original outcome remains unknown; reconcile it before any new signature');
   if(original.signed.intent.kind==='musician-request'&&resolution.status==='recorded'&&intentDigest(original.signed.intent)!==providerOriginal)throw new Error('Original model result must be checked through Ask musician before another signature');
  }
  await refresh(c);current(c);const summary=await c.room.handle.summary();current(c);
  if(!summary.ok||canonicalize(summary.value.scope)!==canonicalize(c.room.ref)||summary.value.status!=='active'||summary.value.definition!==c.room.pin)throw new Error('Current native state unavailable');
  const expected=nativeRevisions(c.room.declaration,kind,on,fields,summary.value);
  const grants=parseStrict($<HTMLTextAreaElement>('grants').value);if(!Array.isArray(grants)||grants.length>32||!grants.every(isGrant))throw new Error('Native grants required');
  current(c);permit();const signed=await signedIntent(c.signer,{to:c.room.ref,kind,on,expected,fields});current(c);
  const pending:PendingIntent={signed,grants,beside:{}};await c.custody.save(pending);current(c);permit();
  let answer;try{answer=await c.room.handle.submit(signed,grants,pending.beside);}catch{throw new Error('Original outcome unknown; retained signed request was not replaced');}
  // Even after navigation, record this captured original's answer in its own store.
  if(answer.answer==='refused'){await c.custody.save({...pending,refusal:answer});throw new Error('Native refusal: '+answer.reason+'; original judgment retained');}
  if(answer.answer!=='accepted')throw new Error('Native request outcome unknown; original retained');
  const followed=await c.room.handle.followReceipt(answer.receipt);
  if(!followed.ok||followed.entry.input.type!=='act'||canonicalize(followed.entry.input.signed)!==canonicalize(signed))throw new Error('Receipt does not prove this original request');
  await c.custody.save({...pending,receipt:answer.receipt});current(c);await refresh(c);return answer.receipt;
 });
}
async function model(kind:'interpret'|'pattern',permit:()=>void=()=>undefined) {
 permit();
 const c=connected();let read=await refresh(c);current(c);if(!read.mapped||!read.schedule)throw new Error('Exact consistent replay required before choosing a musical proposal');let original=await c.custody.load();current(c);
 if(original?.signed.intent.kind!=='musician-request') {
  const context=read.entries.slice(-8),part=$<HTMLSelectElement>('part').value;
  await submit('musician-request',{kind,part,instrument:Number($<HTMLInputElement>('item').value),contextDigest:digestBytes(canonicalBytes(context)),head:read.mapped.at(-1)!.fact},null,undefined,permit);current(c);
  original=await c.custody.load();current(c);read=await refresh(c);if(!read.mapped||!read.schedule)throw new Error('Exact consistent replay required; original retained');
 }
 if(!original||original.signed.intent.kind!=='musician-request'||original.signed.intent.fields['kind']!==kind)throw new Error('Check the original model request of its own kind');
 const resolution=await reconcileOriginal(c.room.handle,c.custody,c.room.ref,c.signer.key,()=>current(c));current(c);
 if(resolution.status!=='recorded')throw new Error('Original model request is not known accepted');
 original=await c.custody.load();current(c);if(!original?.receipt)throw new Error('Original native receipt unavailable');
 const mapped=read.mapped;if(!mapped||!read.schedule)throw new Error('Exact consistent replay required; original retained');
 const head=original.signed.intent.fields['head'] as {seq:number};
 const context=read.entries.slice(Math.max(0,head.seq-7),head.seq+1);
 if(digestBytes(canonicalBytes(context))!==original.signed.intent.fields['contextDigest'])throw new Error('Original context unavailable');
 await c.custody.save({...original,provider:{status:'unknown'}});current(c);
 const authorization=await signedReader(c.signer,c.room.ref.scope,'entry',String(original.receipt.fact.seq));current(c);
 const summaryAuthorization=await signedReader(c.signer,c.room.ref.scope,'summary','summary');current(c);
 const response=await fetch('/musician',{method:'POST',headers:{'content-type':'application/json',authorization,'x-jam-summary-authorization':summaryAuthorization},body:JSON.stringify({receipt:original.receipt,context})});current(c);
 if(!response.ok)throw new Error('Original model result unknown; Ask again reconciles the same request without another dispatch');
 if(!response.body)throw new Error('Original model proposal unavailable');
 const raw=await within(30,signal=>takeBytes(response.body!,16384,signal));current(c);
 if(raw===LATE||raw===null)throw new Error('Original model response outside bounds; retained request unchanged');
 const proposed=parseStrict(new TextDecoder('utf-8',{fatal:true}).decode(raw)) as Record<string,FieldValue>;
 if(kind==='interpret')validateInterpretation(proposed as never);else decodePattern(proposed['bars'] as number,proposed['events'] as never);
 await c.custody.save({...original,provider:{status:'proposed',proposal:proposed}});current(c);
 const providerOriginal=intentDigest(original.signed.intent);
 permit();
 if(kind==='interpret') {
  const pending=mapped.filter(e=>e.seq<=head.seq&&e.act.kind==='sing'&&!mapped.some(i=>i.act.kind==='interpret'&&i.act.sing===e.seq)).at(-1);
  if(!pending)throw new Error('No original pending contribution');await submit('interpret',proposed,pending.seq,providerOriginal,permit);
 }else{
  const latest=mapped.filter(e=>e.seq<=head.seq&&e.act.kind==='interpret').at(-1);if(!latest)throw new Error('No original interpretation');
  await submit('pattern',{...proposed,instrument:original.signed.intent.fields['instrument']!,follows:latest.fact},null,providerOriginal,permit);
 }
}
function play() {
 if(!audio)return;
 if(history?.schedule?.origin) {
  const origin=history.entries[history.schedule.origin.seq];
  if(origin)for(let n=0;n<2;n++) {
   const frame=nativeBar(history,nextBar,audio.sampleRate);if(!frame)break;
   const delay=Date.parse(origin.time)/1000+frame.startSeconds-Date.now()/1000;if(delay>0.6)break;
   nextBar++;if(delay<0)continue;
   const buffer=audio.createBuffer(1,frame.samples.length,audio.sampleRate);buffer.copyToChannel(frame.samples,0);
   const source=audio.createBufferSource();source.buffer=buffer;source.connect(audio.destination);source.start(audio.currentTime+delay);
   $('musical-state').textContent=`Bar ${nextBar-1}${frame.solo?' — lead solo':''}. ${frame.mood ?? ''}\n${frame.say ?? ''}`;
  }
 }
 audioTimer=setTimeout(play,25);
}
async function perform(action:()=>Promise<unknown>){if(busy)return;busy=true;try{await action();}catch(error){tell(error instanceof Error?error.message:'Request unavailable');}finally{busy=false;}}
for(const[id,action]of Object.entries({connect,refresh:()=>refresh(),reconcile:async()=>{const c=connected();const result=await reconcileOriginal(c.room.handle,c.custody,c.room.ref,c.signer.key,()=>current(c));current(c);tell(result.status);},sing:async()=>{const phrase=ORIGINAL_TUNES.find(p=>p.id===$<HTMLSelectElement>('phrase').value)!.notes;await submit('sing',encodeContribution({kind:'tune',notes:phrase}) as unknown as Record<string,FieldValue>);},rhythm:()=>submit('sing',encodeContribution({kind:'rhythm',onsets:RHYTHM}) as unknown as Record<string,FieldValue>),take:()=>submit('take',{part:$<HTMLSelectElement>('part').value}),interpret:()=>model('interpret'),pattern:()=>model('pattern'),mood:()=>submit('mood',{text:$<HTMLInputElement>('text').value}),say:()=>submit('say',{text:$<HTMLInputElement>('text').value}),solo:()=>submit('solo',{instrument:Number($<HTMLInputElement>('item').value),bars:4}),'end-solo':()=>submit('end-solo',{},Number($<HTMLInputElement>('solo-item').value)),release:()=>submit('release',{},Number($<HTMLInputElement>('item').value)),lookahead:()=>submit('set-lookahead',{lookaheadMs:Number($<HTMLInputElement>('lookahead-ms').value)},0),order:()=>{const parts=$<HTMLInputElement>('order-parts').value.split(',').map(p=>p.trim());return submit('set-order',Object.fromEntries(parts.map((p,i)=>['part'+i,p])),0);}}))$(id).onclick=()=>void perform(action);
$('audio').onclick=()=>{if(audio){void audio.resume();return;}audio=new AudioContext();void audio.resume();play();};
window.addEventListener('pagehide',()=>{agentRunning=false;if(agentTimer)clearTimeout(agentTimer);generation++;connection=undefined;if(timer)clearTimeout(timer);if(audioTimer)clearTimeout(audioTimer);void audio?.close();audio=undefined;stopCapture();});
// Raw audio stays on this device. Measured estimator times are explicitly
// quantized to microseconds before the otherwise lossless score codec.
$('mic').onclick=()=>void perform(async()=>{const c=connected();stopCapture();const stream=await navigator.mediaDevices.getUserMedia({audio:true});try{current(c);}catch(error){stream.getTracks().forEach(t=>t.stop());throw error;}microphone=stream;capture=new AudioContext();chunks=[];processor=capture.createScriptProcessor(2048,1,1);const input=capture.createMediaStreamSource(stream);input.connect(processor);processor.connect(capture.destination);processor.onaudioprocess=e=>{if(connection===c&&capture&&chunks.length*2048<60*capture.sampleRate)chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));};tell('Recording locally; stop within sixty seconds.');});
$('stop-mic').onclick=()=>void perform(async()=>{const c=connected();if(!capture||!microphone||!processor)throw new Error('No microphone capture');processor.disconnect();microphone.getTracks().forEach(t=>t.stop());const rate=capture.sampleRate,kept=chunks;await capture.close();capture=undefined;microphone=undefined;processor=undefined;chunks=[];current(c);const samples=new Float32Array(kept.reduce((n,x)=>n+x.length,0));let at=0;for(const part of kept){samples.set(part,at);at+=part.length;}const estimator=(globalThis as unknown as {J0:{transcribeHum(samples:Float32Array,rate:number):{notes:{start:number;duration:number;pitch:number}[]}}}).J0;const measured=estimator.transcribeHum(samples,rate).notes;const notes=measured.map(n=>({start:Math.round(n.start*1000000)/1000000,duration:Math.max(1,Math.round(n.duration*1000000))/1000000,pitch:n.pitch,velocity:90}));const score=encodeContribution({kind:'tune',notes});await submit('sing',{...score,audioDigest:digestBytes(new Uint8Array(samples.buffer))} as unknown as Record<string,FieldValue>);});

// An independently enrolled musician runs its own loop and signs its own output.
// One model attempt per recorded trigger; unknown work stops for reconciliation.
$('start-musician').onclick=()=>void perform(async()=>{
 const c=connected();if(agentRunning)return;agentRunning=true;lastAgentTrigger='';
 const step=async()=>{
  if(!agentRunning||connection!==c)return;
  if(busy){agentTimer=setTimeout(step,1500);return;}
  busy=true;
  try {
   const read=await refresh(c);current(c);const mapped=read.mapped;if(!mapped||!read.schedule)throw new Error('Exact consistent replay required for the musician');
   const part=$<HTMLSelectElement>('part').value;
   const pending=mapped.filter(e=>e.act.kind==='sing'&&!mapped.some(i=>i.act.kind==='interpret'&&i.act.sing===e.seq)).at(-1);
   const interpretation=mapped.filter(e=>e.act.kind==='interpret').at(-1);
   const direction=mapped.filter(e=>e.act.kind==='music'&&['mood','solo','end-solo'].includes(e.act.name)).at(-1);
   const trigger=part==='synth'&&pending?'sing:'+pending.seq:interpretation?`pattern:${interpretation.seq}:${direction?.seq ?? -1}`:'';
   if(trigger&&trigger!==lastAgentTrigger){lastAgentTrigger=trigger;await model(trigger.startsWith('sing:')?'interpret':'pattern',()=>{current(c);if(!agentRunning)throw new Error('Musician paused; original retained');});}
  }catch(error){agentRunning=false;tell((error instanceof Error?error.message:'Musician unavailable')+'; musician paused. Check the original request before restarting.');}
  finally{busy=false;}
  if(agentRunning&&connection===c)agentTimer=setTimeout(step,1500);
 };
 agentTimer=setTimeout(step,0);tell('This enrolled musician is running. Unknown work pauses it.');
});
$('stop-musician').onclick=()=>{agentRunning=false;if(agentTimer)clearTimeout(agentTimer);tell('Musician paused. An in-flight original remains retained and must be reconciled.');};
