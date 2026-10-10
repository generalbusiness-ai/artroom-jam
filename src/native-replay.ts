/** Genuine public SDK replay, at one fixed trusted service and captured head. */
import type {Bounds,Head,PlatformDefinition,ScopeRef,Report} from '@generalbusiness/artroom-contract';
import {canonicalBytes,parseStrictBytes,isPlatformDefinition} from '@generalbusiness/artroom-bytes';
import {capabilitiesOf,gitRead,holdCapability,TOKENS_FLOOR,type HoldOptions} from '@generalbusiness/artroom-derive';
import {platform} from '@generalbusiness/artroom-platform';
import {httpSource,verify,render,SourceError,type ReaderFor,type Fetch,type Limits} from '@generalbusiness/artroom-replay';
import {replayCovers} from './replay-report.ts';
/** Operator-captured actual deployment choices, never inferred from NEWEST or defaults.
 * Reader credentials are passed separately and remain in the connection closure. */
export interface NativeReplayConfig {
 v:1;
 /** Operator's exact native deployment handoff, not a service attestation. */
 deployment:{origin:string;version:string;sourceCommit:string};
 platformDefinitions:readonly PlatformDefinition[];
 bounds:Bounds;
 hold:HoldOptions;
 capabilities:readonly ['hold@1','git-read@1'];
 owners:readonly ['hold@1','git-read@1'];
}
export type NativeReplayOutcome=
 | {status:'not-configured';usable:false;why:string}
 | {status:'unsupported-code';usable:false;why:string}
 | {status:'source-error';usable:false;reason:string|null;why:string}
 | {status:'reported';usable:boolean;report:Report;why:string|null;display:string};
export type NativeReplay=(scope:ScopeRef,head:Head)=>Promise<NativeReplayOutcome>;
export const unconfiguredReplay=():NativeReplayOutcome=>({status:'not-configured',usable:false,why:'Actual deployment replay code, bounds and read authority have not been configured.'});
// App traversal limits, not deployed scope bounds. Exceeding them stays incomplete.
const limits:Limits={scopes:32,entries:32768,bytes:32*1024*1024,depth:16};
const object=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x:Record<string,unknown>,names:readonly string[])=>Object.keys(x).length===names.length&&names.every(n=>Object.hasOwn(x,n));
const boundNames=['intentLifetimeSeconds','items','acts','receives','timedRules','rules','definitionBytes','textBytes','memberBytes','listElements','partyMembers','states','parties','refs','values','also','presents','guards','nestedGuards','guardDepth','effects','sends','fanOut','attention','attentionMembers','sendFields','guardPage','guardScan','entryBytes','usesPerEntry','sendsPerEntry','derivedEffects','decompositionDepth','deliveryBatch','fetchSeconds','preparationSeconds','turnRestarts','timedAttemptsPerTurn','routingRefusals','scopeEntries','namedDefinitions','dispatchSeconds','dispatchRetrySeconds','dispatchRetryMaxSeconds','drainRetrySeconds'] as const;
/** Closed public metadata only. Matching deployment provenance is an operator duty. */
export function capturedReplayConfig(value:unknown):NativeReplayConfig|null {
 if(!object(value)||!keys(value,['v','deployment','platformDefinitions','bounds','hold','capabilities','owners'])||value['v']!==1
  ||!object(value['deployment'])||!keys(value['deployment'],['origin','version','sourceCommit'])
  ||typeof value['deployment']['origin']!=='string'||typeof value['deployment']['version']!=='string'||value['deployment']['version'].length<1||value['deployment']['version'].length>128
  ||typeof value['deployment']['sourceCommit']!=='string'||!/^[a-f0-9]{40}$/.test(value['deployment']['sourceCommit'])
  ||!Array.isArray(value['platformDefinitions'])||value['platformDefinitions'].length<1||value['platformDefinitions'].length>64
  ||!value['platformDefinitions'].every(isPlatformDefinition)||new Set(value['platformDefinitions']).size!==value['platformDefinitions'].length
  ||!object(value['bounds'])||!keys(value['bounds'],boundNames)||!Object.values(value['bounds']).every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0)
  ||!object(value['hold'])||!keys(value['hold'],['tokensPerHold','rootRetentionSeconds'])
  ||value['hold']['tokensPerHold']!==TOKENS_FLOOR||value['hold']['rootRetentionSeconds']!==null
  ||JSON.stringify(value['capabilities'])!=='["hold@1","git-read@1"]'||JSON.stringify(value['owners'])!=='["hold@1","git-read@1"]')return null;
 try{const origin=new URL(value['deployment']['origin']);if(origin.origin!==value['deployment']['origin']||origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)return null;}catch{return null;}
 return parseStrictBytes(canonicalBytes(value)) as unknown as NativeReplayConfig;
}
export function publicNativeReplay(config:NativeReplayConfig,service:string,reader:ReaderFor,fetch:Fetch,current:()=>void):NativeReplay {
 // Detach actual code parameters at construction; no mutable configuration borrowing.
 const held=capturedReplayConfig(config),origin=new URL(service);
 if(origin.origin!==service||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||!['https:','http:'].includes(origin.protocol))throw new Error('One exact trusted replay origin required');
 return async(scope,head)=>{
  current();
  if(!held)return{status:'unsupported-code',usable:false,why:'This app does not support the configured capability/owner parameters or bounds shape.'};
  if(held.platformDefinitions.some(named=>platform(named)===null))return{status:'unsupported-code',usable:false,why:'The genuine public platform catalog lacks an explicitly configured version.'};
  const coded=capabilitiesOf(holdCapability(held.hold),gitRead());
  const source=httpSource(service,{reader:async(...args)=>{current();return await reader(...args);},fetch:async(...args)=>{current();const answer=await fetch(...args);try{current();}catch(error){try{void answer.body?.getReader().cancel().catch(()=>undefined);}catch{}throw error;}return answer;}});
  try {
   const checked=await verify(source,{mode:'replay',scope:scope.scope,head,bounds:held.bounds,limits,grants:'proven',capabilities:coded,owners:coded,platform:named=>held.platformDefinitions.includes(named)?platform(named):null});
   current();
   const usable=replayCovers(checked.report,scope,head);
   return{status:'reported',usable,report:checked.report,why:checked.why,display:render(checked.report,checked.why)+(usable?'':'\nJam playback remains unavailable: exact consistent target coverage is required.')};
  }catch(error){
   current();
   return{status:'source-error',usable:false,reason:error instanceof SourceError?error.reason:null,why:error instanceof SourceError?'The target native history could not be read for replay.':'Replay did not produce a complete result.'};
  }
 };
}
